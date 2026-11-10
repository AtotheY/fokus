#!/bin/bash
# Sign only the verified release ZIP. The output URL is pinned to this tag.
set -euo pipefail
tag=${1:?Pass the release tag}
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
version=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' dist/Fokus.app/Contents/Info.plist)
[[ "$tag" == "v$version" ]]
stage=$(mktemp -d)
trap 'rm -r "$stage"' EXIT
cp dist/Fokus-arm64.zip "$stage/"
key=(--account dev.usefokus.app.updates)
if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  : "${FOKUS_SPARKLE_KEY:?Missing Fokus release signing key}"
  key=(--ed-key-file -)
fi
prefix="https://github.com/AtotheY/fokus/releases/download/$tag/"
target/sparkle/bin/generate_appcast "${key[@]}" --maximum-deltas 0 --download-url-prefix "$prefix" -o "$stage/appcast.xml" "$stage" <<< "${FOKUS_SPARKLE_KEY:-}"
# Fail the release if Sparkle skipped a package with an invalid signing key.
python3 - "$stage/appcast.xml" "$prefix" <<'PY'
import base64
from pathlib import Path
import plistlib
import sys
import xml.etree.ElementTree as ET
feed = ET.parse(sys.argv[1])
items = feed.findall('./channel/item')
if len(items) != 1:
    raise SystemExit('Expected one update in the signed appcast')
ns = '{http://www.andymatuschak.org/xml-namespaces/sparkle}'
zip_path = Path('dist/Fokus-arm64.zip')
app = plistlib.loads(Path('dist/Fokus.app/Contents/Info.plist').read_bytes())
item = items[0]
assert item.findtext(ns+'version') == app['CFBundleVersion']
assert item.findtext(ns+'shortVersionString') == app['CFBundleShortVersionString']
enclosure = item.find('enclosure')
assert enclosure.get('url') == sys.argv[2]+zip_path.name
assert int(enclosure.get('length')) == zip_path.stat().st_size
assert len(base64.b64decode(enclosure.get(ns+'edSignature'),validate=True)) == 64
PY
cp "$stage/appcast.xml" dist/appcast.xml
