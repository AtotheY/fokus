mod groups;
#[cfg(windows)]
pub mod windows_ipc;
use chrono::{DateTime, Datelike, Duration, Local, TimeZone, Timelike};
pub use groups::{Group, GroupEdit, MacApp};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::{fs, io::Write, path::Path};

pub const SERVICE: &str = "/Library/Application Support/Fokus";
pub const SOCKET: &str = "/var/run/dev.usefokus.app.sock";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub enabled: bool,
    pub days: Vec<u32>, // Monday is zero.
    pub start: u32,
    pub end: u32,
}
impl Schedule {
    pub fn active<T: TimeZone>(&self, at: DateTime<T>) -> bool {
        if !self.enabled {
            return false;
        }
        let day = at.weekday().num_days_from_monday();
        let mins = at.hour() * 60 + at.minute();
        if self.start < self.end {
            self.days.contains(&day) && (self.start..self.end).contains(&mins)
        } else {
            (self.days.contains(&day) && mins >= self.start)
                || (self.days.contains(&((day + 6) % 7)) && mins < self.end)
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Rules {
    #[serde(default)]
    pub groups: Vec<Group>,
    pub sites: Vec<String>,
    pub schedule: Schedule,
    #[serde(default)]
    pub skipped_until: i64,
    pub focus_until: i64,
    pub break_until: i64,
    pub site_breaks: BTreeMap<String, i64>,
}
impl Default for Rules {
    fn default() -> Self {
        let groups = groups::starter_groups(None);
        Self {
            sites: groups[0].sites.clone(),
            groups,
            schedule: Schedule {
                enabled: true,
                days: (0..5).collect(),
                start: 540,
                end: 1020,
            },
            skipped_until: 0,
            focus_until: 0,
            break_until: 0,
            site_breaks: BTreeMap::new(),
        }
    }
}
pub fn domain(raw: &str) -> Result<String, String> {
    let input = raw.trim();
    let err = || "Enter a website such as example.com.".to_owned();
    if input.len() > 2048 || input.chars().any(|c| c.is_whitespace() || c == '\\') {
        return Err(err());
    }
    let url = url::Url::parse(
        if input.contains("://") {
            input.to_owned()
        } else {
            format!("https://{input}")
        }
        .as_str(),
    )
    .map_err(|_| err())?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(err());
    }
    let Some(url::Host::Domain(host)) = url.host() else {
        return Err(err());
    };
    let host = host
        .trim_end_matches('.')
        .strip_prefix("www.")
        .unwrap_or(host.trim_end_matches('.'));
    if host.len() > 253
        || !host.contains('.')
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || !host.split('.').all(|s| {
            !s.is_empty()
                && s.len() <= 63
                && !s.starts_with('-')
                && !s.ends_with('-')
                && s.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
        })
    {
        return Err(err());
    }
    Ok(host.into())
}

#[derive(Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    Group { change: GroupEdit },
    Add { site: String },
    Remove { site: String },
    Schedule { schedule: Schedule },
    Focus { minutes: u32 },
    Break { minutes: u32, site: Option<String> },
    Resume { site: Option<String> },
    EndFocus,
    FinishEarly,
    ResumeHours,
}
impl Rules {
    pub fn apply(&mut self, action: Action, now: i64) -> Result<(), String> {
        let at = Local
            .timestamp_opt(now, 0)
            .single()
            .ok_or("Invalid local time.")?;
        let until = |minutes: u32| {
            if (1..=240).contains(&minutes) {
                Ok(now + i64::from(minutes) * 60)
            } else {
                Err("Choose a duration from 1 to 240 minutes.")
            }
        };
        self.ensure_groups();
        match action {
            Action::Group { change } => self.edit_group(change, at)?,
            Action::Add { site } => self.edit_group(
                GroupEdit::AddSites {
                    id: self.groups[0].id,
                    sites: vec![site],
                },
                at,
            )?,
            Action::Remove { site } => {
                for group in &mut self.groups {
                    group.sites.retain(|s| s != &site);
                }
                self.site_breaks.remove(&site);
                self.sites = self.enabled_items(now, false);
            }
            Action::Schedule { schedule } => {
                if schedule.start >= 1440
                    || schedule.end >= 1440
                    || schedule.start == schedule.end
                    || schedule.days.is_empty()
                    || schedule.days.len() > 7
                    || schedule.days.iter().any(|d| *d > 6)
                {
                    return Err("Choose at least one day and different start and end times.".into());
                }
                if self.schedule != schedule {
                    for g in &mut self.groups {
                        g.choice_until = 0;
                    }
                    self.schedule = schedule;
                    self.skipped_until = 0;
                    let end = self.session_end(at).unwrap_or(now);
                    self.break_until = self.break_until.min(end);
                    for deadline in self.site_breaks.values_mut() {
                        *deadline = (*deadline).min(end);
                    }
                }
            }
            Action::Focus { minutes } => {
                if !self.focusing(at) {
                    for g in &mut self.groups {
                        g.choice_until = 0;
                    }
                }
                self.focus_until = until(minutes)?;
                self.break_until = 0;
                self.site_breaks.clear();
            }
            Action::EndFocus => {
                self.focus_until = 0;
                if !self.scheduled(at) {
                    for g in &mut self.groups {
                        g.choice_until = 0;
                    }
                    self.break_until = 0;
                    self.site_breaks.clear();
                }
            }
            Action::FinishEarly => {
                if !self.scheduled(at) {
                    return Err("These working hours have already ended.".into());
                }
                self.skipped_until = self
                    .transition(at)
                    .ok_or("Could not find the end of these working hours.")?;
                self.focus_until = 0;
                self.break_until = 0;
                self.site_breaks.clear();
                for g in &mut self.groups {
                    g.choice_until = 0;
                }
            }
            Action::ResumeHours => {
                self.skipped_until = 0;
            }
            Action::Break { minutes, site } => {
                let end =
                    until(minutes)?.min(self.session_end(at).ok_or("This session has ended.")?);
                if let Some(d) = site {
                    if !self.enabled_items(now, d.starts_with("app:")).contains(&d) {
                        return Err("This site has been removed.".into());
                    }
                    self.site_breaks.insert(d, end);
                } else {
                    self.break_until = end;
                }
            }
            Action::Resume { site } => {
                if let Some(d) = site {
                    self.site_breaks.remove(&d);
                } else {
                    self.break_until = 0;
                }
            }
        }
        self.site_breaks.retain(|_, t| *t > now);
        Ok(())
    }
    pub fn focusing(&self, at: DateTime<Local>) -> bool {
        self.scheduled(at) || self.focus_until > at.timestamp()
    }
    pub fn scheduled(&self, at: DateTime<Local>) -> bool {
        at.timestamp() >= self.skipped_until && self.schedule.active(at)
    }
    pub fn session_end(&self, at: DateTime<Local>) -> Option<i64> {
        if self.focus_until > at.timestamp() {
            let end = Local.timestamp_opt(self.focus_until, 0).single()?;
            return if self.scheduled(end) {
                self.transition(end)
            } else {
                Some(self.focus_until)
            };
        }
        if self.scheduled(at) {
            self.transition(at)
        } else {
            None
        }
    }
    pub fn blocked(&self, at: DateTime<Local>) -> Vec<String> {
        if !self.focusing(at) || self.break_until > at.timestamp() {
            return vec![];
        }
        self.enabled_items(at.timestamp(), false)
            .iter()
            .filter(|s| self.site_breaks.get(*s).copied().unwrap_or(0) <= at.timestamp())
            .cloned()
            .collect()
    }
    // Walk real minutes so clock changes and overnight shifts use the system's local timezone.
    pub fn transition(&self, at: DateTime<Local>) -> Option<i64> {
        let active = self.schedule.active(at);
        if !self.schedule.enabled {
            return None;
        }
        let minute = at.with_second(0)?.with_nanosecond(0)?;
        (1..=8 * 1440)
            .map(|m| minute + Duration::minutes(m))
            .find(|t| self.schedule.active(*t) != active)
            .map(|t| t.timestamp())
    }
}
pub fn hostnames(sites: &[String]) -> BTreeSet<String> {
    let mut names = BTreeSet::new();
    for s in sites {
        names.insert(s.clone());
        names.insert(format!("www.{s}"));
        let aliases: &[&str] = match s.as_str() {
            "x.com" | "twitter.com" => &[
                "x.com",
                "www.x.com",
                "twitter.com",
                "www.twitter.com",
                "mobile.twitter.com",
                "mobile.x.com",
                "api.x.com",
                "api.twitter.com",
            ],
            "reddit.com" => &[
                "old.reddit.com",
                "new.reddit.com",
                "sh.reddit.com",
                "np.reddit.com",
                "m.reddit.com",
                "oauth.reddit.com",
                "i.reddit.com",
                "redd.it",
            ],
            "instagram.com" => &[
                "m.instagram.com",
                "i.instagram.com",
                "instagr.am",
                "www.instagr.am",
            ],
            "youtube.com" => &[
                "m.youtube.com",
                "music.youtube.com",
                "youtu.be",
                "www.youtu.be",
                "youtube-nocookie.com",
                "www.youtube-nocookie.com",
            ],
            _ => &[],
        };
        names.extend(aliases.iter().map(|s| s.to_string()));
    }
    names
}
const START: &str = "# >>> Fokus website blocking >>>";
const END: &str = "# <<< Fokus website blocking <<<";
pub fn hosts_content(original: &str, sites: &[String]) -> Result<String, String> {
    let mut kept = String::new();
    let mut inside = false;
    for line in original.split_inclusive('\n') {
        match line.trim_end_matches(['\r', '\n']) {
            START if !inside => inside = true,
            END if inside => inside = false,
            START | END => return Err("Conflicting fokus markers in the hosts file.".into()),
            _ if !inside => kept.push_str(line),
            _ => {}
        }
    }
    if inside {
        return Err("Incomplete fokus section in the hosts file.".into());
    }
    if !sites.is_empty() {
        if !kept.is_empty() && !kept.ends_with('\n') {
            kept.push('\n');
        }
        kept += START;
        kept.push('\n');
        for name in hostnames(sites) {
            kept += &format!("0.0.0.0 {name}\n:: {name}\n");
        }
        kept += END;
        kept.push('\n');
    }
    Ok(kept)
}
pub fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let temp = path.with_extension(format!("fokus-{}-{}.tmp", std::process::id(), fastrand::u64(..)));
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut f = options.open(&temp)?;
    let result = (|| {
        if let Ok(meta) = fs::metadata(path) {
            f.set_permissions(meta.permissions())?;
        }
        f.write_all(bytes)?;
        f.sync_all()?;
        drop(f);
        #[cfg(not(windows))]
        { fs::rename(&temp, path) }
        #[cfg(windows)]
        {
            use std::os::windows::ffi::OsStrExt;
            use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH};
            let src: Vec<u16> = temp.as_os_str().encode_wide().chain(Some(0)).collect();
            let dst: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
            if unsafe { MoveFileExW(src.as_ptr(), dst.as_ptr(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) } == 0 {
                Err(std::io::Error::last_os_error())
            } else { Ok(()) }
        }
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}
pub fn load_rules(path: &Path) -> Result<Rules, String> {
    let data = fs::read(path).map_err(|e| e.to_string())?;
    if data.len() > 120_000 {
        return Err("Rules file is too large.".into());
    }
    let mut rules: Rules = serde_json::from_slice(&data).map_err(|e| e.to_string())?;
    if rules.sites.len() > 256 || rules.sites.iter().any(|s| domain(s).as_ref() != Ok(s)) {
        return Err("Invalid website list.".into());
    }
    let mut check = Rules::default();
    check.apply(
        Action::Schedule {
            schedule: rules.schedule.clone(),
        },
        0,
    )?;
    rules.ensure_groups();
    Ok(rules)
}
pub fn snapshot(rules: &Rules, ready: bool, problem: Option<String>) -> serde_json::Value {
    let now = Local::now();
    let scheduled = rules.scheduled(now);
    let skipped = rules.skipped_until > now.timestamp() && rules.schedule.active(now);
    let transition = rules.transition(now);
    let next_start = if skipped {
        Local
            .timestamp_opt(rules.skipped_until, 0)
            .single()
            .and_then(|end| rules.transition(end))
    } else if !scheduled {
        transition
    } else {
        None
    };
    let mut view = rules.clone();
    view.ensure_groups();
    view.sites = view.enabled_items(now.timestamp(), false);
    let apps: Vec<_> = if ready
        && problem.is_none()
        && rules.focusing(now)
        && rules.break_until <= now.timestamp()
    {
        view.enabled_items(now.timestamp(), true)
            .into_iter()
            .filter(|id| rules.site_breaks.get(id).copied().unwrap_or(0) <= now.timestamp())
            .collect()
    } else {
        vec![]
    };
    serde_json::json!({"version":3,"blockedApps":apps, "rules":view,"ready":ready,"problem":problem,"now":now.timestamp(),"scheduled":scheduled,
      "skipped":skipped,"nextStart":next_start,"sessionEnd":rules.session_end(now),"transition":transition,
      "blocked":if ready && problem.is_none(){rules.blocked(now)}else{vec![]}})
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;
    #[test]
    fn overnight_shift_belongs_to_start_day() {
        let s = Schedule {
            enabled: true,
            days: vec![4],
            start: 1320,
            end: 360,
        };
        let tz = FixedOffset::east_opt(0).unwrap();
        for (day, h, active) in [
            (6, 21, false),
            (6, 22, true),
            (7, 5, true),
            (7, 6, false),
            (7, 22, false),
        ] {
            assert_eq!(
                s.active(tz.with_ymd_and_hms(2026, 11, day, h, 0, 0).unwrap()),
                active
            );
        }
    }
    #[test]
    fn rules_cannot_inject_host_entries() {
        for bad in [
            "localhost",
            "127.0.0.1",
            "x.com\nanything",
            "http://foo@x.com",
            "file:///tmp",
            "*.example.com",
            "https://-bad.com",
        ] {
            assert!(domain(bad).is_err(), "{bad}");
        }
        assert_eq!(
            domain("HTTPS://www.Reddit.com/r/work").unwrap(),
            "reddit.com"
        );
        let mut r = Rules::default();
        assert!(r
            .apply(
                Action::Add {
                    site: "www.x.com".into()
                },
                0
            )
            .is_err());
    }
    #[test]
    fn only_the_owned_hosts_section_changes() {
        let original = "# custom\r\n127.0.0.1 localhost\n";
        let blocked = hosts_content(original, &["reddit.com".into()]).unwrap();
        assert!(blocked.contains(":: old.reddit.com\n"));
        assert_eq!(
            hosts_content(&blocked, &["reddit.com".into()]).unwrap(),
            blocked
        );
        assert_eq!(hosts_content(&blocked, &[]).unwrap(), original);
        assert!(hosts_content(&format!("{START}\n"), &[]).is_err());
    }
    #[test]
    fn youtube_rules_cover_common_alias_hosts() {
        let hosts = hostnames(&["youtube.com".into()]);
        for host in [
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
            "music.youtube.com",
            "youtu.be",
            "www.youtu.be",
            "youtube-nocookie.com",
            "www.youtube-nocookie.com",
        ] {
            assert!(hosts.contains(host), "missing {host}");
        }
    }
    #[test]
    fn early_finish_applies_to_one_overnight_shift() {
        let mut r = Rules::default();
        r.schedule = Schedule {
            enabled: true,
            days: vec![0, 1],
            start: 22 * 60,
            end: 6 * 60,
        };
        let t = Local.with_ymd_and_hms(2026, 11, 10, 1, 0, 0).unwrap();
        assert!(r.scheduled(t));
        r.apply(Action::FinishEarly, t.timestamp()).unwrap();
        assert_eq!(r.skipped_until, (t + Duration::hours(5)).timestamp());
        assert!(r.blocked(t).is_empty());
        assert_eq!(r.blocked(t + Duration::hours(21)), r.sites);
        r.apply(Action::ResumeHours, t.timestamp()).unwrap();
        assert_eq!(r.blocked(t), r.sites);
    }
    #[test]
    fn short_session_caps_break_and_preserves_other_exceptions() {
        let t = Local.with_ymd_and_hms(2026, 11, 9, 16, 58, 0).unwrap();
        let mut r = Rules::default();
        r.apply(
            Action::Break {
                minutes: 30,
                site: Some("x.com".into()),
            },
            t.timestamp(),
        )
        .unwrap();
        assert_eq!(r.site_breaks["x.com"], t.timestamp() + 120);
        r.apply(
            Action::Break {
                minutes: 30,
                site: None,
            },
            t.timestamp(),
        )
        .unwrap();
        assert_eq!(r.break_until, t.timestamp() + 120);
        r.apply(Action::Resume { site: None }, t.timestamp())
            .unwrap();
        assert_eq!(
            r.blocked(t),
            r.sites
                .iter()
                .filter(|s| *s != "x.com")
                .cloned()
                .collect::<Vec<_>>()
        );
        assert!(r
            .apply(
                Action::Add {
                    site: "twitter.com".into()
                },
                t.timestamp()
            )
            .is_err());
    }

    #[test]
    fn breaks_expire_without_a_window_or_restart() {
        let t = Local::now();
        let mut r = Rules::default();
        r.schedule.enabled = false;
        r.focus_until = t.timestamp() + 3600;
        r.apply(
            Action::Break {
                minutes: 5,
                site: Some("x.com".into()),
            },
            t.timestamp(),
        )
        .unwrap();
        assert_eq!(
            r.blocked(t),
            r.sites
                .iter()
                .filter(|s| *s != "x.com")
                .cloned()
                .collect::<Vec<_>>()
        );
        assert_eq!(r.blocked(t + Duration::minutes(5)), r.sites);
        r.apply(
            Action::Break {
                minutes: 10,
                site: None,
            },
            t.timestamp(),
        )
        .unwrap();
        assert!(r.blocked(t + Duration::minutes(9)).is_empty());
        assert_eq!(r.blocked(t + Duration::minutes(10)), r.sites);
        assert!(r.blocked(t + Duration::hours(1)).is_empty());
    }
}

/// Portable bundle IDs plus Windows executable paths. Critical OS processes and
/// Fokus itself cannot be selected as distractions.
pub fn blockable_app_id(id: &str) -> bool {
    #[cfg(windows)]
    if id.contains('\\') {
        let path = std::path::Path::new(id);
        let lower = id.to_lowercase();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
        return id.len() <= 1024 && path.is_absolute() && lower.ends_with(".exe")
            && !id.chars().any(|c| c.is_control() || c == '\"')
            && !path.components().any(|c| matches!(c, std::path::Component::ParentDir))
            && !["fokus.exe", "fokus-helper.exe", "explorer.exe", "taskmgr.exe", "cmd.exe", "powershell.exe", "pwsh.exe", "msiexec.exe", "uninstall.exe"].contains(&name.as_str())
            && !lower.contains("\\windows\\");
    }
    !id.is_empty() && id.len() <= 180 && id.contains('.')
        && id.bytes().all(|c| c.is_ascii_alphanumeric() || b".-_".contains(&c))
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    #[test]
    fn executable_paths_accept_spaces_and_reject_system_targets() {
        assert!(blockable_app_id(r"c:\program files\example\example.exe"));
        assert!(!blockable_app_id(r"c:\windows\system32\winlogon.exe"));
        assert!(!blockable_app_id(r"c:\apps\fokus.exe"));
        assert!(!blockable_app_id(r"c:\apps\..\windows\explorer.exe"));
        assert!(!blockable_app_id(r"relative\game.exe"));
    }
    #[test]
    fn atomic_replacement_updates_existing_windows_files() {
        let path = std::env::temp_dir().join(format!("fokus-atomic-{}.json", fastrand::u64(..)));
        write_atomic(&path, b"first").unwrap();
        write_atomic(&path, b"second").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"second");
        fs::remove_file(path).unwrap();
    }
}
