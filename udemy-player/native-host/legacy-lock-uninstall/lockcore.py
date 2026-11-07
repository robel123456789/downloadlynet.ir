#!/usr/bin/env python3
"""EthioLock core (v5.0) - the commitment lock's state machine and clock-tamper defence.

No OS side effects live here (those are in lockd.py), so everything in this file can be unit-tested.

THE RULES (enforced only here, by the privileged daemon - the extension and the user-level native host can only *ask*):
  * a lock is {id, startedAt, endTs} on the TRUSTED timeline (epoch ms);
  * "start" while idle begins a lock; "start"/"extend" while locked can only push endTs LATER;
  * there is no request that ends, shortens or cancels a lock.  The lock ends when trusted time reaches endTs. Nothing else.

TRUSTED TIME (why changing the system clock does not help)
  trusted time advances with a MONOTONIC clock (time.monotonic: unaffected by the wall clock, resets only at boot).
  The wall clock is used only as a TRIGGER: if it claims more time has passed than the monotonic clock can account for
  (sleep, power-off, or a forward clock jump) the daemon asks the network (HTTPS Date header, certificate-checked) and
  credits at most what the network confirms.  Offline, it credits nothing it cannot prove (the lock just lasts longer).
  A backward jump of the wall clock is ignored completely.  Across a reboot the monotonic gap is lost, never invented:
  crediting monotonic deltas can never give MORE than the real elapsed time.
"""
import json, os, re, ssl, sys, time, urllib.request
from email.utils import parsedate_to_datetime

VERSION = "5.0"
APP = "EthioLock"
TICK_SKEW_MS = 60_000            # wall may run this far ahead of the trusted clock before we ask the network
NET_TOL_MS = 3_000               # Date headers have 1 s resolution
NET_RECHECK_S = 900              # re-anchor to network time at most every 15 min while locked (cheap, keeps drift out)
STATUS_FRESH_MS = 20_000         # a status.json older than this means the daemon is not running right now
NET_URLS = ("https://www.google.com/generate_204", "https://www.cloudflare.com/cdn-cgi/trace", "https://www.microsoft.com")
DEFAULT_CFG = {
    "maxSessionMin": 720,        # one start (or one extension) may not exceed 12 h  -> a typo can never lock you for days
    "maxTotalMin": 1440,         # remaining time may never be pushed beyond 24 h
    "blocklist": ["facebook.com", "instagram.com", "tiktok.com", "twitter.com", "x.com", "reddit.com", "netflix.com",
                  "twitch.tv", "9gag.com", "pinterest.com"],      # OS-level (hosts file). Browser allow-list is in the extension.
    "protect_dirs": [],          # filled in by the installer (extension dir, native-host dir)
    "hold_files": [],            # key files to hold open (Windows)
    "user_sid": "", "user_data": "", "guard_task": "FocusGuard", "tamper_port": 47831,
}


def default_state_dir():
    if os.name == "nt":
        return os.path.join(os.environ.get("ProgramData") or r"C:\ProgramData", APP)
    if sys.platform == "darwin":
        return "/Library/Application Support/" + APP
    return "/var/lib/ethiolock"


def now_ms():
    return int(time.time() * 1000)


def mono_ms():
    return int(time.monotonic() * 1000)


# ---------------------------------------------------------------- network time
def net_time_ms(urls=NET_URLS, timeout=5):
    """Epoch ms from the Date header of an HTTPS response (certificate verified), or None. Needs no clock-independent trust:
    with a wrong system clock the TLS handshake usually fails, which simply means 'cannot verify' (= lock keeps counting safely)."""
    got = []
    ctx = ssl.create_default_context()
    for u in urls:
        try:
            req = urllib.request.Request(u, method="HEAD", headers={"User-Agent": "EthioLock/" + VERSION})
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                d = r.headers.get("Date")
            if d:
                got.append(int(parsedate_to_datetime(d).timestamp() * 1000))
        except Exception:
            continue
        if len(got) >= 2:
            break
    if not got:
        return None
    if len(got) == 2 and abs(got[0] - got[1]) > 120_000:      # two servers disagree wildly: believe neither
        return None
    return min(got)


