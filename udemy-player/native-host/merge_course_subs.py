#!/usr/bin/env python3
r"""
merge_course_subs.py

Recursively walks ANY course/folder tree (Udemy-style or otherwise), finds
video files and same-named subtitle files that sit next to each other in the
same folder, and produces a mirrored output tree where each matched
video+subtitle pair is merged into one .mkv file (subtitle embedded as a
soft/selectable track -- video and audio are stream-copied, not re-encoded,
so it's fast and lossless).

Everything else -- unmatched videos, unmatched subtitles, .txt, .html, or
any other file -- is copied through as-is, in the same relative location.

Nothing about folder names, course names, or lecture numbering is hardcoded;
matching is purely "same filename stem in the same folder", so it works for
any course structure.

Requirements:
    - Python 3.8+
    - ffmpeg installed and available on PATH
      (Windows: https://ffmpeg.org/download.html, then add its /bin to PATH,
       or `winget install ffmpeg` / `choco install ffmpeg`)

Usage:
    python merge_course_subs.py "SOURCE_DIR" "OUTPUT_DIR"
    python merge_course_subs.py "SOURCE_DIR" "OUTPUT_DIR" --dry-run
    python merge_course_subs.py "SOURCE_DIR" "OUTPUT_DIR" --sub-codec srt -v

Example (matching the folder you pasted):
    python merge_course_subs.py ^
        "D:\Udemy develop your own kernel all  in one\Developing a Multithreaded Kernel From Scratch!" ^
        "D:\Udemy develop your own kernel all  in one\MERGED"
"""

import argparse
import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path

VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts"}
SUBTITLE_EXTS = {".vtt", ".srt", ".ass", ".ssa", ".sub"}


def find_ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if not path:
        logging.error(
            "ffmpeg not found on PATH. Install it from https://ffmpeg.org/download.html "
            "(or `winget install ffmpeg`) and make sure it's on PATH."
        )
        sys.exit(1)
    return path


def merge_video_subtitle(ffmpeg_bin, video: Path, subtitle: Path, out_file: Path,
                          sub_codec: str, dry_run: bool) -> bool:
    out_file.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg_bin, "-y",
        "-i", str(video),
        "-i", str(subtitle),
        "-map", "0:v",
        "-map", "0:a?",
        "-map", "1:s",
        "-c:v", "copy",
        "-c:a", "copy",
        "-c:s", sub_codec,
        "-metadata:s:s:0", "language=eng",
        str(out_file),
    ]
    logging.info("MERGE  %-40s + %-25s -> %s", video.name, subtitle.name, out_file)
    if dry_run:
        return True
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if result.returncode != 0:
        logging.error("ffmpeg FAILED for %s\n%s", video, result.stdout[-2000:])
        return False
    return True


def copy_file(src: Path, dst: Path, dry_run: bool, skip_existing: bool) -> None:
    if src.resolve() == dst.resolve():
        # in-place mode with no output dir: source == destination, nothing to do
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    if skip_existing and dst.exists():
        return
    logging.info("COPY   %-40s -> %s", src.name, dst)
    if dry_run:
        return
    shutil.copy2(src, dst)


def maybe_delete_originals(video: Path, subtitle: Path, dry_run: bool, delete_originals: bool) -> None:
    if not delete_originals:
        return
    for f in (video, subtitle):
        logging.info("DELETE %s", f)
        if not dry_run:
            f.unlink(missing_ok=True)


