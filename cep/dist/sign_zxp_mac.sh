#!/bin/bash
# Make a signed LyricWave.zxp for distribution (macOS). Needs ZXPSignCmd (Adobe CEP-Resources, "ZXPSignCMD")
# next to this file or on PATH. The self-signed certificate is created once (lyricwave_cert.p12) and reused.
set -e
cd "$(dirname "$0")"
Z=./ZXPSignCmd; [ -x "$Z" ] || Z=ZXPSignCmd
PASS="${LyricWave_CERT_PASS:-change-this-password}"
[ -f lyricwave_cert.p12 ] || "$Z" -selfSignedCert JP Tokyo LyricWave LyricWave "$PASS" lyricwave_cert.p12
rm -f LyricWave.zxp
"$Z" -sign com.duyhuongngv2.lyricwave LyricWave.zxp lyricwave_cert.p12 "$PASS" -tsa http://timestamp.digicert.com
"$Z" -verify LyricWave.zxp
echo "LyricWave.zxp ready"
