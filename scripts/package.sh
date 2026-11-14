#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:ui
command -v cargo >/dev/null || { echo "Install stable Rust and put cargo on PATH." >&2; exit 1; }
# Rust includes source locations in panic messages, including locations in dependencies.
sep=$'\x1f'
flags="${CARGO_ENCODED_RUSTFLAGS:-}"
if [[ -z "$flags" && -n "${RUSTFLAGS:-}" ]]; then
  flags="${RUSTFLAGS// /$sep}"
fi
for mapping in "$HOME=/home/build" "$PWD=/src/fokus" "${CARGO_HOME:-$HOME/.cargo}=/cargo" "$(rustc --print sysroot)=/rust"; do
  flags="${flags:+$flags$sep}--remap-path-prefix=$mapping"
done
export CARGO_ENCODED_RUSTFLAGS="$flags"
export COPYFILE_DISABLE=1
cargo build --workspace --locked --release --features custom-protocol
app="dist/Fokus.app"
mac="$app/Contents/MacOS"
res="$app/Contents/Resources"
rm -rf "$app"
mkdir -p "$mac" "$res" target/Fokus.iconset
install -m 755 target/release/fokus "$mac/Fokus"
install -m 755 target/release/fokus-helper "$mac/fokus-helper"
/usr/bin/strip -S -x "$mac/Fokus" "$mac/fokus-helper"
mkdir -p "$res/Comet"
cp browser/comet-page/* "$res/Comet/"
cp browser/watch-comet.js "$res/"
cp -R raycast "$res/Raycast"
cp -R public/icons "$res/"
cp -R themes "$res/"
cp scripts/{install,uninstall}-helper.sh scripts/migrate-preview.sh "$res/"
mkdir -p "$res/licenses"
cp LICENSE NOTICE.md licenses/*.txt "$res/licenses/"
cp desktop/Info.plist "$app/Contents/Info.plist"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" desktop/icons/icon.png --out "target/Fokus.iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" desktop/icons/icon.png --out "target/Fokus.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns target/Fokus.iconset -o "$res/Fokus.icns"
bash scripts/bundle-sparkle.sh "$app"
sign=(--force --sign "${FOKUS_SIGN_IDENTITY:--}")
if [[ -n "${FOKUS_SIGN_IDENTITY:-}" ]]; then
  sign+=(--options runtime --timestamp)
  # Sign nested code inside out for hardened runtime library validation.
  framework="$app/Contents/Frameworks/Sparkle.framework"
  while IFS= read -r item; do
    codesign "${sign[@]}" --preserve-metadata=entitlements "$item"
  done < <(find "$framework" -depth \( -name '*.xpc' -o -name '*.app' -o -name 'Autoupdate' -o -name '*.framework' \))
fi
codesign "${sign[@]}" "$mac/fokus-helper"
codesign "${sign[@]}" --entitlements desktop/entitlements.plist "$app"
codesign --verify --strict --deep "$app"
zip="dist/Fokus-$(uname -m).zip"
ditto --norsrc --noextattr --noqtn -c -k --keepParent "$app" "$zip"
if [[ -n "${FOKUS_NOTARY_PROFILE:-}" ]]; then
  xcrun notarytool submit "$zip" --keychain-profile "$FOKUS_NOTARY_PROFILE" --wait
  xcrun stapler staple "$app"
  xcrun stapler validate "$app"
  ditto --norsrc --noextattr --noqtn -c -k --keepParent "$app" "$zip"
fi
echo "Built $app and $zip"
