@echo off
rem Make a signed LyricWave.zxp for distribution (Windows). Needs ZXPSignCmd.exe (Adobe CEP-Resources, "ZXPSignCMD")
rem next to this file or on PATH. The self-signed certificate is created once (lyricwave_cert.p12) and reused.
cd /d "%~dp0"
set "Z=ZXPSignCmd.exe"
if "%LyricWave_CERT_PASS%"=="" set "LyricWave_CERT_PASS=change-this-password"
if not exist lyricwave_cert.p12 %Z% -selfSignedCert JP Tokyo LyricWave LyricWave %LyricWave_CERT_PASS% lyricwave_cert.p12
if exist LyricWave.zxp del LyricWave.zxp
%Z% -sign com.duyhuongngv2.lyricwave LyricWave.zxp lyricwave_cert.p12 %LyricWave_CERT_PASS% -tsa http://timestamp.digicert.com
%Z% -verify LyricWave.zxp
echo LyricWave.zxp ready
pause
