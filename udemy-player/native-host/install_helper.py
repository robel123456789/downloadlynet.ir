#!/usr/bin/env python3
"""Registers the udemy player helper (merge subtitles / extract RAR) for Chrome, Edge, Brave and Chromium for the CURRENT user (no admin needed).
Run:   python install_helper.py            (install)       python install_helper.py --uninstall
Keep this folder where it is after installing - the registration points at it."""
import json, os, sys

HOST = "com.zeroday.merge"
EXT_ID = "lnngkjcfimfemjaapjalhniomgdgadfm"          # fixed by the "key" in extension/manifest.json
HERE = os.path.dirname(os.path.abspath(__file__))
KEYS = (r"Software\Google\Chrome\NativeMessagingHosts", r"Software\Microsoft\Edge\NativeMessagingHosts",
        r"Software\BraveSoftware\Brave-Browser\NativeMessagingHosts", r"Software\Chromium\NativeMessagingHosts")


def main():
    if os.name != "nt":
        sys.exit("This installer is for Windows. On Linux/macOS put a manifest named %s.json in your browser's NativeMessagingHosts folder." % HOST)
    import winreg
    if "--uninstall" in sys.argv:
        for k in KEYS:
            try:
                winreg.DeleteKey(winreg.HKEY_CURRENT_USER, k + "\\" + HOST)
            except OSError:
                pass
        print("Helper unregistered.")
        return
    bat = os.path.join(HERE, "merge_host.bat")
    with open(bat, "w", newline="\r\n") as fh:
        fh.write('@echo off\n"%s" -u "%%~dp0merge_host.py"\n' % sys.executable)
    mpath = os.path.join(HERE, HOST + ".json")
    with open(mpath, "w", encoding="utf-8") as fh:
        json.dump({"name": HOST, "description": "udemy player helper (merge subtitles, extract RAR)", "path": bat, "type": "stdio",
                   "allowed_origins": ["chrome-extension://%s/" % EXT_ID]}, fh, indent=2)
    for k in KEYS:
        with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, k + "\\" + HOST, 0, winreg.KEY_ALL_ACCESS) as h:
            winreg.SetValueEx(h, "", 0, winreg.REG_SZ, mpath)
    print("Helper registered for this user.\nRestart the browser, then use Extract RAR / Merge subtitles in the library.")


if __name__ == "__main__":
    main()
