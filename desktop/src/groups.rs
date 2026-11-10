use crate::{domain, hostnames, Rules};
use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct MacApp {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: u32,
    pub name: String,
    pub sites: Vec<String>,
    pub apps: Vec<MacApp>,
    pub enabled: bool,
    #[serde(default)]
    pub session_choice: Option<bool>,
    #[serde(default)]
    pub choice_until: i64,
}

impl Group {
    pub fn enabled_at(&self, now: i64) -> bool {
        if now < self.choice_until {
            self.session_choice.unwrap_or(self.enabled)
        } else {
            self.enabled
        }
    }
}

// The original site lists identify untouched presets in pre-catalogue installs.
const PRESETS: [(&str, &[&str], &str); 4] = [
    (
        "Social media",
        &["x.com", "reddit.com", "instagram.com"],
        include_str!("../presets/social.txt"),
    ),
    (
        "Gaming",
        &["twitch.tv"],
        include_str!("../presets/gaming.txt"),
    ),
    (
        "Shopping",
        &["amazon.com", "ebay.com"],
        include_str!("../presets/shopping.txt"),
    ),
    (
        "Adult websites",
        &["pornhub.com", "xvideos.com"],
        include_str!("../presets/adult.txt"),
    ),
];

pub fn starter_groups(legacy_sites: Option<&[String]>) -> Vec<Group> {
    let mut groups: Vec<_> = PRESETS
        .iter()
        .enumerate()
        .map(|(i, &(name, original, catalog))| Group {
            id: i as u32 + 1,
            name: name.into(),
            sites: if legacy_sites.is_some() {
                original.iter().map(|s| (*s).to_owned()).collect()
            } else {
                catalog.lines().map(String::from).collect()
            },
            apps: vec![],
            enabled: i == 0,
            session_choice: None,
            choice_until: 0,
        })
        .collect();
    if let Some(sites) = legacy_sites {
        let first = &mut groups[0];
        first.sites = sites.to_vec();
        if !sites
            .iter()
            .all(|s| ["x.com", "reddit.com", "instagram.com", "tiktok.com"].contains(&s.as_str()))
        {
            first.name = "My sites".into();
        }
    }
    groups
}

#[derive(Deserialize, Serialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum GroupEdit {
    Create { name: String },
    Rename { id: u32, name: String },
    Delete { id: u32 },
    SetDefault { id: u32, enabled: bool },
    Toggle { id: u32, enabled: bool },
    AddSites { id: u32, sites: Vec<String> },
    RemoveSite { id: u32, site: String },
    AddApp { id: u32, app: MacApp },
    RemoveApp { id: u32, app: String },
}

impl Rules {
    pub fn ensure_groups(&mut self) {
        if self.groups.is_empty() {
            self.groups = starter_groups(Some(&self.sites));
        }
    }
    pub fn preset_additions(&self) -> Vec<(u32, Vec<String>)> {
        let mut remaining =
            256usize.saturating_sub(self.groups.iter().map(|g| g.sites.len()).sum());
        let mut occupied: BTreeSet<_> = self
            .groups
            .iter()
            .flat_map(|g| hostnames(&g.sites))
            .collect();
        let mut updates = Vec::new();
        for (i, (name, legacy, catalog)) in PRESETS.iter().enumerate() {
            let id = i as u32 + 1;
            if !self
                .groups
                .iter()
                .any(|g| g.id == id && g.name == *name && g.sites == *legacy)
            {
                continue;
            }
            let mut additions = Vec::new();
            for site in catalog.lines().filter(|s| !legacy.contains(s)) {
                let site = site.to_owned();
                let aliases = hostnames(std::slice::from_ref(&site));
                if occupied.is_disjoint(&aliases) {
                    occupied.extend(aliases);
                    additions.push(site);
                }
            }
            // Leave crowded custom configurations intact instead of partially installing a preset.
            if !additions.is_empty() && additions.len() <= remaining {
                remaining -= additions.len();
                updates.push((id, additions));
            }
        }
        updates
    }

