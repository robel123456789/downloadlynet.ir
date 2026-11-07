#!/usr/bin/env python3
r"""
extract_course_rars.py

Recursively walks a folder tree (Udemy-style course dumps or otherwise),
finds every WinRAR archive -- including multi-part sets like

    Course.part1.rar  Course.part2.rar  ...  Course.part6.rar

and legacy split sets (Course.rar + Course.r00 + Course.r01 + ...) -- and
extracts each set IN PLACE, into the same folder the parts already live in
(exactly like right-clicking the first part and choosing "Extract Here").
Only the FIRST part of each set is ever handed to WinRAR; it finds the rest
by itself. Standalone single-file .rar archives are extracted too.

Requires WinRAR to be installed on Windows (the free trial works fine).
It is located automatically: PATH, then the usual Program Files locations,
then the Windows registry App Paths key.

Usage:
    python extract_course_rars.py "SOURCE_DIR"
    python extract_course_rars.py "SOURCE_DIR" --delete-originals
    python extract_course_rars.py "SOURCE_DIR" --dry-run -v
"""

import argparse
import logging
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

PART_RE = re.compile(r"^(?P<base>.+)\.part0*(?P<num>\d+)\.rar$", re.IGNORECASE)
LEGACY_R_RE = re.compile(r"^(?P<base>.+)\.r(?P<num>\d{2,3})$", re.IGNORECASE)


def find_winrar():
    """Returns (exe_path, is_console). Prefers UnRAR.exe (true console app,
    so its output streams cleanly) over WinRAR.exe (GUI app; still scriptable
    with -ibck, just gives us less to log)."""
    candidates = []
    for name in ("UnRAR.exe", "UnRAR"):
        p = shutil.which(name)
        if p:
            candidates.append((p, True))
    for root in (os.environ.get("ProgramFiles", r"C:\Program Files"),
                 os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")):
        for exe, console in (("UnRAR.exe", True), ("WinRAR.exe", False)):
            p = os.path.join(root, "WinRAR", exe)
            if os.path.isfile(p):
                candidates.append((p, console))
    p = shutil.which("WinRAR.exe") or shutil.which("WinRAR")
    if p:
        candidates.append((p, False))
    if os.name == "nt":
        try:
            import winreg
            for hive, key in ((winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\WinRAR.exe"),
                               (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\WinRAR.exe")):
                try:
                    with winreg.OpenKey(hive, key) as k:
                        v = winreg.QueryValueEx(k, "")[0]
                        if v and os.path.isfile(v):
                            candidates.append((v, False))
                            un = os.path.join(os.path.dirname(v), "UnRAR.exe")
                            if os.path.isfile(un):
                                candidates.append((un, True))
                except OSError:
                    pass
        except ImportError:
            pass
    # prefer a console exe if any was found
    for path, console in candidates:
        if console:
            return path, True
    return (candidates[0] if candidates else (None, False))


def discover_archive_sets(root: Path):
    """Yields (first_part: Path, all_parts: list[Path], label: str) for every
    archive set found anywhere under root. Only the first part of each set
    is returned as the thing to hand to WinRAR."""
    for dirpath_str, _dirnames, filenames in os.walk(root):
        dirpath = Path(dirpath_str)
        part_groups = {}   # base -> {num: filename}
        legacy_groups = {} # base -> set of r-nums present
        plain_rars = []

        for name in filenames:
            m = PART_RE.match(name)
            if m:
                part_groups.setdefault(m.group("base").lower(), {})[int(m.group("num"))] = name
                continue
            m2 = LEGACY_R_RE.match(name)
            if m2:
                legacy_groups.setdefault(m2.group("base").lower(), set()).add(int(m2.group("num")))
                continue
            if name.lower().endswith(".rar"):
                plain_rars.append(name)

        # new-style .partN.rar sets
        for base, nums in part_groups.items():
            lo, hi = min(nums), max(nums)
            missing = [n for n in range(lo, hi + 1) if n not in nums]
            first = dirpath / nums[lo]
            label = f"{base} ({hi - lo + 1} parts" + (f", MISSING part(s) {missing}" if missing else "") + ")"
            yield first, [dirpath / f for f in nums.values()], label

        # legacy .rar + .r00 + .r01 ... sets -- the plain ".rar" with that
        # base is the first part; don't also report it as a standalone archive
        consumed_plain = set()
        for base, nums in legacy_groups.items():
            rar_name = next((n for n in plain_rars if Path(n).stem.lower() == base), None)
            if rar_name:
                consumed_plain.add(rar_name)
                parts = [dirpath / rar_name] + [dirpath / f"{Path(rar_name).stem}.r{n:02d}" for n in sorted(nums)]
                yield dirpath / rar_name, parts, f"{base} (legacy split, {len(nums) + 1} parts)"

        # standalone single-file archives
        for name in plain_rars:
            if name in consumed_plain:
                continue
            yield dirpath / name, [dirpath / name], f"{Path(name).stem} (single file)"


def extract_one(exe, console, first_part: Path, dry_run: bool) -> bool:
    dest = str(first_part.parent) + os.sep
    cmd = [exe, "x", "-y", "-o+", str(first_part), dest] if console else \
          [exe, "x", "-y", "-o+", "-ibck", str(first_part), dest]
    logging.info("EXTRACT %s -> %s", first_part.name, first_part.parent)
    if dry_run:
        return True
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                 text=True, encoding="utf-8", errors="replace")
    except Exception as e:
        logging.error("FAILED to start %s: %s", exe, e)
        return False
    if result.stdout:
        for line in result.stdout.splitlines():
            line = line.strip()
            if line:
                logging.info("  %s", line)
    if result.returncode != 0:
        logging.error("FAILED  %s (exit code %d)", first_part.name, result.returncode)
        return False
    return True


def maybe_delete_parts(parts, dry_run: bool, delete_originals: bool):
    if not delete_originals:
        return
    for p in parts:
        logging.info("DELETE %s", p)
        if not dry_run:
            p.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Find and extract every WinRAR archive set in a folder tree, in place.")
    parser.add_argument("source", help="Folder to scan (searched recursively)")
    parser.add_argument("--delete-originals", action="store_true",
                         help="After a successful extraction, delete the .rar part files. Off by default.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen, do nothing")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(message)s")

    src = Path(args.source)
    if not src.is_dir():
        logging.error("Source folder does not exist: %s", src)
        sys.exit(1)

    exe, console = find_winrar()
    if not exe and not args.dry_run:
        logging.error("WinRAR was not found. Install it from https://www.win-rar.com/ (the free trial works), "
                       "then try again.")
        sys.exit(1)

    sets = list(discover_archive_sets(src))
    if not sets:
        logging.info("No .rar archives found under %s", src)
        return
    logging.info("Found %d archive set(s).\n", len(sets))

    extracted = failed = 0
    for first_part, parts, label in sets:
        logging.info("---- %s", label)
        ok = extract_one(exe, console, first_part, args.dry_run)
        if ok:
            extracted += 1
            maybe_delete_parts(parts, args.dry_run, args.delete_originals)
        else:
            failed += 1

    logging.info("\nDone. extracted=%d failed=%d", extracted, failed)
    if failed:
        sys.exit(2)


if __name__ == "__main__":
    main()
