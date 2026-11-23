@echo off
rem LyricWave Studio CEP panel - install for the current user (Windows).
rem Copies com.duyhuongngv2.lyricwave into the CEP extensions folder and allows unsigned panels (PlayerDebugMode).
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.duyhuongngv2.lyricwave"
if exist "%DEST%" rmdir /S /Q "%DEST%"
xcopy /E /I /Y /Q "%~dp0com.duyhuongngv2.lyricwave" "%DEST%" >nul
for %%v in (10 11 12 13 14) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo Installed: %DEST%
echo Restart After Effects, then open Window ^> Extensions ^> LyricWave Studio.
pause