    pub fn enabled_items(&self, now: i64, apps: bool) -> Vec<String> {
        if self.groups.is_empty() {
            return if apps { vec![] } else { self.sites.clone() };
        }
        let mut seen = BTreeSet::new();
        let mut items = vec![];
        for group in self.groups.iter().filter(|g| g.enabled_at(now)) {
            let keys: Vec<_> = if apps {
                group.apps.iter().map(|a| format!("app:{}", a.id)).collect()
            } else {
                group.sites.clone()
            };
            for key in keys {
                if seen.insert(key.clone()) {
                    items.push(key)
                }
            }
        }
        items
    }
    pub fn edit_group(&mut self, change: GroupEdit, at: DateTime<Local>) -> Result<(), String> {
        use GroupEdit::*;
        let end = self.session_end(at);
        let group = |id| {
            self.groups
                .iter()
                .position(|g| g.id == id)
                .ok_or("Group no longer exists.")
        };
        fn name(raw: String) -> Result<String, String> {
            let n = raw.trim();
            if n.is_empty() || n.chars().count() > 60 || n.chars().any(char::is_control) {
                Err("Use a group name of 1–60 characters.".into())
            } else {
                Ok(n.to_owned())
            }
        }
        match change {
            Create { name: raw } => {
                let name = name(raw)?;
                if self.groups.len() >= 48 {
                    return Err("You have reached 48 groups.".into());
                }
                let id = self.groups.iter().map(|g| g.id).max().unwrap_or(0) + 1;
                self.groups.push(Group {
                    id,
                    name,
                    sites: vec![],
                    apps: vec![],
                    enabled: false,
                    session_choice: None,
                    choice_until: 0,
                });
            }
            Rename { id, name: raw } => {
                let i = group(id)?;
                self.groups[i].name = name(raw)?;
            }
            Delete { id } => {
                let i = group(id)?;
                if self.groups.len() == 1 {
                    return Err("Keep at least one group.".into());
                }
                self.groups.remove(i);
            }
            SetDefault { id, enabled } => {
                let i = group(id)?;
                let g = &mut self.groups[i];
                if let Some(end) = end {
                    let current = g.enabled_at(at.timestamp());
                    g.session_choice = Some(current);
                    g.choice_until = end;
                }
                g.enabled = enabled;
            }
            Toggle { id, enabled } => {
                let i = group(id)?;
                let g = &mut self.groups[i];
                if let Some(end) = end {
                    g.session_choice = Some(enabled);
                    g.choice_until = end;
                } else {
                    g.enabled = enabled;
                    g.choice_until = 0;
                }
            }
            AddSites { id, sites } => {
                let i = group(id)?;
                let mut additions = vec![];
                for raw in sites {
                    let d = domain(&raw)?;
                    if self.groups[i].sites.contains(&d) || additions.contains(&d) {
                        continue;
                    }
                    let hosts = hostnames(std::slice::from_ref(&d));
                    if let Some(other) = self
                        .groups
                        .iter()
                        .flat_map(|g| &g.sites)
                        .chain(additions.iter())
                        .find(|s| {
                            **s != d && !hostnames(std::slice::from_ref(*s)).is_disjoint(&hosts)
                        })
                    {
                        return Err(format!("{d} is already covered by {other}. Use the same domain in both groups."));
                    }
                    additions.push(d);
                }
                if additions.is_empty() {
                    return Err("These sites are already in this group.".into());
                }
                if self.groups.iter().map(|g| g.sites.len()).sum::<usize>() + additions.len() > 256
                {
                    return Err("Your groups are full (256 site entries).".into());
                }
                self.groups[i].sites.extend(additions);
            }
            RemoveSite { id, site } => {
                let i = group(id)?;
                self.groups[i].sites.retain(|s| s != &site);
            }
            AddApp { id, app } => {
                let i = group(id)?;
                if !crate::blockable_app_id(&app.id)
                    || app.name.trim().is_empty()
                    || app.name.len() > 150
                    || [
                        "dev.usefokus.app",
                        "com.apple.finder",
                        "com.apple.loginwindow",
                        "com.apple.dock",
                        "com.apple.systemuiserver",
                    ]
                    .contains(&app.id.to_lowercase().as_str())
                {
                    return Err("Choose a blockable application.".into());
                }
                if self.groups[i].apps.iter().any(|a| a.id == app.id) {
                    return Err("App already in this group.".into());
                }
                if self.groups.iter().map(|g| g.apps.len()).sum::<usize>() >= 128 {
                    return Err("Your groups are full (128 app entries).".into());
                }
                self.groups[i].apps.push(app);
            }
            RemoveApp { id, app } => {
                let i = group(id)?;
                self.groups[i].apps.retain(|a| a.id != app);
            }
        }
        if serde_json::to_vec(&self.groups)
            .map_err(|e| e.to_string())?
            .len()
            > 70000
        {
            return Err("Your groups are full.".into());
        }
        self.sites = self.enabled_items(at.timestamp(), false);
        if serde_json::to_vec(self).map_err(|e| e.to_string())?.len() > 110000 {
            return Err("Your groups are full.".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Action;
    use chrono::{Duration, TimeZone};
    #[test]
    fn catalogue_contains_valid_editable_domains_and_leaves_room_for_custom_sites() {
        let r = Rules::default();
        let mut seen = BTreeSet::new();
        for (group, expected) in r.groups.iter().zip([
            "linkedin.com",
            "store.steampowered.com",
            "amazon.ca",
            "onlyfans.com",
        ]) {
            assert!(group.sites.iter().any(|s| s == expected));
            for site in &group.sites {
                assert_eq!(domain(site).as_ref(), Ok(site));
                let aliases = hostnames(std::slice::from_ref(site));
                assert!(
                    seen.is_disjoint(&aliases),
                    "overlapping catalogue site: {site}"
                );
                seen.extend(aliases);
            }
        }
        assert!(r.groups.iter().map(|g| g.sites.len()).sum::<usize>() < 200);
        assert!(r.preset_additions().is_empty());
    }

    #[test]
    fn upgrades_only_original_site_lists_and_respects_aliases_and_capacity() {
        let mut r = Rules::default();
        r.groups = starter_groups(Some(
            &["x.com", "reddit.com", "instagram.com"].map(String::from),
        ));
        r.groups[0].enabled = false;
        r.groups[2].sites.push("old.example".into());
        r.groups[2].sites.push("facebook.com".into());
        r.groups[3].name = "Private".into();
        let changes = r.preset_additions();
        assert_eq!(
            changes.iter().map(|(id, _)| *id).collect::<Vec<_>>(),
            [1, 2]
        );
        assert!(changes[0].1.contains(&"linkedin.com".into()));
        assert!(!changes[0].1.contains(&"facebook.com".into()));
        for (id, sites) in changes {
            r.edit_group(GroupEdit::AddSites { id, sites }, Local::now())
                .unwrap();
        }
        assert!(!r.groups[0].enabled);
        assert!(r.preset_additions().is_empty());
        r.groups = starter_groups(Some(&["x.com".into()]));
        assert!(r.preset_additions().iter().all(|(id, _)| *id != 1));
        r.groups[0]
            .sites
            .extend((0..244).map(|n| format!("s{n}.example")));
        assert!(r.preset_additions().is_empty());
    }

    #[test]
    fn legacy_groups_and_session_exceptions() {
        let at = Local.with_ymd_and_hms(2026, 11, 9, 10, 0, 0).unwrap();
        let mut r = Rules::default();
        r.groups.clear();
        r.sites = vec!["example.com".into()];
        r.ensure_groups();
        assert_eq!(r.blocked(at), vec!["example.com"]);
        assert_eq!(r.groups[0].name, "My sites");
        r.edit_group(
            GroupEdit::AddApp {
                id: 2,
                app: MacApp {
                    id: "com.example.game".into(),
                    name: "Game".into(),
                },
            },
            at,
        )
        .unwrap();
        r.edit_group(
            GroupEdit::AddSites {
                id: 2,
                sites: vec!["example.com".into()],
            },
            at,
        )
        .unwrap();
        r.edit_group(
            GroupEdit::Toggle {
                id: 2,
                enabled: true,
            },
            at,
        )
        .unwrap();
        r.edit_group(
            GroupEdit::Toggle {
                id: 1,
                enabled: false,
            },
            at,
        )
        .unwrap();
        assert!(r.blocked(at).contains(&"example.com".into()));
        r.apply(
            Action::Break {
                minutes: 1,
                site: Some("app:com.example.game".into()),
            },
            at.timestamp(),
        )
        .unwrap();
        assert_eq!(r.site_breaks["app:com.example.game"], at.timestamp() + 60);
        let tomorrow = at + Duration::days(1);
        assert!(r.enabled_items(tomorrow.timestamp(), true).is_empty());
        assert_eq!(r.blocked(tomorrow), vec!["example.com"]);
    }
}
