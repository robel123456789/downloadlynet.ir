@echo off
setlocal
cd /d "%~dp0"
set PY=
where py >nul 2>nul && (py -3 -c "import sys" >nul 2>nul && set PY=py -3)
if not defined PY (where python >nul 2>nul && set PY=python)
if not defined PY (echo Python 3 was not found. Install it from https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^) & pause & exit /b 1)
%PY% uninstall_lock.py %*
pause
