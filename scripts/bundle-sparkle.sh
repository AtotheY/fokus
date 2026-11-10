#!/bin/bash
set -euo pipefail
app=${1:?Pass the path to Fokus.app}
version=2.10.1
checksum=1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27
cache=target/sparkle
mkdir -p "$cache"
archive="$cache/archive.tar.xz"
if [[ ! -f "$archive" ]]; then
  curl -fsSL --retry 3 "https://github.com/sparkle-project/Sparkle/releases/download/$version/Sparkle-$version.tar.xz" -o "$archive.part"
  mv "$archive.part" "$archive"
fi
printf '%s  %s\n' "$checksum" "$archive" | shasum -a 256 -c -
tar -xJf "$archive" -C "$cache"
mkdir -p "$app/Contents/Frameworks"
ditto "$cache/Sparkle.framework" "$app/Contents/Frameworks/Sparkle.framework"
cp "$cache/LICENSE" "$app/Contents/Resources/licenses/Sparkle.txt"
