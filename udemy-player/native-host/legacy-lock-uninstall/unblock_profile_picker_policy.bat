@echo off
net session >nul 2>nul || (echo Run this as Administrator & pause & exit /b 1)
set K=HKLM\SOFTWARE\Policies\Google\Chrome
for %%V in (BrowserGuestModeEnabled BrowserAddPersonEnabled IncognitoModeAvailability ProfilePickerOnStartupAvailability) do reg delete "%K%" /v %%V /f >nul 2>nul
echo Policies removed. Restart Chrome.
pause
