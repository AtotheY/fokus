import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Theme,
  Button,
  IconButton,
  Dialog,
  Switch,
  TextField,
  Select,
} from "@radix-ui/themes";
import {
  Aperture,
  UsersRound, Gamepad2, LibraryBig,
  CalendarClock,
  Settings as Gear,
  Plus,
  Clock3,
  Coffee,
  Play,
  Sun,
  ShieldCheck,
  Check,
  X as Close,
} from "lucide-react";
import { UpdateIndicator, UpdateOffer, useAppUpdates } from "./app-updates";
import { Settings, Row, useAppearance, invoke } from "./settings";
import { ScopePreview, WebsiteCheck, useBreakPause } from "./website";
import { Groups, SessionGroups } from "./groups";
import { DailyShelf } from "./library";
import { Activities } from "./activities";
import "@radix-ui/themes/styles.css";
import "./style.css";
import "./workspace.css";
import { workdayProgress } from "./daylight";

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const names = {
  "x.com": "X",
  "reddit.com": "Reddit",
  "instagram.com": "Instagram",
};
const clock = (t) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(t * 1000));
const when = (t) => {
  const date = new Date(t * 1000),
    now = new Date();
  return date.toDateString() === now.toDateString()
    ? clock(t)
    : date.toLocaleDateString(undefined, { weekday: "short" }) +
        " at " +
        clock(t);
};
const localTime = (n) =>
  new Date(2000, 0, 1, Math.floor(n / 60), n % 60).toLocaleTimeString(
    undefined,
    { hour: "numeric", minute: "2-digit" },
  );
const timeValue = (n) =>
  [Math.floor(n / 60), n % 60].map((v) => String(v).padStart(2, "0")).join(":");
