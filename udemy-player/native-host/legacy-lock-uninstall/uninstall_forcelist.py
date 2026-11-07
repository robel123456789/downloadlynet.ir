#!/usr/bin/env python3
"""Removes the force-install policy written by install_forcelist.py (Chrome then uninstalls that copy). Refuses while a lock is active."""
import ctypes, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lockcore as L
if os.name != "nt" or not ctypes.windll.shell32.IsUserAnAdmin():
    sys.exit("Run as Administrator on Windows.")
if L.view().get("active") or L.is_active(L.Store(L.default_state_dir()).read()):
    sys.exit("REFUSED: a lock is active.")
import winreg
for key in (r"SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist", r"SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist"):
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, key, 0, winreg.KEY_ALL_ACCESS) as k:
            winreg.DeleteValue(k, "7701")
    except OSError:
        pass
print("Force-install policy removed.")
