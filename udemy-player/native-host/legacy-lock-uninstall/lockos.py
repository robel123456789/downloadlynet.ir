#!/usr/bin/env python3
"""EthioLock OS layer (v5.0) - what the privileged daemon does to the machine while a lock is active.

  Windows : needs SYSTEM (scheduled task).  icacls ACLs + OWNER RIGHTS, open file handles, hosts file, HKLM browser policies,
            registry/file mirrors of the lock state, mutual-watchdog scheduled tasks, Focus Guard restart.
  Linux   : needs root (systemd unit).  chattr +i, /etc/hosts, /etc/opt/chrome/policies/managed.
  macOS   : needs root (launchd daemon).  chflags uchg, /etc/hosts, /Library/Managed Preferences.

Every method is idempotent and safe to call every tick.  Everything applied is recorded in applied.json (daemon-private) so release()
can undo exactly that, even after a crash.  release() is only ever called by lockd.py when trusted time reaches the end time.
"""
import base64, ctypes, json, os, plistlib, re, shutil, subprocess, sys, time

NOWIN = 0x08000000 if os.name == "nt" else 0
MARK_B, MARK_E = "# >>> EthioLock begin (managed - removed automatically when the session ends)", "# <<< EthioLock end"

# pages that must not open while locked (used for browser policy; the extension closes the same pages itself)
BLOCK_URLS = ["chrome://extensions", "chrome://extensions/*", "chrome://extensions-internals", "chrome://inspect", "chrome://inspect/*",
              "edge://extensions", "edge://extensions/*", "brave://extensions", "brave://extensions/*",
              "vivaldi://extensions", "opera://extensions", "devtools://*"]


# ------------------------------------------------------------------ pure helpers (unit-tested)
def hosts_strip(text):
    out, skip = [], False
    for line in text.splitlines():
        if line.strip() == MARK_B:
            skip = True
            continue
        if line.strip() == MARK_E:
            skip = False
            continue
        if not skip:
            out.append(line)
    while out and not out[-1].strip():
        out.pop()
    return "\n".join(out) + ("\n" if out else "")


def hosts_render(text, domains):
    base = hosts_strip(text)
    names = []
    for d in domains:
        d = str(d).strip().lower().lstrip(".")
        if not re.fullmatch(r"([a-z0-9-]+\.)+[a-z]{2,}", d):
            continue
        for n in (d, "www." + d if not d.startswith("www.") else d):
            if n not in names:
                names.append(n)
    if not names:
        return base
    block = [MARK_B] + ["0.0.0.0 " + n for n in names] + [":: " + n for n in names] + [MARK_E]
    return base + "\n" + "\n".join(block) + "\n"


def policy_dict():
    return {"URLBlocklist": BLOCK_URLS, "DeveloperToolsAvailability": 2}


def sd_hold_paths(cfg):
    return [p for p in (cfg.get("hold_files") or []) if p]


def _run(*cmd, timeout=60, **kw):
    try:
        return subprocess.run(list(cmd), capture_output=True, text=True, timeout=timeout, creationflags=NOWIN, **kw)
    except Exception as e:                          # missing tool / timeout: never raise into the daemon loop
        class R:
            returncode, stdout, stderr = 1, "", str(e)
        return R()


class FileMirror:
    """one more copy of the lock record in a place the user account cannot write"""

    def __init__(self, path):
        self.path = path

    def read(self):
        with open(self.path, "r", encoding="utf-8") as fh:
            return json.load(fh)

    def write(self, rec):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(rec, fh)
        os.replace(tmp, self.path)