const minutes = (v) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
};
const pages = [
  ["Overview", Aperture],
  ["Groups", UsersRound],
  ["Activities", Gamepad2],
  ["Daily shelf", LibraryBig],
  ["Working hours", CalendarClock],
];
function Days({ selected, onChange }) {
  return (
    <div
      className={"days " + (onChange ? "editable" : "")}
      aria-label="Working days"
    >
      {days.map((day, i) =>
        onChange ? (
          <button
            key={day}
            aria-label={day}
            aria-pressed={selected.includes(i)}
            onClick={() =>
              onChange(
                selected.includes(i)
                  ? selected.filter((d) => d !== i)
                  : [...selected, i].sort(),
              )
            }
          >
            {day.slice(0, 1)}
          </button>
        ) : (
          <span
            key={day}
            title={day + (selected.includes(i) ? " · scheduled" : " · off")}
            className={selected.includes(i) ? "chosen" : ""}
          >
            {day[0]}
          </span>
        ),
      )}
    </div>
  );
}
function Schedule({ rules, ready, onSave, busy }) {
  const value = rules.schedule;
  const [preview, setPreview] = useState(null);
  const [draft, set] = useState(value),
    [changed, mark] = useState(false);
  useEffect(() => {
    if (!changed) set(value);
  }, [JSON.stringify(value), changed]);
  const edit = (p) => {
    set({ ...draft, ...p });
    mark(true);
  };
  const invalid =
    !draft.days.length ||
    !Number.isFinite(draft.start) ||
    !Number.isFinite(draft.end) ||
    draft.start === draft.end;
  useEffect(() => {
    let alive = true;
    setPreview(null);
    if (changed && !invalid) {
      invoke("preview_schedule", { rules, schedule: draft })
        .then((v) => {
          if (alive) setPreview(v);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [changed, invalid, JSON.stringify(draft), JSON.stringify(rules)]);
  function saveHint() {
    if (invalid) return "Choose a day and two different times.";
    if (preview) {
      if (!draft.enabled) return "Weekly blocking will pause.";
      if (!ready) return "These hours take effect after blocker setup.";
      if (preview.scheduled)
        return (
          "These hours apply immediately, until " +
          when(preview.transition) +
          "."
        );
      if (preview.nextStart)
        return "Next work period starts " + when(preview.nextStart) + ".";
    }
    return Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone.replaceAll("_", " ");
  }
  return (
    <>
      <div className="page-head">
        <h1>Working hours</h1>
      </div>
      <section className="editor">
        <div className="panel">
          <Row
            label="Scheduled blocking"
            hint="Apply your block list automatically during these hours."
          >
            <Switch
              checked={draft.enabled}
              aria-label="Scheduled blocking"
              onCheckedChange={(enabled) => edit({ enabled })}
            />
          </Row>
          <Row label="Repeat">
            <Days selected={draft.days} onChange={(days) => edit({ days })} />
          </Row>
          <Row label="Start time">
            <input
              aria-label="Start time"
              type="time"
              value={timeValue(draft.start)}
              onChange={(e) => edit({ start: minutes(e.target.value) })}
            />
          </Row>
          <Row
            label="End time"
            hint={draft.end < draft.start ? "Ends the following day." : ""}
          >
            <input
              aria-label="End time"
              type="time"
              value={timeValue(draft.end)}
              onChange={(e) => edit({ end: minutes(e.target.value) })}
            />
          </Row>
        </div>
        <div className="save-line">
          <span>{saveHint()}</span>
          <Button
            disabled={busy || invalid || !changed}
            onClick={async () => {
              if (await onSave(draft)) mark(false);
            }}
          >
            Save hours
          </Button>
        </div>
      </section>
    </>
  );
}

function App() {
  const [page, setPage] = useState("Overview"),
    [state, setState] = useState(null),
    [selectedGroup,setSelectedGroup] = useState(null),
    [accessRequest,setAccessRequest] = useState(null),
    [dialog, setDialog] = useState(null),
    [site, setSite] = useState(""),
    [duration, setDuration] = useState(5),
    [customDuration, setCustomDuration] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(null);
  const priorPage = useRef("Overview"),
    revision = useRef(0),
    inFlight = useRef(false),
    toastTimer = useRef(),
    dialogTrigger = useRef(null);
  const notify = (message, undo, label = "Undo") => {
    clearTimeout(toastTimer.current);
    setToast({ message, undo, label });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 8000 : 4500);
  };
  const report = (e) => notify(String(e));
  const appearance = useAppearance(report);
  const appUpdate = useAppUpdates(report);
  const wait = useBreakPause(
    dialog?.type === "break",
    appearance.prefs.breakPause,
  );
  async function refresh() {
    if (inFlight.current) return;
    const seq = ++revision.current;
    try {
      const next = await invoke("focus_request", {
        action: { type: "status" },
      });
      if (seq === revision.current) {
        setState(next);
      }
    } catch (e) {
      if (seq === revision.current) {
        setState((old) =>
          old
            ? {
                ...old,
                ready: false,
                blocked: [],
                problem: "The local blocker could not be reached.",
              }
            : null,
        );
        setError(String(e));
      }
    }
  }
  useEffect(() => {
    refresh();
    const visibleRefresh = () => {
      if (!document.hidden) refresh();
    };
    const timer = setInterval(visibleRefresh, 2000);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibleRefresh);
    };
  }, []);
  function navigate(target) {
    if (target === "Settings" && page !== "Settings") priorPage.current = page;
    setPage(target);
    setAccessRequest(null);
    setError("");
  }
  useEffect(() => {
    const settings = () => navigate("Settings"),
      key = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === ",") {
          e.preventDefault();
          settings();
        }
        if (
          (e.metaKey || e.ctrlKey) &&
          e.key.toLowerCase() === "n" &&
          !dialog
        ) {
          e.preventDefault();
          openDialog("add");
        }
        if (e.key === "Escape" && !dialog && page === "Settings")
          navigate(priorPage.current);
      };
    const menu = async (e) => {
      if (inFlight.current) return;
      if (e.detail === "reopen") {
        refresh();
        return;
      }
      if (e.detail === "settings") {
        dismiss();
        settings();
        return;
      }
      dismiss();
      navigate("Overview");
      if (e.detail === "add") {
        openDialog("add");
        return;
      }
      try {
        const next = await invoke("focus_request", {
          action: { type: "status" },
        });
        setState(next);
        if (typeof e.detail === "string" && e.detail.startsWith("allow/")) {
          const site = e.detail.slice(6);
          if ([...next.blocked,...(next.blockedApps||[])].includes(site)) setAccessRequest({key:site});
          return;
        }
        if (e.detail !== "quick" || !next.ready || next.problem) return;
        if (!next.rules.groups?.some(g=>g.sites.length||g.apps.length)) {
          openDialog("add");
          return;
        }
        if (next.skipped || next.rules.breakUntil > next.now) return;
        openDialog(next.sessionEnd ? "break" : "focus");
      } catch (err) {
        setError(String(err));
      }
    };
    window.addEventListener("fokus-menu", menu);
    window.addEventListener("fokus-settings", settings);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("fokus-menu", menu);
      window.removeEventListener("fokus-settings", settings);
      window.removeEventListener("keydown", key);
    };
  }, [page, dialog]);
  async function act(action, message, undo, label) {
    if (inFlight.current) return false;
    inFlight.current = true;
    revision.current++;
    setBusy(true);
    setError("");
    try {
      const next = await invoke("focus_request", { action });
      setState(next);
      if (next.problem) {
        setError(next.problem);
        return false;
      }
      if (message) notify(message, undo, label);
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  function openDialog(type, domain) {
    dialogTrigger.current = document.activeElement;
    setError("");
    setDialog({ type, domain, fixedSite: !!domain });
    setSite("");
    setCustomDuration(false);
    setDuration(type === "focus" ? 25 : 5);
  }
  function dismiss() {
    setDialog(null);
    setError("");
  }
  async function configure(install) {
    if (!install) {
      openDialog("uninstall");
      return;
    }
    await setup(true);
  }
  async function setup(install) {
    if (inFlight.current) return;
    inFlight.current = true;
    revision.current++;
    setBusy(true);
    setError("");
    try {
      await invoke("configure_helper", { install });
      setState(await invoke("focus_request", { action: { type: "status" } }));
      dismiss();
      notify(install ? "Blocking enabled." : "Blocker uninstalled.");
    } catch (e) {
      setError(String(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const r = state?.rules,
    now = state?.now || 0,
    ready = state?.ready,
    scheduled = state?.scheduled,
    manual = r?.focusUntil > now,
    focusing = scheduled || manual,
    paused = focusing && r?.breakUntil > now;
  const progress = workdayProgress(now, r?.schedule);
  const daylight = Math.sin(Math.PI * progress);
  const validDuration = Number.isInteger(duration) && duration >= 1 && duration <= 240;
  const fault = state?.problem;
  const active = ready && focusing && !paused && !fault;
  const durationBlocked =
    ((dialog?.type === "focus" || dialog?.type === "break") && !validDuration) ||
    (dialog?.type === "break" && (wait > 0 || !active));
  const hasItems=r?.groups?.some(g=>g.sites.length||g.apps.length);
  function focusSummary() {
    if (fault)
      return [
        "Blocker needs attention",
        fault,
        "Reconnect blocker",
        ShieldCheck,
      ];
    if (!ready)
      return [
        "Enable website blocking",
        scheduled && hasItems
          ? "Approve the Mac helper once. Blocking starts now and ends at " +
            when(state.transition) +
            "."
          : state?.nextStart
            ? "Approve the Mac helper once. Blocking starts " +
              when(state.nextStart) +
              "."
            : "Approve the Mac helper once to use your block list.",
        "Enable blocking",
        ShieldCheck,
      ];
    if (!hasItems)
      return [
        "Your list is empty",
        "Add a website to block during your sessions.",
        "Add website",
        Plus,
      ];
    if (paused)
      return [
        "On a break",
        r.breakUntil >= state.sessionEnd
          ? "Your session ends at " +
            clock(state.sessionEnd) +
            ". Sites stay open afterward."
          : "All session groups are open until " + clock(r.breakUntil) + ".",
        "Resume session",
        Play,
      ];
    if (active) {
      const counts = [[state.blocked.length,"site"],[state.blockedApps?.length||0,"app"]].filter(([n])=>n).map(([n,label])=>n+" "+label+(n===1?"":"s"));
      const end = state.sessionEnd;
      return [
        counts.length ? counts.join(" and ")+" blocked" : "No blocks active",
        end ? "Session ends " + when(end) : "",
        "Take a break",
        Coffee,
      ];
    }
    const next = state.nextStart
      ? "Your next session starts " + when(state.nextStart) + "."
      : "Start a session whenever you need one.";
    if (state.skipped)
      return ["Finished early", next, "Resume working hours", Play];
    return ["Off the clock", next, "Start session", Play];
  }
  const [title, detail, actionText, HeroIcon] = focusSummary();
  async function primary() {
    if (!ready || fault) await configure(true);
    else if (!hasItems) openDialog("add");
    else if (paused)
      await act({ type: "resume", site: null }, "Session resumed.");
    else if (state.skipped && !active)
      await act({ type: "resumeHours" }, "Working hours resumed.");
    else openDialog(active ? "break" : "focus");
  }
  async function submit(e) {
    e.preventDefault();
    if (dialog.type === "uninstall") {
      await setup(false);
      return;
    }
    if (dialog.type === "check") {
      dismiss();
      return;
    }
    if (dialog.type === "finish") {
      if (state.needsUpdate) {
        await setup(true);
        return;
      }
      if (
        await act(
          { type: "finishEarly" },
          "Working hours ended for this session.",
        )
      )
        dismiss();
      return;
    }
    if (durationBlocked) return;
    const action =
      dialog.type === "add"
        ? { type: "add", site }
        : dialog.type === "break"
          ? { type: "break", minutes: duration, site: dialog.domain || null }
          : { type: "focus", minutes: duration };
    if (
      await act(
        action,
        dialog.type === "add"
          ? "Website added."
          : dialog.type === "break"
            ? dialog.domain
              ? (names[dialog.domain] || dialog.domain) +
                " allowed until " +
                clock(Math.min(state.sessionEnd, now + duration * 60)) +
                "."
              : "Timed break started."
            : "Session started.",
        dialog.type === "break" && dialog.domain
          ? () => invoke("open_website", { site: dialog.domain }).catch(report)
          : undefined,
        "Open site",
      )
    )
      dismiss();
  }
  return (
    <Theme
      appearance={appearance.mode}
      accentColor="gray"
      grayColor="gray"
      radius="medium"
      className="theme"
    >
      <UpdateOffer update={appUpdate} />
      <div className="shell">
        <aside>
          <div className="brand">
            <img src={"icons/" + appearance.prefs.icon + ".png"} alt="" />
            <div className="brand-label">
              <div className="brand-title"><strong className="wordmark">Fokus</strong><UpdateIndicator update={appUpdate} /></div>
              <span className="today">{new Date((now || Date.now() / 1000) * 1000).toLocaleDateString(undefined, {
                weekday: "long", month: "short", day: "numeric",
              })}</span>
            </div>
          </div>
          <nav aria-label="Workspace">
            {pages.map(([p, I]) => (
              <button
                key={p}
                title={p}
                aria-label={p}
                aria-current={page === p ? "page" : undefined}
                onClick={() => navigate(p)}
              >
                <I />
                <span>{p}</span>
              </button>
            ))}
          </nav>
          <button
            className="settings-link"
            aria-label="Settings"
            title="Settings (⌘,)"
            aria-current={page === "Settings" ? "page" : undefined}
            onClick={() => navigate("Settings")}
          >
            <Gear />
            <span>Settings</span>
            <kbd>⌘,</kbd>
          </button>
        </aside>
        <main key={page}>
          <div className="content">
            {!state ? (
              <div role="status">{error || "Opening"}</div>
            ) : page === "Settings" ? (
              <Settings
                update={appUpdate}
                appearance={appearance}
                ready={ready}
                installed={state.installed ?? ready}
                blockingSites={ready && !state.problem && state.blocked.length > 0}
                needsUpdate={state.needsUpdate}
                busy={busy}
                configure={configure}
                back={() => navigate(priorPage.current)}
                report={report}
              />
            ) : page === "Working hours" ? (
              <Schedule
                rules={r}
                ready={ready}
                busy={busy}
                onSave={(schedule) =>
                  act({ type: "schedule", schedule }, "Working hours saved.")
                }
              />
            ) : page === "Groups" ? (
              state.needsUpdate?<Button onClick={()=>configure(true)}>Update blocker</Button>:
              <Groups state={state} busy={busy} act={act} selected={selectedGroup} setSelected={setSelectedGroup} notify={notify} check={d=>openDialog("check",d)}/>
            ) : page === "Activities" ? (
              <Activities report={report}/>
            ) : page === "Daily shelf" ? (
              <DailyShelf now={now} blocked={state.blocked} report={report}/>
            ) : (
              <>
                <section className="hero" style={{
                  "--sun-progress": progress,
                  "--sun-height": (60 + 5 * progress - 40 * daylight) + "%",
                  "--daylight": daylight,
                }}>
                  <div className="landscape" aria-hidden="true"><span className="sun-disc" /></div>
                  <div className="hero-inner">
                    {(!ready || paused || scheduled || manual) && <div className="hero-state">
                      {paused && ready ? (
                        <Coffee />
                      ) : scheduled ? (
                        <CalendarClock />
                      ) : (
                        <Sun />
                      )}
                      {!ready
                        ? "Mac setup"
                        : paused && ready
                          ? "Timed break"
                          : scheduled
                            ? "Working hours"
                            : "Timed session"}
                    </div>}
                    <h1>{title}</h1>
                    <p>{detail}</p>
                    <div className="hero-actions">
                      <Button disabled={busy} onClick={primary}>
                        <HeroIcon size={15} />
                        {busy && !ready ? "Connecting" : actionText}
                      </Button>
                      {ready && scheduled && !fault && (
                        <button
                          disabled={busy}
                          onClick={() => openDialog("finish")}
                        >
                          Finish early
                        </button>
                      )}
                      {manual && !scheduled && active && (
                        <button
                          onClick={() =>
                            act({ type: "endFocus" }, "Session ended.")
                          }
                        >
                          End session
                        </button>
                      )}
                    </div>
                  </div>
                </section>
                {state.needsUpdate&&<Button onClick={()=>configure(true)} disabled={busy}>Update blocker to edit groups</Button>}
                <SessionGroups state={state} active={active} busy={busy} act={act} clock={clock} delay={appearance.prefs.breakPause} request={accessRequest} onEdit={id=>{setSelectedGroup(id);navigate("Groups")}}/>
              </>
            )}
            {r && error && !dialog && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
        </main>
      </div>
      <Dialog.Root
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v && !busy) dismiss();
        }}
      >
        <Dialog.Content
          maxWidth="385px"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            dialogTrigger.current?.focus();
          }}
        >
          {dialog && (
            <form onSubmit={submit}>
              <div className="dialog-head">
                <Dialog.Title>
                  {
                    {
                      add: "Add a website",
                      focus: "Start session",
                      uninstall: "Uninstall blocker?",
                      check: "Check " + dialog.domain,
                      finish: "Finish working early?",
                      break: dialog.domain
                        ? "Allow " + (names[dialog.domain] || dialog.domain)
                        : "Take a break",
                    }[dialog.type]
                  }
                </Dialog.Title>
                <IconButton
                  type="button"
                  variant="ghost"
                  color="gray"
                  aria-label="Close"
                  onClick={dismiss}
                  disabled={busy}
                >
                  <Close size={16} />
                </IconButton>
              </div>
              <Dialog.Description size="2">
                {
                  {
                    add: "Enter a domain or paste a link.",
                    uninstall:
                      "Your sites will be unblocked. Your list and working hours will be saved.",
                    focus: "How long would you like to block distractions?",
                    check:
                      "Compare the blocking rule with the address macOS returns.",
                    finish: state.needsUpdate
                      ? "This control needs the updated Mac helper. Updating keeps your current session and saved hours."
                      : "Open your sites for the rest of this work period. Your weekly schedule will continue automatically.",
                    break: dialog.domain
                      ? "Only this item will be open."
                      : "Choose how long to pause blocking.",
                  }[dialog.type]
                }
              </Dialog.Description>
              {dialog.type === "add" ? (
                <>
                  <TextField.Root
                    className="domain"
                    aria-label="Website address"
                    autoFocus
                    placeholder="example.com"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    spellCheck={false}
                    autoCapitalize="none"
                  />
                  <ScopePreview input={site} />
                </>
              ) : dialog.type === "check" ? (
                <WebsiteCheck
                  site={dialog.domain}
                  ready={ready}
                  expected={state?.blocked.includes(dialog.domain)}
                />
              ) : (
                (dialog.type === "focus" || dialog.type === "break") && (
                  <>
                    {dialog.type === "break" && !dialog.fixedSite && (
                      <label className="break-scope">
                        Allow access to
                        <Select.Root
                          value={dialog.domain || "all-sites"}
                          onValueChange={(v) =>
                            setDialog({
                              ...dialog,
                              domain: v === "all-sites" ? null : v,
                            })
                          }
                        >
                          <Select.Trigger aria-label="Sites to allow" />
                          <Select.Content position="popper">
                            <Select.Item value="all-sites">
                              All session groups
                            </Select.Item>
                            {r.sites.map((d) => (
                              <Select.Item key={d} value={d}>
                                {names[d] || d}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Root>
                      </label>
                    )}
                    <div className="durations" role="group" aria-label="Duration">
                      {(dialog.type === "focus"
                        ? [15, 25, 45, 60]
                        : [5, 10, 15, 30]
                      ).map((m) => (
                        <button
                          type="button"
                          aria-pressed={!customDuration && duration === m}
                          key={m}
                          onClick={() => { setCustomDuration(false); setDuration(m); }}
                        >
                          {m} min
                        </button>
                      ))}
                      <button type="button" aria-pressed={customDuration}
                        onClick={() => setCustomDuration(true)}>Custom</button>
                    </div>
                    {customDuration && <label className="custom-duration">
                      Minutes
                      <input type="number" min="1" max="240" step="1" required
                        autoFocus value={duration ?? ""} onFocus={e => e.target.select()}
                        onChange={e => setDuration(e.target.value ? e.target.valueAsNumber : null)} />
                    </label>}
                    <small className="resume-time">
                      <Clock3 size={13} />
                      {!validDuration
                        ? "Choose 1–240 minutes."
                        : dialog.type === "focus"
                          ? "Session ends at " + clock(now + duration * 60)
                          : !active
                          ? "This session has ended."
                          : now + duration * 60 >= state.sessionEnd
                            ? "Session ends at " +
                              clock(state.sessionEnd) +
                              ". Sites stay open."
                            : "Blocking resumes at " +
                              clock(now + duration * 60)}
                    </small>
                  </>
                )
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-foot">
                {dialog.type !== "check" && (
                  <Button
                    type="button"
                    variant="soft"
                    color="gray"
                    onClick={dismiss}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  disabled={
                    busy ||
                    (dialog.type === "add" && !site.trim()) ||
                    durationBlocked ||
                    (dialog.type === "finish" && !scheduled)
                  }
                >
                  {wait > 0
                    ? "Available in " + wait + "s"
                    : {
                        add: "Add website",
                        focus: "Start session",
                        uninstall: "Uninstall",
                        finish: state.needsUpdate
                          ? "Update blocker"
                          : "Finish early",
                        check: "Done",
                        break: dialog.domain && validDuration
                          ? "Allow for " + duration + " min"
                          : "Start break",
                      }[dialog.type]}
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Root>
      {toast && (
        <div className="toast" role="status">
          <Check size={14} />
          {toast.message}
          {toast.undo && (
            <button
              onClick={() => {
                const undo = toast.undo;
                setToast(null);
                undo();
              }}
            >
              {toast.label}
            </button>
          )}
        </div>
      )}
    </Theme>
  );
}
createRoot(document.getElementById("root")).render(<App />);
