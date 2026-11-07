#!/usr/bin/env python3
"""udemy player helper -- Chrome Native Messaging host (com.zeroday.merge): subtitle merge + RAR extract.

Runs merge_course_subs.py for the extension and streams its output back.
Protocol: 4-byte little-endian length + UTF-8 JSON, both directions.

Commands from the extension:
  {cmd:"ping"}                       -> {type:"pong", python, ffmpeg, winrar, version}
  {cmd:"pick", title, initial}       -> {type:"picked", path|null}   (native folder dialog)
  {cmd:"merge", src, out, inPlace, dryRun, skipExisting, deleteOriginals, subCodec}
                                     -> {type:"start",total} {type:"log",line}... {type:"done",...}
  {cmd:"extract", src, dryRun, deleteOriginals}   (runs extract_course_rars.py; WinRAR must be installed)
                                     -> {type:"xstart",total} {type:"xlog",line}... {type:"xdone",src,...}
  {cmd:"cancel"}                     (cancels whichever of merge/extract is running)
Only folder paths are accepted; nothing the extension sends is ever run through a shell.
"""
import ctypes, json, os, re, shutil, struct, subprocess, sys, threading, time
from ctypes import wintypes

VERSION = "1.3"
HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "merge_course_subs.py")
EXTRACT_SCRIPT = os.path.join(HERE, "extract_course_rars.py")
VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts"}
SUB_EXTS = {".vtt", ".srt", ".ass", ".ssa", ".sub"}
PART_RE = re.compile(r"^(?P<base>.+)\.part0*(?P<num>\d+)\.rar$", re.IGNORECASE)
LEGACY_R_RE = re.compile(r"^(?P<base>.+)\.r(?P<num>\d{2,3})$", re.IGNORECASE)


def find_winrar():
    for name in ("UnRAR.exe", "UnRAR"):
        p = shutil.which(name)
        if p:
            return p
    for root in (os.environ.get("ProgramFiles", r"C:\Program Files"),
                 os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")):
        for exe in ("UnRAR.exe", "WinRAR.exe"):
            p = os.path.join(root, "WinRAR", exe)
            if os.path.isfile(p):
                return p
    p = shutil.which("WinRAR.exe") or shutil.which("WinRAR")
    if p:
        return p
    if os.name == "nt":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\WinRAR.exe") as k:
                v = winreg.QueryValueEx(k, "")[0]
                if v and os.path.isfile(v):
                    return v
        except OSError:
            pass
    return None


def count_archive_sets(src):
    total = 0
    for dirpath_str, _dn, filenames in os.walk(src):
        part_bases, legacy_bases, plain = set(), set(), 0
        for name in filenames:
            m = PART_RE.match(name)
            if m:
                part_bases.add(m.group("base").lower())
                continue
            m2 = LEGACY_R_RE.match(name)
            if m2:
                legacy_bases.add(m2.group("base").lower())
                continue
            if name.lower().endswith(".rar"):
                plain += 1
        total += len(part_bases) + len(legacy_bases)
        # plain .rar files not covered by a legacy r00/r01 sibling each count too;
        # exact dedup happens in extract_course_rars.py, this is just a progress estimate
        total += max(0, plain - len(legacy_bases))
    return total

# keep the raw binary pipes; anything printed by mistake goes to stderr, never into the protocol
if os.name == "nt":
    import msvcrt
    msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
IN, OUT = sys.stdin.buffer, sys.stdout.buffer
sys.stdout = sys.stderr

_lock = threading.Lock()
_state = {"proc": None, "cancelled": False}


def send(obj):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    with _lock:
        OUT.write(struct.pack("<I", len(data)) + data)
        OUT.flush()


def read_msg():
    head = IN.read(4)
    if len(head) < 4:
        return None
    (n,) = struct.unpack("<I", head)
    return json.loads(IN.read(n).decode("utf-8"))


def kill_proc():
    p = _state["proc"]
    if p and p.poll() is None:
        if os.name == "nt":  # also kill ffmpeg children
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           creationflags=0x08000000)
        else:
            p.kill()


def count_pairs(src):
    total = 0
    for _d, _dn, files in os.walk(src):
        vids, subs = set(), set()
        for f in files:
            stem, ext = os.path.splitext(f)
            ext = ext.lower()
            if ext in VIDEO_EXTS:
                vids.add(stem)
            elif ext in SUB_EXTS:
                subs.add(stem)
        total += len(vids & subs)
    return total


def pick_folder(m):
    try:
        import tkinter
        from tkinter import filedialog
    except Exception:
        send({"type": "picked", "path": None, "error": "tkinter is not installed with this Python - paste the path instead."})
        return
    root = tkinter.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    initial = m.get("initial") or ""
    path = filedialog.askdirectory(parent=root, title=m.get("title") or "Choose folder",
                                   initialdir=initial if os.path.isdir(initial) else None, mustexist=False)
    root.destroy()
    send({"type": "picked", "path": os.path.normpath(path) if path else None})


def inside(child, parent):
    c, p = os.path.normcase(os.path.realpath(child)), os.path.normcase(os.path.realpath(parent))
    return c == p or c.startswith(p + os.sep)