class _Base:
    name = "base"

    def __init__(self, root, cfg):
        self.root, self.cfg = root, cfg
        self.applied_path = os.path.join(root, "applied.json")
        self.applied = self._load()
        self.flags = {}
        self._t = {}

    # ---- bookkeeping
    def _load(self):
        try:
            with open(self.applied_path, "r", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:
            return {}

    def _save(self):
        try:
            tmp = self.applied_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(self.applied, fh)
            os.replace(tmp, self.applied_path)
        except OSError:
            pass

    def due(self, key, every):
        n = time.monotonic()
        if n - self._t.get(key, -1e9) >= every:
            self._t[key] = n
            return True
        return False

    def dirty(self):
        return bool(self.applied)

    # ---- interface (overridden)
    def mirrors(self):
        return []

    def apply(self, rec):
        pass

    def release(self):
        pass

    def ensure_infra(self):
        pass

    def ensure_guard(self):
        pass

    def protect_self(self, on):
        pass


class NullOS(_Base):
    """tests / unsupported platforms: records what would be done"""
    name = "null"

    def __init__(self, root, cfg):
        super().__init__(root, cfg)
        self.calls = []

    def apply(self, rec):
        self.calls.append("apply")
        self.applied["on"] = True
        self.flags = {"acl": True, "hosts": True, "policy": True}

    def release(self):
        self.calls.append("release")
        self.applied = {}
        self.flags = {}

    def protect_self(self, on):
        self.calls.append("self:%s" % on)


# ------------------------------------------------------------------ Windows
class WinOS(_Base):
    name = "windows"
    SYS, ADM, USR, OWN = "*S-1-5-18", "*S-1-5-32-544", "*S-1-5-32-545", "*S-1-3-4"
    BROWSER_KEYS = [r"SOFTWARE\Policies\Google\Chrome", r"SOFTWARE\Policies\Microsoft\Edge",
                    r"SOFTWARE\Policies\BraveSoftware\Brave", r"SOFTWARE\Policies\Chromium"]

    def __init__(self, root, cfg):
        super().__init__(root, cfg)
        self.hosts = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "drivers", "etc", "hosts")
        self.handles = {}

    # ---- mirrors: registry (HKLM, SYSTEM-write) + a file under System32
    def mirrors(self):
        return [_RegMirror(r"SOFTWARE\EthioLock"), FileMirror(os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "ethiolock.dat"))]

    # ---- folders
    def _acl_lock(self, path):
        if not os.path.isdir(path):
            return False
        r1 = _run("icacls", path, "/grant:r", self.SYS + ":(OI)(CI)F", self.ADM + ":(OI)(CI)RX", self.USR + ":(OI)(CI)RX",
                  self.OWN + ":(OI)(CI)(RC)", "/C", "/Q")
        _run("icacls", path, "/inheritance:r", "/C", "/Q")
        sid = (self.cfg.get("user_sid") or "").strip()
        if re.fullmatch(r"S-1-5-21(-\d+){4}", sid):
            _run("icacls", path, "/deny", "*%s:(OI)(CI)(DE,DC,WDAC,WO)" % sid, "/C", "/Q")
        _run("icacls", path, "/setowner", self.SYS, "/T", "/C", "/Q")
        return r1.returncode == 0

    def _acl_unlock(self, path):
        if os.path.isdir(path):
            _run("icacls", path, "/reset", "/T", "/C", "/Q")

    def _hold(self, paths):
        k32 = ctypes.windll.kernel32
        from ctypes import wintypes
        k32.CreateFileW.restype = ctypes.c_void_p
        k32.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p]
        bad = ctypes.c_void_p(-1).value
        for p in paths:
            if p in self.handles or not os.path.isfile(p):
                continue
            h = k32.CreateFileW(p, 0x80000000, 1, None, 3, 0x80, None)    # GENERIC_READ, FILE_SHARE_READ only (=> no delete/rename), OPEN_EXISTING
            if h and h != bad:
                self.handles[p] = h

    def _unhold(self):
        k32 = ctypes.windll.kernel32
        k32.CloseHandle.argtypes = [ctypes.c_void_p]
        for h in self.handles.values():
            k32.CloseHandle(h)
        self.handles = {}

    # ---- hosts
    def _hosts_apply(self, domains):
        try:
            with open(self.hosts, "r", encoding="utf-8", errors="replace") as fh:
                cur = fh.read()
            new = hosts_render(cur, domains)
            if new.strip() != cur.strip():
                with open(self.hosts, "w", encoding="utf-8", newline="\n") as fh:
                    fh.write(new)
                _run("ipconfig", "/flushdns")
            return True
        except OSError:
            return False

    def _hosts_clear(self):
        try:
            with open(self.hosts, "r", encoding="utf-8", errors="replace") as fh:
                cur = fh.read()
            if MARK_B in cur:
                with open(self.hosts, "w", encoding="utf-8", newline="\n") as fh:
                    fh.write(hosts_strip(cur))
                _run("ipconfig", "/flushdns")
        except OSError:
            pass

    # ---- browser policy (HKLM) - adds numbered URLBlocklist entries of our own, remembers the DevTools value it replaced
    def _pol_apply(self):
        import winreg
        rec = self.applied.setdefault("pol", {})
        ok = True
        for root in self.BROWSER_KEYS:
            try:
                k = winreg.CreateKeyEx(winreg.HKEY_LOCAL_MACHINE, root, 0, winreg.KEY_ALL_ACCESS)
                r = rec.setdefault(root, {"urls": {}})
                if "dt" not in r:
                    try:
                        v, _t = winreg.QueryValueEx(k, "DeveloperToolsAvailability")
                        r["dt"] = {"had": True, "val": int(v)}
                    except FileNotFoundError:
                        r["dt"] = {"had": False, "val": 0}
                winreg.SetValueEx(k, "DeveloperToolsAvailability", 0, winreg.REG_DWORD, 2)
                sub = winreg.CreateKeyEx(k, "URLBlocklist", 0, winreg.KEY_ALL_ACCESS)
                have, i = {}, 0
                while True:
                    try:
                        n, v, _t = winreg.EnumValue(sub, i)
                        have[n] = v
                        i += 1
                    except OSError:
                        break
                for pat in BLOCK_URLS:
                    name = next((n for n, p in r["urls"].items() if p == pat), None)
                    if name and have.get(name) == pat:
                        continue
                    nums = [int(n) for n in have if str(n).isdigit()]
                    name = str(max(nums + [0]) + 1)
                    winreg.SetValueEx(sub, name, 0, winreg.REG_SZ, pat)
                    have[name] = pat
                    r["urls"][name] = pat
                winreg.CloseKey(sub)
                winreg.CloseKey(k)
            except OSError:
                ok = False
        self._save()
        return ok

    def _pol_clear(self):
        import winreg
        for root, r in (self.applied.get("pol") or {}).items():
            try:
                k = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, root, 0, winreg.KEY_ALL_ACCESS)
            except OSError:
                continue
            try:
                try:
                    sub = winreg.OpenKey(k, "URLBlocklist", 0, winreg.KEY_ALL_ACCESS)
                    for name, pat in r.get("urls", {}).items():
                        try:
                            if winreg.QueryValueEx(sub, name)[0] == pat:
                                winreg.DeleteValue(sub, name)
                        except OSError:
                            pass
                    empty = False
                    try:
                        winreg.EnumValue(sub, 0)
                    except OSError:
                        empty = True
                    winreg.CloseKey(sub)
                    if empty:
                        winreg.DeleteKey(k, "URLBlocklist")
                except OSError:
                    pass
                dt = r.get("dt") or {}
                try:
                    if dt.get("had"):
                        winreg.SetValueEx(k, "DeveloperToolsAvailability", 0, winreg.REG_DWORD, int(dt.get("val", 0)))
                    else:
                        winreg.DeleteValue(k, "DeveloperToolsAvailability")
                except OSError:
                    pass
            finally:
                winreg.CloseKey(k)

    # ---- scheduled tasks: the daemon and its watcher recreate each other
    def ensure_infra(self):
        if not self.due("tasks", 30):
            return
        d = self.cfg.get("task_dir") or ""
        for name in ("EthioLockd", "EthioLockWatch"):
            if _run("schtasks", "/Query", "/TN", name).returncode != 0:
                x = os.path.join(d, name + ".xml")
                if os.path.isfile(x):
                    _run("schtasks", "/Create", "/F", "/TN", name, "/XML", x)

    def ensure_guard(self):
        if not self.due("guard", 20):
            return
        ud = self.cfg.get("user_data") or ""
        try:
            with open(os.path.join(ud, "guard_status.json"), "r") as fh:
                at = int(json.load(fh).get("at", 0))
            if int(time.time() * 1000) - at < 15000:
                return
        except Exception:
            pass
        _run("schtasks", "/Run", "/TN", self.cfg.get("guard_task") or "FocusGuard")

    def protect_self(self, on):
        try:
            sd = ctypes.c_void_p()
            sddl = "D:(D;;0x0001;;;WD)(A;;0x1FFFFE;;;WD)" if on else "D:(A;;0x1FFFFF;;;BA)(A;;0x1FFFFF;;;SY)"
            ctypes.windll.advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl, 1, ctypes.byref(sd), None)
            ctypes.windll.kernel32.GetCurrentProcess.restype = ctypes.c_void_p
            ctypes.windll.advapi32.SetKernelObjectSecurity(ctypes.c_void_p(ctypes.windll.kernel32.GetCurrentProcess()), 4, sd)
        except Exception:
            pass

    # ---- main entry points
    def apply(self, rec):
        c = rec.get("cfg") or self.cfg
        self.cfg = {**self.cfg, **{k: v for k, v in c.items() if v not in (None, "")}}
        dirs = [p for p in (self.cfg.get("protect_dirs") or []) if p]
        if self.due("acl", 30):
            self.flags["acl"] = all([self._acl_lock(p) for p in dirs]) if dirs else False
            self.applied["dirs"] = dirs
            self._hold(sd_hold_paths(self.cfg))
            self._save()
        if self.due("hosts", 3):
            self.flags["hosts"] = self._hosts_apply(self.cfg.get("blocklist") or [])
            self.applied["hosts"] = True
        if self.due("policy", 10):
            self.flags["policy"] = self._pol_apply()
        self.flags["held"] = len(self.handles)
        self.ensure_infra()
        self.ensure_guard()
        self.flags["guard"] = True

    def dirty(self):
        return bool(self.applied.get("dirs") or self.applied.get("hosts") or self.applied.get("pol") or self.handles)

    def release(self):
        self._unhold()
        for p in self.applied.get("dirs") or []:
            self._acl_unlock(p)
        self._hosts_clear()
        try:
            self._pol_clear()
        except Exception:
            pass
        self.applied = {}
        self._save()
        self.flags = {}
        self._t = {}