class TimeKeeper:
    """Trusted clock.  State (all epoch/ms ints) is persisted inside the lock record under key 't'."""

    def __init__(self, t=None, net=net_time_ms, timer=time.monotonic):
        self.t = dict(t or {})
        self.net = net
        self._timer = timer
        self.t.setdefault("trusted", 0)
        self.t.setdefault("mono", 0)
        self.t.setdefault("skew0", 0)     # wall - trusted when last agreed (normally ~0)
        self.t.pop("netAt", None)
        self.held = False                 # True while a forward gap could not be verified (offline)
        self.net_ok = False
        self._last_try = -1e9             # when we last asked the network (process-local, never persisted across boots)
        self._net_at = -1e9               # when the network last confirmed the time

    @property
    def trusted(self):
        return self.t["trusted"]

    def anchor(self, wall, mono, use_net=True):
        """first call when a lock starts: trusted := network time if reachable, else the wall clock"""
        n = self.net() if use_net else None
        self.net_ok = n is not None
        base = n if n is not None else wall
        self.t.update(trusted=int(base), mono=int(mono), skew0=int(wall - base))
        self._net_at = self._timer() if n is not None else -1e9
        self.held = False
        return self.t["trusted"]

    def tick(self, wall, mono):
        dm = max(0, mono - self.t["mono"])        # monotonic progress since the previous sample (never > real elapsed time)
        self.t["trusted"] += dm
        self.t["mono"] = int(mono)
        skew = wall - self.t["trusted"]
        gap = skew - self.t["skew0"]              # how much further ahead the wall clock is than when we last agreed
        due = (self._timer() - self._last_try) >= (10 if gap > TICK_SKEW_MS else NET_RECHECK_S)
        if (gap > TICK_SKEW_MS or self._timer() - self._net_at > NET_RECHECK_S) and due:
            self._last_try = self._timer()
            n = self.net()
            self.net_ok = n is not None
            if n is not None:
                self.t["trusted"] = max(self.t["trusted"], int(n))      # the network is the truth; never go backwards
                self.t["skew0"] = int(wall - self.t["trusted"])
                self._net_at = self._timer()
                gap = 0
        self.held = gap > TICK_SKEW_MS
        return self.t["trusted"]


# ---------------------------------------------------------------- persistence
def _read_json(path):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            d = json.load(fh)
        return d if isinstance(d, dict) else None
    except Exception:
        return None


def atomic_write(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh)
        fh.flush()
        try:
            os.fsync(fh.fileno())
        except OSError:
            pass
    os.replace(tmp, path)


class Store:
    """lock record in several places; the copy with the highest 'seq' wins (so a deleted/edited primary is restored from the others).
    mirrors: objects with read()->dict|None and write(dict) (e.g. a registry key that only SYSTEM can write)."""

    def __init__(self, root, mirrors=()):
        self.root = root
        self.mirrors = list(mirrors)
        self.primary = os.path.join(root, "lock.json")
        self.backup = os.path.join(root, "lock.bak")
        self.inbox = os.path.join(root, "inbox")
        self.status_path = os.path.join(root, "status.json")
        self.cfg_path = os.path.join(root, "config.json")

    def cfg(self):
        c = dict(DEFAULT_CFG)
        c.update(_read_json(self.cfg_path) or {})
        return c

    def read(self):
        cands = [_read_json(self.primary), _read_json(self.backup)] + [self._m(m) for m in self.mirrors]
        cands = [c for c in cands if c and isinstance(c.get("seq"), int)]
        return max(cands, key=lambda c: c["seq"]) if cands else {"seq": 0, "idle": True}

    @staticmethod
    def _m(m):
        try:
            return m.read()
        except Exception:
            return None

    def write(self, rec):
        rec["seq"] = int(rec.get("seq", 0))
        os.makedirs(self.root, exist_ok=True)
        for p in (self.backup, self.primary):             # backup first: a crash between the two never leaves a stale pair
            try:
                atomic_write(p, rec)
            except OSError:
                pass
        for m in self.mirrors:
            try:
                m.write(rec)
            except Exception:
                pass

    def heal(self, rec):
        """rewrite any copy that is missing or older than 'rec' (called every tick)"""
        for p in (self.primary, self.backup):
            d = _read_json(p)
            if not d or d.get("seq") != rec.get("seq"):
                try:
                    atomic_write(p, rec)
                except OSError:
                    pass
        for m in self.mirrors:
            d = self._m(m)
            if not d or d.get("seq") != rec.get("seq"):
                try:
                    m.write(rec)
                except Exception:
                    pass


# ---------------------------------------------------------------- the state machine
def is_active(rec):
    return bool(rec) and not rec.get("idle") and int(rec.get("endTs", 0)) > int(rec.get("t", {}).get("trusted", 0))


def _int(x, lo, hi):
    if isinstance(x, bool) or not isinstance(x, (int, float)) or x != x:
        return None
    x = int(x)
    return x if lo <= x <= hi else None


def parse_request(raw, size_limit=4096):
    """untrusted bytes from the user-writable inbox -> {'op','minutes','nonce'} or None.  Nothing else is ever honoured."""
    if not isinstance(raw, (bytes, bytearray)) or len(raw) > size_limit:
        return None
    try:
        d = json.loads(raw.decode("utf-8"))
    except Exception:
        return None
    if not isinstance(d, dict) or d.get("op") not in ("start", "extend"):
        return None
    mins = _int(d.get("minutes"), 1, 100_000)
    if mins is None:
        return None
    nonce = d.get("nonce")
    nonce = nonce if isinstance(nonce, str) and re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", nonce) else ""
    return {"op": d["op"], "minutes": mins, "nonce": nonce}


