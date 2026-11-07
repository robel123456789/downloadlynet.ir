#!/usr/bin/env python3
"""EthioLock uninstaller (v5.0).  Run as Administrator / root from the ORIGINAL package folder (not from the installed copy).
It REFUSES while a lock is active - judged by the lock service's status AND by every stored copy of the lock record.
If the service is not running it tries to start it first, so a stopped service cannot be used to look 'unlocked'."""
import ctypes, os, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lockcore as L, lockos as O          # noqa: E402

WIN = os.name == "nt"
NOWIN = 0x08000000 if WIN else 0
PROG = os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"), "EthioPlanner") if WIN else "/opt/ethioplanner"
STATE = L.default_state_dir()


def sh(*c):
    return subprocess.run(list(c), capture_output=True, text=True, creationflags=NOWIN)


def admin():
    return bool(ctypes.windll.shell32.IsUserAnAdmin()) if WIN else os.geteuid() == 0


def locked():
    be = O.make_backend(STATE, L.Store(STATE).cfg())
    rec = L.Store(STATE, be.mirrors()).read()
    return L.view(STATE).get("active") or L.is_active(rec), rec


def main():
    if not admin():
        if WIN:
            ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join('"%s"' % a for a in [os.path.abspath(__file__)] + sys.argv[1:] + ["--elevated"]), None, 1)
        else:
            os.execvp("sudo", ["sudo", sys.executable, os.path.abspath(__file__)] + sys.argv[1:])
        return 0
    try:
        act, rec = locked()
        if act and not L.view(STATE).get("daemon"):
            print("Lock service is not answering - starting it to get a trusted answer...")
            sh(*(["schtasks", "/Run", "/TN", "EthioLockd"] if WIN else ["systemctl", "start", "ethiolockd.service"]))
            time.sleep(8)
            act, rec = locked()
        if act:
            end = time.strftime("%H:%M", time.localtime(int(rec.get("endTs", 0)) / 1000))
            print("\nREFUSED: a focus lock is active (until about %s). The uninstaller will not run while a lock is active.\n"
                  "Nothing was changed. Study - it ends by itself." % end)
            return 1
        print("No lock is active. Removing EthioLock...")
        be = O.make_backend(STATE, L.Store(STATE).cfg())
        be.release()                                   # undo any leftover ACL / hosts / policy
        if WIN:
            for t in ("EthioLockWatch", "EthioLockd", "FocusGuard"):
                sh("schtasks", "/End", "/TN", t); sh("schtasks", "/Delete", "/F", "/TN", t)
            sh("taskkill", "/F", "/IM", "pythonw.exe", "/FI", "WINDOWTITLE eq EthioLock*")
            import winreg
            for key in (r"SOFTWARE\Google\Chrome\NativeMessagingHosts", r"SOFTWARE\Microsoft\Edge\NativeMessagingHosts",
                        r"SOFTWARE\BraveSoftware\Brave-Browser\NativeMessagingHosts", r"SOFTWARE\Chromium\NativeMessagingHosts"):
                try: winreg.DeleteKey(winreg.HKEY_LOCAL_MACHINE, key + "\\" + "com.zeroday.merge")
                except OSError: pass
            try: winreg.DeleteKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\EthioLock")
            except OSError: pass
            for p in (os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "ethiolock.dat"),):
                try: os.remove(p)
                except OSError: pass
            sh("icacls", PROG, "/reset", "/T", "/C", "/Q")
        else:
            sh("systemctl", "disable", "--now", "ethiolockd.service", "ethiolock-watch.timer")
            for p in ("/etc/systemd/system/ethiolockd.service", "/etc/systemd/system/ethiolock-watch.service", "/etc/systemd/system/ethiolock-watch.timer",
                      "/Library/LaunchDaemons/com.ethiolock.daemon.plist", "/etc/ethiolock/lock.mirror.json"):
                try: os.remove(p)
                except OSError: pass
            sh("launchctl", "bootout", "system/com.ethiolock.daemon")
        shutil.rmtree(PROG, ignore_errors=True)
        shutil.rmtree(STATE, ignore_errors=True)
        print("Removed. (A force-install policy, if you set one with install_forcelist.py, is removed by uninstall_forcelist.py.)")
        return 0
    finally:
        if "--elevated" in sys.argv:
            input("\nPress Enter to close...")


if __name__ == "__main__":
    sys.exit(main())
