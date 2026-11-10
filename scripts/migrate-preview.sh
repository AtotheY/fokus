#!/bin/bash
# Before the first public build opens its webview, preserve the previous profile.
set -eu
for preview in /Library/LaunchDaemons/*.fokus.plist; do
  [[ -f "$preview" ]] || continue
  program=$(/usr/libexec/PlistBuddy -c 'Print :ProgramArguments:0' "$preview" 2>/dev/null) || continue
  [[ "$program" == "/Library/Application Support/Fokus/fokus-helper" ]] || continue
  old=$(/usr/libexec/PlistBuddy -c 'Print :Label' "$preview")
  [[ "$old" =~ ^[a-zA-Z0-9.-]+$ && "$preview" == "/Library/LaunchDaemons/$old.plist" ]] || continue
  for root in "$HOME/Library/Application Support" "$HOME/Library/WebKit"; do
    target="$root/dev.usefokus.app"
    [[ -d "$root/$old" && ! -e "$target" ]] || continue
    temp=$(/usr/bin/mktemp -d "$root/.fokus-upgrade.XXXXXX")
    trap '/bin/rm -rf "$temp"' EXIT
    /usr/bin/ditto "$root/$old" "$temp"
    /bin/mv -n "$temp" "$target"
  done
done