def process_directory(root_dir: Path, out_root: Path, ffmpeg_bin: str, sub_codec: str,
                       dry_run: bool, skip_existing: bool, delete_originals: bool = False) -> dict:
    stats = {"merged": 0, "copied": 0, "skipped": 0, "failed": 0}

    for dirpath_str, _dirnames, filenames in os.walk(root_dir):
        dirpath = Path(dirpath_str)
        rel_dir = dirpath.relative_to(root_dir)
        out_dir = out_root / rel_dir

        videos: dict[str, list[Path]] = {}
        subs: dict[str, list[Path]] = {}
        others: list[Path] = []

        for name in sorted(filenames):
            p = dirpath / name
            ext = p.suffix.lower()
            stem = p.stem
            if ext in VIDEO_EXTS:
                videos.setdefault(stem, []).append(p)
            elif ext in SUBTITLE_EXTS:
                subs.setdefault(stem, []).append(p)
            else:
                others.append(p)

        consumed_stems = set()

        for stem, vids in videos.items():
            if stem in subs:
                video = vids[0]
                subtitle = subs[stem][0]
                out_file = out_dir / f"{stem}.mkv"
                if skip_existing and out_file.exists():
                    logging.info("SKIP   %s (already exists)", out_file)
                    stats["skipped"] += 1
                else:
                    ok = merge_video_subtitle(ffmpeg_bin, video, subtitle, out_file, sub_codec, dry_run)
                    stats["merged" if ok else "failed"] += 1
                    if ok:
                        maybe_delete_originals(video, subtitle, dry_run, delete_originals)
                consumed_stems.add(stem)
                # any extra same-stem duplicates just get copied through untouched
                for extra in vids[1:] + subs[stem][1:]:
                    copy_file(extra, out_dir / extra.name, dry_run, skip_existing)
                    stats["copied"] += 1
            else:
                for v in vids:
                    copy_file(v, out_dir / v.name, dry_run, skip_existing)
                    stats["copied"] += 1

        for stem, s_list in subs.items():
            if stem in consumed_stems:
                continue
            for s in s_list:
                copy_file(s, out_dir / s.name, dry_run, skip_existing)
                stats["copied"] += 1

        for o in others:
            copy_file(o, out_dir / o.name, dry_run, skip_existing)
            stats["copied"] += 1

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Merge every video+subtitle pair found anywhere in a folder tree; "
                     "mirror everything else unchanged into the output folder."
    )
    parser.add_argument("source", help="Source root directory (any structure)")
    parser.add_argument("output", nargs="?", default=None,
                         help="Output directory (mirrors source structure). "
                              "Omit this (or use --in-place) to merge videos directly "
                              "into their existing folders, right next to the originals.")
    parser.add_argument("--in-place", action="store_true",
                         help="Write merged .mkv files directly next to the source files "
                              "instead of building a separate output tree. No output folder "
                              "argument is needed/used with this flag.")
    parser.add_argument("--delete-originals", action="store_true",
                         help="After a successful merge, delete the original video+subtitle "
                              "files. Off by default -- originals are kept untouched. "
                              "Only ever deletes files that were successfully merged.")
    parser.add_argument("--sub-codec", default="srt", choices=["srt", "webvtt", "ass", "copy"],
                         help="Subtitle codec to store inside the .mkv (default: srt -- most compatible)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen, do nothing")
    parser.add_argument("--skip-existing", action="store_true",
                         help="Don't redo merges/copies whose output already exists (resume support)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(message)s")

    if args.in_place and args.output:
        logging.error("Don't pass an output folder together with --in-place -- pick one.")
        sys.exit(1)
    if not args.in_place and not args.output:
        logging.error("Either pass an OUTPUT folder, or use --in-place to merge alongside the originals.")
        sys.exit(1)

    src = Path(args.source)
    out = src if args.in_place else Path(args.output)
    if not src.is_dir():
        logging.error("Source directory does not exist: %s", src)
        sys.exit(1)
    if args.in_place:
        logging.info("In-place mode: merged .mkv files will be written next to the originals in %s\n", src)

    ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
    if not args.dry_run:
        ffmpeg_bin = find_ffmpeg()

    stats = process_directory(src, out, ffmpeg_bin, args.sub_codec, args.dry_run,
                               args.skip_existing, args.delete_originals)

    logging.info(
        "\nDone. merged=%d  copied=%d  skipped=%d  failed=%d",
        stats["merged"], stats["copied"], stats["skipped"], stats["failed"],
    )
    if stats["failed"]:
        sys.exit(2)


if __name__ == "__main__":
    main()