class _RegMirror:
    def __init__(self, key):
        self.key = key

    def read(self):
        import winreg
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, self.key) as k:
            return json.loads(winreg.QueryValueEx(k, "Lock")[0])

    def write(self, rec):
        import winreg
        with winreg.CreateKeyEx(winreg.HKEY_LOCAL_MACHINE, self.key, 0, winreg.KEY_ALL_ACCESS) as k:
            winreg.SetValueEx(k, "Lock", 0, winreg.REG_SZ, json.dumps(rec))


# ------------------------------------------------------------------ Linux / macOS
class PosixOS(_Base):
    name = "posix"
    LINUX_POLICY_DIRS = ["/etc/opt/chrome/policies/managed", "/etc/chromium/policies/managed", "/etc/opt/edge/policies/managed",
                         "/etc/brave/policies/managed"]
    MAC_PLISTS = ["/Library/Managed Preferences/com.google.Chrome.plist", "/Library/Managed Preferences/com.microsoft.Edge.plist",
                  "/Library/Managed Preferences/com.brave.Browser.plist"]

    def __init__(self, root, cfg):
        super().__init__(root, cfg)
        self.mac = sys.platform == "darwin"
        self.hosts = "/etc/hosts"

    def mirrors(self):
        return [FileMirror("/etc/ethiolock/lock.mirror.json")]

    def _imm(self, path, on, recursive=True):
        if not os.path.exists(path):
            return False
        if self.mac:
            return _run("chflags", *(["-R"] if recursive else []), "uchg" if on else "nouchg", path).returncode == 0
        return _run("chattr", *(["-R"] if recursive else []), "+i" if on else "-i", path).returncode == 0

    def _hosts_apply(self, domains):
        try:
            self._imm(self.hosts, False, False)
            with open(self.hosts, "r", encoding="utf-8", errors="replace") as fh:
                cur = fh.read()
            new = hosts_render(cur, domains)
            if new.strip() != cur.strip():
                with open(self.hosts, "w", encoding="utf-8") as fh:
                    fh.write(new)
                if self.mac:
                    _run("dscacheutil", "-flushcache")
                    _run("killall", "-HUP", "mDNSResponder")
                else:
                    _run("resolvectl", "flush-caches")
            self._imm(self.hosts, True, False)
            return True
        except OSError:
            return False

    def _hosts_clear(self):
        try:
            self._imm(self.hosts, False, False)
            with open(self.hosts, "r", encoding="utf-8", errors="replace") as fh:
                cur = fh.read()
            if MARK_B in cur:
                with open(self.hosts, "w", encoding="utf-8") as fh:
                    fh.write(hosts_strip(cur))
        except OSError:
            pass

    def _pol_apply(self):
        ok = True
        files = self.applied.setdefault("pol", {})
        try:
            if self.mac:
                for p in self.MAC_PLISTS:
                    if p not in files:
                        files[p] = {"orig": base64.b64encode(open(p, "rb").read()).decode() if os.path.exists(p) else None}
                    d = {}
                    if files[p]["orig"]:
                        d = plistlib.loads(base64.b64decode(files[p]["orig"]))
                    d["URLBlocklist"] = list(d.get("URLBlocklist", [])) + [u for u in BLOCK_URLS if u not in d.get("URLBlocklist", [])]
                    d["DeveloperToolsAvailability"] = 2
                    os.makedirs(os.path.dirname(p), exist_ok=True)
                    with open(p, "wb") as fh:
                        plistlib.dump(d, fh)
            else:
                for dpath in self.LINUX_POLICY_DIRS:
                    os.makedirs(dpath, exist_ok=True)
                    p = os.path.join(dpath, "ethiolock.json")
                    files[p] = {"orig": None}
                    with open(p, "w") as fh:
                        json.dump(policy_dict(), fh)
        except OSError:
            ok = False
        self._save()
        return ok

    def _pol_clear(self):
        for p, r in (self.applied.get("pol") or {}).items():
            try:
                if r.get("orig"):
                    with open(p, "wb") as fh:
                        fh.write(base64.b64decode(r["orig"]))
                elif os.path.exists(p):
                    os.remove(p)
            except OSError:
                pass

    def apply(self, rec):
        c = rec.get("cfg") or self.cfg
        self.cfg = {**self.cfg, **{k: v for k, v in c.items() if v not in (None, "")}}
        dirs = [p for p in (self.cfg.get("protect_dirs") or []) if p]
        if self.due("acl", 30):
            self.flags["acl"] = all([self._imm(p, True) for p in dirs]) if dirs else False
            self.applied["dirs"] = dirs
            self._save()
        if self.due("hosts", 3):
            self.flags["hosts"] = self._hosts_apply(self.cfg.get("blocklist") or [])
            self.applied["hosts"] = True
        if self.due("policy", 10):
            self.flags["policy"] = self._pol_apply()
        self.flags["guard"] = False        # the app-closing guard is Windows-only

    def dirty(self):
        return bool(self.applied.get("dirs") or self.applied.get("hosts") or self.applied.get("pol"))

    def release(self):
        for p in self.applied.get("dirs") or []:
            self._imm(p, False)
        self._hosts_clear()
        self._pol_clear()
        self.applied = {}
        self._save()
        self.flags = {}
        self._t = {}


def make_backend(root, cfg):
    if os.name == "nt":
        return WinOS(root, cfg)
    if sys.platform.startswith(("linux", "darwin")):
        return PosixOS(root, cfg)
    return NullOS(root, cfg)
