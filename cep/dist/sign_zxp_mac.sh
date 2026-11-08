#!/bin/bash
# Make a signed AURA.zxp for distribution (macOS). Needs ZXPSignCmd (Adobe CEP-Resources, "ZXPSignCMD")
# next to this file or on PATH. The self-signed certificate is created once (aura_cert.p12) and reused.
set -e
cd "$(dirname "$0")"
Z=./ZXPSignCmd; [ -x "$Z" ] || Z=ZXPSignCmd
PASS="${AURA_CERT_PASS:-change-this-password}"
[ -f aura_cert.p12 ] || "$Z" -selfSignedCert JP Tokyo AURA AURA "$PASS" aura_cert.p12
rm -f AURA.zxp
"$Z" -sign com.duyhuongngv2.aura AURA.zxp aura_cert.p12 "$PASS" -tsa http://timestamp.digicert.com
"$Z" -verify AURA.zxp
echo "AURA.zxp ready"
