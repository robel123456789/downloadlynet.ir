# Udemy Player v8

An offline course library and video-player Chrome extension with subtitle merging, RAR archive extraction, and curriculum management.

> **Project status:** Community documentation and cleanup in progress.

## ✨ Features

- **Offline Course Library** – Organize and access locally stored course files.
- **Video Player** – Play supported course videos.
- **Subtitle Merging** – Merge video files with matching subtitles.
- **RAR Extraction** – Extract single and multipart RAR archives.
- **Curriculum Builder** – Organize course curriculum.
- **Modern Interface** – Customizable themes and player interface.

## 📋 Requirements

Before installation, prepare:

- Windows 10 or Windows 11.
- Google Chrome 109 or newer.
- Python 3.
- FFmpeg.
- WinRAR or UnRAR for archive extraction.

## 📥 Installation

### Step 1 – Download the repository

1. Open this GitHub repository.
2. Click **Code**.
3. Select **Download ZIP**.
4. Extract the ZIP file to a permanent folder.

### Step 2 – Install the Chrome extension

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension` folder.
6. Confirm that the extension appears in Chrome.

### Step 3 – Install required software

Install the following:

- Python 3: https://www.python.org/downloads/
- FFmpeg: https://ffmpeg.org/download.html
- WinRAR: https://www.win-rar.com/

Restart Chrome after installing the dependencies.

### Step 4 – Configure Native Messaging

1. Open the extracted project folder.
2. Navigate to `native-host`.
3. Run `install_helper.bat` if provided.
4. Follow the installation instructions.
5. Confirm that the native messaging host is registered.

The native host connects the Chrome extension to the local Python helper.

## 🎬 Using the Player

1. Open the extension from Chrome.
2. Access the course library.
3. Select your locally stored course.
4. Open the video player.
5. Use the available playback and curriculum features.

## 📝 Subtitle Merging

The native helper supports matching video and subtitle files.

Supported video formats include:

- MP4
- MKV
- AVI
- MOV
- WMV
- FLV
- WebM

Supported subtitle formats include:

- VTT
- SRT
- ASS
- SSA
- SUB

FFmpeg is required for subtitle merging.

## 📦 RAR Extraction

The extraction helper supports:

- Standard `.rar` archives.
- Multipart `.part1.rar` archives.
- Legacy `.r00`, `.r01` archive sets.

You can perform a preview using:

```powershell
python extract_course_rars.py "C:\Courses" --dry-run
```

To extract:

```powershell
python extract_course_rars.py "C:\Courses"
```

Archive deletion is optional. Do not enable deletion until you have verified the extracted files.

## 🔧 Troubleshooting

**Extension does not appear**

- Check that Developer mode is enabled.
- Select the correct `extension` folder.
- Check Chrome's extension error messages.

**Native messaging connection fails**

- Verify Python installation.
- Verify that the native host is registered.
- Restart Chrome.
- Check the native-host installation instructions.

**FFmpeg not found**

- Install FFmpeg.
- Add its `bin` directory to Windows PATH.
- Restart Chrome.

**RAR extraction fails**

- Verify WinRAR installation.
- Check that all archive parts are present.
- Make sure you have sufficient disk space.


## 📌 Version

**Version:** 8.0

**Platform:** Google Chrome / Windows

**Project type:** Browser extension + Python native messaging host
