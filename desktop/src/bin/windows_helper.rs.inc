use fokus::windows_ipc::{base, pipe, wide, SERVICE_NAME};
use fokus::*;
use serde_json::{json, Value};
use std::os::windows::process::CommandExt;
use std::{
    fs, io,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use windows_sys::Win32::{
    Foundation::*,
    Security::{
        Authorization::ConvertStringSecurityDescriptorToSecurityDescriptorW, SECURITY_ATTRIBUTES,
    },
    Storage::FileSystem::*,
    System::{Pipes::*, IO::*},
};

fn sync_hosts(path: &Path, rules: &Rules, system: bool) -> Result<(), String> {
    let old = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let new = hosts_content(&old, &rules.blocked(chrono::Local::now()))?;
    if old != new {
        if fs::read_to_string(path).map_err(|e| e.to_string())? != old {
            return Err("The hosts file changed; retrying.".into());
        }
        write_atomic(path, new.as_bytes()).map_err(|e| e.to_string())?;
        if system {
            let _ = std::process::Command::new("ipconfig.exe")
                .creation_flags(0x08000000)
                .arg("/flushdns")
                .output();
        }
    }
    Ok(())
}
struct Pipe(HANDLE);
impl Drop for Pipe {
    fn drop(&mut self) {
        unsafe {
            DisconnectNamedPipe(self.0);
            CloseHandle(self.0);
        }
    }
}
fn server(sid: &str) -> Result<Pipe, String> {
    if !sid.starts_with("S-1-")
        || !sid
            .bytes()
            .all(|b| b.is_ascii_digit() || b == b'S' || b == b'-')
    {
        return Err("Invalid service owner SID.".into());
    }
    let sddl = wide(&format!("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGW;;;{sid})"));
    unsafe {
        let mut descriptor = std::ptr::null_mut();
        if ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl.as_ptr(),
            1,
            &mut descriptor,
            std::ptr::null_mut(),
        ) == 0
        {
            return Err(io::Error::last_os_error().to_string());
        }
        let attributes = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor,
            bInheritHandle: 0,
        };
        let handle = CreateNamedPipeW(
            wide(&pipe()).as_ptr(),
            PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
            PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_NOWAIT | PIPE_REJECT_REMOTE_CLIENTS,
            1,
            200_000,
            8192,
            6000,
            &attributes,
        );
        LocalFree(descriptor);
        if handle == INVALID_HANDLE_VALUE {
            Err(io::Error::last_os_error().to_string())
        } else {
            Ok(Pipe(handle))
        }
    }
}
fn run(stop: Arc<AtomicBool>) -> Result<(), String> {
    let test = std::env::var_os("FOKUS_TEST_DIRECTORY").map(std::path::PathBuf::from);
    let dir = test.clone().unwrap_or_else(base);
    let hosts = if test.is_some() {
        dir.join("hosts")
    } else {
        fokus::windows_ipc::hosts()
    };
    let state_file = dir.join("rules.json");
    let sid = fs::read_to_string(dir.join("owner.sid")).map_err(|e| e.to_string())?;
    let mut rules = load_rules(&state_file)?;
    let pipe = server(sid.trim())?;
    let mut last = Instant::now() - Duration::from_secs(60);
    let mut problem = None;
    let mut previous = Vec::new();
    let mut connected = None;
    let mut replied = false;
    while !stop.load(Ordering::Relaxed) {
        let sites = rules.blocked(chrono::Local::now());
        if sites != previous || last.elapsed() >= Duration::from_secs(1) {
            problem = sync_hosts(&hosts, &rules, test.is_none()).err();
            previous = sites;
            last = Instant::now();
        }
        unsafe {
            if connected.is_none() {
                if ConnectNamedPipe(pipe.0, std::ptr::null_mut()) != 0
                    || GetLastError() == ERROR_PIPE_CONNECTED
                {
                    connected = Some(Instant::now());
                    replied = false;
                } else if GetLastError() == ERROR_NO_DATA {
                    DisconnectNamedPipe(pipe.0);
                }
            }
            if let Some(start) = connected {
                if replied {
                    let alive = PeekNamedPipe(
                        pipe.0,
                        std::ptr::null_mut(),
                        0,
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                    );
                    if alive == 0 || start.elapsed() >= Duration::from_secs(2) {
                        DisconnectNamedPipe(pipe.0);
                        connected = None;
                    }
                    std::thread::sleep(Duration::from_millis(10));
                    continue;
                }
                let mut input = [0u8; 8192];
                let mut count = 0;
                if ReadFile(
                    pipe.0,
                    input.as_mut_ptr(),
                    input.len() as u32,
                    &mut count,
                    std::ptr::null_mut(),
                ) != 0
                    && count > 0
                {
                    let result = (|| -> Result<Value, String> {
                        let value: Value = serde_json::from_slice(&input[..count as usize])
                            .map_err(|e| e.to_string())?;
                        if value != json!({"type":"status"}) {
                            let mut next = rules.clone();
                            next.apply(
                                serde_json::from_value(value).map_err(|e| e.to_string())?,
                                chrono::Local::now().timestamp(),
                            )?;
                            write_atomic(&state_file, &serde_json::to_vec(&next).unwrap())
                                .map_err(|e| e.to_string())?;
                            rules = next;
                            problem = sync_hosts(&hosts, &rules, test.is_none()).err();
                        }
                        Ok(snapshot(&rules, true, problem.clone()))
                    })();
                    let response = result
                        .unwrap_or_else(|error| json!({"error":error}))
                        .to_string();
                    let mut written = 0;
                    WriteFile(
                        pipe.0,
                        response.as_ptr(),
                        response.len() as u32,
                        &mut written,
                        std::ptr::null_mut(),
                    );
                    // Keep the instance connected until the client consumes the reply.
                    // PIPE_NOWAIT keeps a stalled client from delaying schedule enforcement.
                    replied = true;
                    connected = Some(Instant::now());
                } else if GetLastError() == ERROR_BROKEN_PIPE
                    || start.elapsed() >= Duration::from_secs(2)
                {
                    DisconnectNamedPipe(pipe.0);
                    connected = None;
                }
            }
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    Ok(())
}
windows_service::define_windows_service!(service_entry, service_main);
fn service_main(_: Vec<std::ffi::OsString>) {
    use windows_service::{
        service::*,
        service_control_handler::{self, ServiceControlHandlerResult},
    };
    let stop = Arc::new(AtomicBool::new(false));
    let signal = stop.clone();
    let Ok(handle) = service_control_handler::register(SERVICE_NAME, move |event| match event {
        ServiceControl::Stop | ServiceControl::Shutdown => {
            signal.store(true, Ordering::Relaxed);
            ServiceControlHandlerResult::NoError
        }
        ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
        _ => ServiceControlHandlerResult::NotImplemented,
    }) else {
        return;
    };
    let status = |state, code| ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: state,
        controls_accepted: ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN,
        exit_code: ServiceExitCode::Win32(code),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    };
    let _ = handle.set_service_status(status(ServiceState::Running, 0));
    let result = run(stop);
    if let Err(error) = &result {
        let _ = fs::write(base().join("service-error.log"), error);
    }
    let _ = handle.set_service_status(status(
        ServiceState::Stopped,
        if result.is_ok() { 0 } else { 1 },
    ));
}
fn main() {
    let result = if std::env::args().any(|a| a == "--clear") {
        let path = fokus::windows_ipc::hosts();
        (|| {
            let old = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let clean = hosts_content(&old, &[])?;
            write_atomic(&path, clean.as_bytes()).map_err(|e| e.to_string())?;
            let _ = std::process::Command::new("ipconfig.exe")
                .creation_flags(0x08000000)
                .arg("/flushdns")
                .output();
            Ok(())
        })()
    } else if std::env::args().any(|a| a == "--console")
        && std::env::var_os("FOKUS_TEST_DIRECTORY").is_some()
    {
        run(Arc::new(AtomicBool::new(false)))
    } else {
        // Environment test overrides are accepted only in the explicit console mode.
        std::env::remove_var("FOKUS_TEST_DIRECTORY");
        windows_service::service_dispatcher::start(SERVICE_NAME, service_entry)
            .map_err(|e| e.to_string())
    };
    if let Err(error) = result {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
