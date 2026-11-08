@echo off
rem Make a signed AURA.zxp for distribution (Windows). Needs ZXPSignCmd.exe (Adobe CEP-Resources, "ZXPSignCMD")
rem next to this file or on PATH. The self-signed certificate is created once (aura_cert.p12) and reused.
cd /d "%~dp0"
set "Z=ZXPSignCmd.exe"
if "%AURA_CERT_PASS%"=="" set "AURA_CERT_PASS=change-this-password"
if not exist aura_cert.p12 %Z% -selfSignedCert JP Tokyo AURA AURA %AURA_CERT_PASS% aura_cert.p12
if exist AURA.zxp del AURA.zxp
%Z% -sign com.duyhuongngv2.aura AURA.zxp aura_cert.p12 %AURA_CERT_PASS% -tsa http://timestamp.digicert.com
%Z% -verify AURA.zxp
echo AURA.zxp ready
pause
