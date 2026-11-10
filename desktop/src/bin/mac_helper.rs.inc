use chrono::Local;
use fokus::*;
use serde_json::{json, Value};
use std::{
    env, fs,
    io::{Read, Write},
    os::fd::AsRawFd,
    os::unix::{
        fs::PermissionsExt,
        net::{UnixListener, UnixStream},
    },
    path::{Path, PathBuf},
    process::Command,
    time::{Duration, Instant},
};

fn sync_hosts(path: &Path, sites: &[String], system: bool) -> Result<(), String> {
    let old = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let new = hosts_content(&old, sites)?;
    if old != new {
        if fs::read_to_string(path).map_err(|e| e.to_string())? != old {
            return Err("Another app is updating the hosts file. Retrying…".into());
        }
        write_atomic(path, new.as_bytes()).map_err(|e| e.to_string())?;
        if system {
            let _ = Command::new("/usr/bin/dscacheutil")
                .arg("-flushcache")
                .status();
            let _ = Command::new("/usr/bin/killall")
                .args(["-HUP", "mDNSResponder"])
                .status();
        }
    }
    Ok(())
}

fn run() -> Result<(), String> {
    let args: Vec<_> = env::args().collect();
    let sandbox = args.get(1).is_some_and(|s| s == "--sandbox");
    let (base, hosts, socket) = if sandbox {
        if unsafe { libc::geteuid() } == 0 {
            return Err("Use a normal account for sandbox runs.".into());
        }
        let dir = PathBuf::from(args.get(2).ok_or("Missing sandbox directory")?);
        (dir.clone(), dir.join("hosts"), dir.join("control.sock"))
    } else {
        (
            PathBuf::from(SERVICE),
            PathBuf::from("/private/etc/hosts"),
            PathBuf::from(SOCKET),
        )
    };
    if args.get(1).is_some_and(|s| s == "--clear") {
        return sync_hosts(&hosts, &[], true);
    }
    let state_file = base.join("rules.json");
    let mut rules = load_rules(&state_file)?;
    let _ = fs::remove_file(&socket);
    let listener = UnixListener::bind(&socket).map_err(|e| e.to_string())?;
    fs::set_permissions(&socket, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
    if !sandbox {
        let uid: u32 = args
            .get(1)
            .ok_or("Missing owner")?
            .parse()
            .map_err(|_| "Invalid owner")?;
        std::os::unix::fs::chown(&socket, Some(uid), None).map_err(|e| e.to_string())?;
    }
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let mut last = Instant::now() - Duration::from_secs(60);
    let mut applied: Option<Vec<String>> = None;
    let mut problem = None;
    loop {
        let mut request = None;
        if let Ok((mut stream, _)) = listener.accept() {
            let response = (|| -> Result<(), String> {
                stream.set_nonblocking(false).map_err(|e| e.to_string())?;
                stream
                    .set_read_timeout(Some(Duration::from_secs(2)))
                    .map_err(|e| e.to_string())?;
                stream
                    .set_write_timeout(Some(Duration::from_secs(2)))
                    .map_err(|e| e.to_string())?;
                let mut data = Vec::new();
                (&mut stream)
                    .take(8192)
                    .read_to_end(&mut data)
                    .map_err(|e| e.to_string())?;
                let req: Value = serde_json::from_slice(&data).map_err(|e| e.to_string())?;
                if req != json!({"type":"status"}) {
                    let action: Action = serde_json::from_value(req).map_err(|e| e.to_string())?;
                    let mut next = rules.clone();
                    next.apply(action, Local::now().timestamp())?;
                    write_atomic(&state_file, &serde_json::to_vec(&next).unwrap())
                        .map_err(|e| e.to_string())?;
                    rules = next;
                }
                Ok(())
            })();
            if let Err(error) = response {
                reply(&mut stream, json!({"error":error}));
            } else {
                request = Some(stream);
            }
        }
        let sites = rules.blocked(Local::now());
        if applied.as_ref() != Some(&sites)
            || last.elapsed() >= Duration::from_secs(60)
            || problem.is_some()
        {
            problem = sync_hosts(&hosts, &sites, !sandbox).err();
            applied = Some(sites);
            last = Instant::now();
        }
        if let Some(mut stream) = request {
            reply(&mut stream, snapshot(&rules, true, problem.clone()));
        }
        // Sleep on the control socket until an edit, a minute boundary, or a timer expiry.
        let now = Local::now().timestamp_millis();
        let next_minute = (now.div_euclid(60_000) + 1) * 60_000;
        let deadline = rules
            .site_breaks
            .values()
            .copied()
            .chain([rules.focus_until, rules.break_until])
            .map(|t| t.saturating_mul(1000))
            .filter(|t| *t > now)
            .fold(next_minute, i64::min);
        let timeout = if problem.is_some() {
            2000
        } else {
            (deadline - now).max(1) as i32
        };
        let mut pollfd = libc::pollfd {
            fd: listener.as_raw_fd(),
            events: libc::POLLIN,
            revents: 0,
        };
        unsafe {
            libc::poll(&mut pollfd, 1, timeout);
        }
    }
}
fn reply(stream: &mut UnixStream, data: Value) {
    let _ = stream.write_all(data.to_string().as_bytes());
}
fn main() {
    if let Err(e) = run() {
        eprintln!("{e}");
        std::process::exit(1);
    }
}