def apply_request(rec, req, tk, cfg, wall, mono, new_id):
    """Returns (new_rec, result).  rec may be idle.  The only transitions: idle->locked, locked->locked(later end)."""
    max_s, max_t = int(cfg["maxSessionMin"]), int(cfg["maxTotalMin"])
    if req["minutes"] > max_s:
        return rec, {"ok": False, "err": "too long: at most %d minutes per request" % max_s, "nonce": req["nonce"]}
    if is_active(rec):
        trusted = rec["t"]["trusted"]
        end = int(rec["endTs"]) + req["minutes"] * 60_000
        if end - trusted > max_t * 60_000:
            end = trusted + max_t * 60_000
        if end <= rec["endTs"]:
            return rec, {"ok": False, "err": "already at the maximum remaining time", "nonce": req["nonce"]}
        nr = dict(rec)
        nr["endTs"] = end
        nr["seq"] = rec["seq"] + 1
        return nr, {"ok": True, "op": "extend", "nonce": req["nonce"]}
    trusted = tk.anchor(wall, mono)
    nr = {"v": 1, "idle": False, "id": new_id, "startedAt": trusted, "endTs": trusted + req["minutes"] * 60_000,
          "t": dict(tk.t), "cfg": snapshot_cfg(cfg), "seq": int(rec.get("seq", 0)) + 1}
    return nr, {"ok": True, "op": "start", "nonce": req["nonce"]}


def snapshot_cfg(cfg):
    keep = ("blocklist", "protect_dirs", "hold_files", "user_sid", "user_data", "guard_task", "tamper_port")
    return {k: cfg.get(k) for k in keep}


def end_lock(rec):
    """the ONLY place a lock becomes idle - called by the daemon when trusted time >= endTs"""
    return {"v": 1, "idle": True, "lastId": rec.get("id", ""), "lastEnd": rec.get("endTs", 0), "seq": int(rec.get("seq", 0)) + 1}


def public_status(rec, tk, wall, extra=None):
    act = is_active(rec)
    s = {"v": 1, "version": VERSION, "active": act, "id": rec.get("id", "") if act else "", "startedAt": rec.get("startedAt", 0) if act else 0,
         "endTs": rec.get("endTs", 0) if act else 0, "trusted": tk.trusted if tk else 0, "wall": wall,
         "remaining": max(0, rec.get("endTs", 0) - tk.trusted) if act and tk else 0,
         "held": bool(tk and tk.held), "netOk": bool(tk and tk.net_ok), "at": wall, "seq": rec.get("seq", 0)}
    if extra:
        s.update(extra)
    return s


# ---------------------------------------------------------------- read side (used by the user-level host and the guard)
def read_status(root=None):
    return _read_json(os.path.join(root or default_state_dir(), "status.json"))


def view(root=None, wall=None):
    """What a user-level process should believe right now: {'daemon','active','endTs','remaining','trusted', ...}.
    If the daemon has not refreshed the status for >20 s, extrapolate from it (never from a fresh wall-clock read alone)."""
    wall = wall if wall is not None else now_ms()
    s = read_status(root)
    if not s:
        return {"daemon": False, "active": False, "endTs": 0, "remaining": 0, "trusted": 0, "known": False}
    age = wall - int(s.get("at", 0))
    fresh = 0 <= age <= STATUS_FRESH_MS
    out = dict(s)
    out["daemon"] = fresh
    out["known"] = True
    if s.get("active") and not fresh:
        # daemon is down (or just restarting): keep counting from the last sample, but never accept a backwards wall clock
        elapsed = max(0, age)
        out["trusted"] = int(s.get("trusted", 0)) + elapsed
        out["remaining"] = max(0, int(s.get("endTs", 0)) - out["trusted"])
        out["active"] = out["remaining"] > 0
    return out


def submit(op, minutes, root=None, wait=6.0, uid=None):
    """user-level: drop a request file in the inbox and wait for the daemon's answer. Returns the status dict (+ 'result')."""
    import secrets
    root = root or default_state_dir()
    inbox = os.path.join(root, "inbox")
    nonce = secrets.token_hex(8)
    body = json.dumps({"op": op, "minutes": int(minutes), "nonce": nonce}).encode()
    tmp = os.path.join(inbox, nonce + ".tmp")
    try:
        with open(tmp, "wb") as fh:
            fh.write(body)
        os.replace(tmp, os.path.join(inbox, nonce + ".req"))
    except OSError as e:
        return {"ok": False, "err": "lock service not reachable (%s)" % e.__class__.__name__}
    end = time.time() + wait
    while time.time() < end:
        s = read_status(root) or {}
        last = s.get("last") or {}
        if last.get("nonce") == nonce:
            return {"ok": bool(last.get("ok")), "err": last.get("err", ""), "status": s}
        time.sleep(0.25)
    return {"ok": False, "err": "lock service did not answer (is it installed and running?)"}