def run_merge(m):
    src = (m.get("src") or "").strip().strip('"')
    out = (m.get("out") or "").strip().strip('"')
    in_place = bool(m.get("inPlace"))
    dry = bool(m.get("dryRun"))
    codec = m.get("subCodec") if m.get("subCodec") in ("srt", "webvtt", "ass", "copy") else "srt"

    def fail(msg):
        send({"type": "error", "message": msg})

    if not os.path.isdir(src):
        return fail("Source folder does not exist: " + src)
    if not in_place:
        if not out:
            return fail("Choose an output folder (or use in-place mode).")
        if inside(out, src):
            return fail("Output folder must be OUTSIDE the source folder (otherwise it would be scanned again).")
    if not dry and not shutil.which("ffmpeg"):
        return fail("ffmpeg was not found on PATH. Install it (winget install Gyan.FFmpeg), then restart Chrome.")
    if not os.path.isfile(SCRIPT):
        return fail("merge_course_subs.py is missing next to the helper.")

    cmd = [sys.executable, "-u", SCRIPT, src]
    if in_place:
        cmd.append("--in-place")
    else:
        cmd.append(out)
    if dry:
        cmd.append("--dry-run")
    if m.get("skipExisting"):
        cmd.append("--skip-existing")
    if m.get("deleteOriginals") and not dry:
        cmd.append("--delete-originals")
    cmd += ["--sub-codec", codec]

    send({"type": "start", "total": count_pairs(src), "cmd": " ".join('"%s"' % c if " " in c else c for c in cmd[2:])})
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    _state["cancelled"] = False
    try:
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                             encoding="utf-8", errors="replace", env=env, stdin=subprocess.DEVNULL,
                             creationflags=0x08000000 if os.name == "nt" else 0)
    except Exception as e:
        return fail("Could not start the merge script: %s" % e)
    _state["proc"] = p
    stats = {}
    for line in p.stdout:
        line = line.rstrip("\r\n")
        if not line:
            continue
        mt = re.search(r"merged=(\d+)\s+copied=(\d+)\s+skipped=(\d+)\s+failed=(\d+)", line)
        if mt:
            stats = dict(zip(("merged", "copied", "skipped", "failed"), map(int, mt.groups())))
        send({"type": "log", "line": line})
    code = p.wait()
    _state["proc"] = None
    send({"type": "done", "code": code, "cancelled": _state["cancelled"], "dryRun": dry, **stats})


def run_extract(m):
    src = (m.get("src") or "").strip().strip('"')
    dry = bool(m.get("dryRun"))
    delete_originals = bool(m.get("deleteOriginals")) and not dry

    def fail(msg):
        send({"type": "xerror", "message": msg})

    if not os.path.isdir(src):
        return fail("Source folder does not exist: " + src)
    if not os.path.isfile(EXTRACT_SCRIPT):
        return fail("extract_course_rars.py is missing next to the helper.")
    if not dry and not find_winrar():
        return fail("WinRAR was not found. Install it from https://www.win-rar.com/ (the free trial works), "
                     "then restart Chrome.")

    cmd = [sys.executable, "-u", EXTRACT_SCRIPT, src]
    if dry:
        cmd.append("--dry-run")
    if delete_originals:
        cmd.append("--delete-originals")

    send({"type": "xstart", "total": count_archive_sets(src),
          "cmd": " ".join('"%s"' % c if " " in c else c for c in cmd[2:])})
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    _state["cancelled"] = False
    try:
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                             encoding="utf-8", errors="replace", env=env, stdin=subprocess.DEVNULL,
                             creationflags=0x08000000 if os.name == "nt" else 0)
    except Exception as e:
        return fail("Could not start the extraction script: %s" % e)
    _state["proc"] = p
    stats = {}
    last_dest = src
    for line in p.stdout:
        line = line.rstrip("\r\n")
        if not line:
            continue
        mt = re.search(r"extracted=(\d+)\s+failed=(\d+)", line)
        if mt:
            stats = dict(zip(("extracted", "failed"), map(int, mt.groups())))
        em = re.match(r"EXTRACT .+ -> (.+)$", line)
        if em:
            last_dest = em.group(1)
        send({"type": "xlog", "line": line})
    code = p.wait()
    _state["proc"] = None
    send({"type": "xdone", "code": code, "cancelled": _state["cancelled"], "dryRun": dry, "src": last_dest, **stats})


def main():
    worker = None
    while True:
        m = read_msg()
        if m is None:  # browser closed the port -> stop any running job
            kill_proc()
            break
        cmd = m.get("cmd")
        if cmd == "ping":
            send({"type": "pong", "version": VERSION, "python": sys.version.split()[0],
                  "ffmpeg": bool(shutil.which("ffmpeg")), "winrar": bool(find_winrar()),
                  "busy": bool(worker and worker.is_alive())})
        elif cmd == "pick":
            pick_folder(m)
        elif cmd == "merge":
            if worker and worker.is_alive():
                send({"type": "error", "message": "Something is already running - wait for it to finish (or cancel it) first."})
            else:
                worker = threading.Thread(target=run_merge, args=(m,), daemon=True)
                worker.start()
        elif cmd == "extract":
            if worker and worker.is_alive():
                send({"type": "xerror", "message": "Something is already running - wait for it to finish (or cancel it) first."})
            else:
                worker = threading.Thread(target=run_extract, args=(m,), daemon=True)
                worker.start()
        elif cmd == "cancel":
            _state["cancelled"] = True
            kill_proc()


if __name__ == "__main__":
    main()
