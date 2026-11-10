# Fokus for Mac

Open Fokus and choose **Enable blocking**. macOS requests administrator approval to install the local helper. Social media is enabled by default, including X, Reddit, Instagram, Facebook and LinkedIn. Working hours default to Monday–Friday, 9 AM–5 PM in the Mac’s local time zone.

- **Overview** has collapsible session groups. Switch a group on or off for the current session. Use an item’s lock for 1, 5 or 15 minutes of access. The time chip lets you block it again early.
- **Groups** lets you create groups, edit their defaults, paste domains, and choose installed Mac apps. Existing website lists migrate into an enabled group. Additional presets start off. The four editable presets cover social networks, gaming, shopping and adult sites. The domain files in `desktop/presets/` are bundled offline. They are curated from [HaGeZi](https://github.com/hagezi/dns-blocklists), [v2fly](https://github.com/v2fly/domain-list-community/tree/master/data) and [Similarweb’s category rankings](https://www.similarweb.com/top-websites/).
- **Activities** generates Minesweeper and Word Search boards on this Mac. It also includes 1,650 offline Lichess chess puzzles in 11 rating ranges. Each range draws 150 puzzles in random order before repeating. Drag or click to move, and use the left and right arrow keys to replay the moves so far. Each move is saved locally.
- **Daily shelf** opens official online puzzles and custom links. Each game has its own illustrated tile. Open it, check it off, or use Edit shelf to rearrange your routine. At least one completion earns a day in your local streak.
- **Working hours** supports selected weekdays and shifts that continue past midnight. The landscape shows how far you are into your scheduled workday. You can also start a timed session outside working hours.
- **Take a break** offers presets or a custom duration of 1–240 minutes, capped at the session end. Use a site’s menu to unblock just that site. Resume early or let the timer expire, even with Fokus closed.
- **Settings** (⌘,) includes twelve Dock icon finishes, system/light/dark modes, Storyroom and Moosik colour schemes, custom CSS themes, transparency, background blur and panel controls. Finder uses Ceramic.

## How blocking works

A small launchd helper maintains a marked section in the Mac’s hosts file. It blocks the selected hostname, its www form and common service aliases such as old.reddit.com and twitter.com. Add other subdomains individually. Existing browser connections and cached pages may survive a change until the tab or browser is reopened. Browsers that resolve names through a remote proxy may bypass hosts-based blocking.

The helper runs independently of the window and reads the local clock after waking. Rules live in the root-owned Fokus directory in /Library/Application Support. The installing user can edit them through a private Unix socket. Appearance settings stay in the local webview. The app does not collect browsing history.

Use **Settings → Blocker → Uninstall blocker** before removing Fokus to clear its hosts entries and remove the background service. An administrator can also run the bundled uninstall-helper.sh from the app’s Contents/Resources folder.

## Build on macOS

Install Xcode Command Line Tools, Node.js 22.13+ and stable Rust. Build on the architecture where the app will run.

```sh
npm ci
npm run build
open dist/Fokus.app
```

The build compiles the React/Radix UI, builds both Rust executables with Cargo’s locked dependencies, bundles the Tauri app, packages the Finder icon and verifies the ad-hoc code signature. Use `npm run icons` to regenerate artwork and icon finishes. The build also creates a zip in `dist/` for the current architecture. For public distribution, set `FOKUS_SIGN_IDENTITY` to your Developer ID Application identity and `FOKUS_NOTARY_PROFILE` to your notarytool keychain profile before building. The release process signs, notarizes and staples the app when configured.

Run `cargo test --locked --workspace` for rule, normalization, timer and hosts-file tests.

After building, run `python3 tests/helper.py` to check the packaged helper against a disposable hosts file, including a client that connects before sending its request.

## Everyday controls

The Mac menu bar shows the current session or break end time. Use it to reach session controls or add a website. Closing the window leaves the menu available. Quitting the app leaves the local helper running.

Click the lock beside a website or app for a timed exception. **Take a break** lets you choose the whole list or a single site. Resuming a whole-list break preserves existing single-site exceptions. Breaks stop at the end of the session. **Settings → Blocker → Pause before a break** adds an optional five-second pause.

**Finish early** ends the current work period, including an overnight shift. The next scheduled period starts normally. **Resume working hours** reverses an early finish. The hours editor previews when saved changes take effect.

Choose the shield beside a domain in Groups to compare the rule with the hostname resolution returned by macOS. A proxy, cached page or existing browser connection may differ. Pasting a URL into **Add site** previews the affected hostname and its aliases. Use ⌘N to open it from the keyboard.

## Comet tabs

When blocking first becomes active with Comet open, macOS asks whether Fokus can control Comet. Choose **Allow**. Fokus uses Comet’s Mac automation interface to replace matching tabs with a local page, including tabs serving cached content. The page’s **Unblock temporarily** button opens the existing site-break controls. Tab addresses are processed locally in memory.

Keep Fokus running in the menu bar for tab protection. Quitting leaves the system hosts rules active. A cached page can appear briefly before the next tab check. **Settings → Blocker** shows the Comet connection and links to macOS Automation settings if permission was denied.

Run `python3 tests/comet.py` for the Mac tab-matching and break regressions.

## Mac app blocking

Fokus checks the frontmost app while its menu bar process is running. If a selected app becomes active, Fokus hides its window and offers timed access. Downloads, calls, and other background tasks can continue. A Steam game with its own bundle identifier can be added separately when installed in a scanned Applications folder. Quitting Fokus stops app and Comet protection. The website helper continues independently.

## Download and releases

[Download the latest Apple Silicon ZIP](https://github.com/AtotheY/fokus/releases/latest/download/Fokus-arm64.zip) or [browse releases and checksums](https://github.com/AtotheY/fokus/releases). The public preview is ad-hoc signed. When upgrading from an early preview, quit the old app, replace it in Applications, and enable the helper in the new version. Existing blocking rules stay in the shared Fokus support directory.

To publish a release, update the package, Cargo, Tauri and Info.plist versions and both lockfiles. Push a matching stable version tag, such as `v0.4.2`. The macOS workflow builds and verifies the app before publishing the ZIP and SHA256SUMS.txt together. The website uses GitHub’s latest-release asset URL.

To build the marketing site, run `npm ci && npm run build:site`. A Cloudflare deployment configuration template is in `site/wrangler.example.jsonc`. Copy it to `site/wrangler.jsonc` and configure your own database and domains before deploying.

## Private usage reports

In Cloudflare D1 Studio, open the `fokus-site-metrics` database. Select `daily_summary` for daily totals or `website_traffic` for the breakdown by page and referral source. For example:

```sql
SELECT * FROM daily_summary ORDER BY utc_date DESC LIMIT 30;
SELECT source, SUM(entries) AS entries, SUM(download_clicks) AS download_clicks
FROM website_traffic WHERE utc_date >= date('now','-29 days')
GROUP BY source ORDER BY entries DESC;
```

An entry starts a tab visit. Page loads, including refreshes, count separately. Earlier site measurements counted a page only once per tab visit. Sources are broad categories; private or missing referrers often appear as direct/unknown. New traffic uses aggregate buckets without visitor IDs or analytics cookies. Optional setup receipts are independent. Web measurement respects GPC, DNT and the switch on the privacy page.

Starting with 0.4.5, the app counts an interacting Mac user profile at most once per UTC day. It sends an empty request and keeps the last counted date on the Mac; the database stores just the date and total. No identifiers link days or connect a Mac to a web visit. Settings → Privacy disables the counter. Test workspaces, debug builds and launches with `FOKUS_DISABLE_ACTIVE_COUNT=1` skip it. Background protection alone, offline devices, older releases and opt-outs are not measured. A blank active count means no report, not proof nobody used Fokus. Counts are estimates; the public write endpoints are not authenticated. Download clicks are not completed installs.

Apply `site/schema.sql` to the bound D1 database before deploying the site. Keep Worker invocation logs and tracing off. Run `node --test tests/metrics.mjs` (Node 22.13+) to exercise the collectors locally; do not submit synthetic counts to production.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE) and [third-party notices](NOTICE.md).
