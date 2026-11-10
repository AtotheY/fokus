import React, { useEffect, useState } from "react";
import { Check, FolderOpen, ArrowLeft } from "lucide-react";
import { Button, SegmentedControl, Switch, Select } from "@radix-ui/themes";

export const finishes =
  "ceramic celadon midnight obsidian amber frost travertine copper ink bloom graphite safelight".split(
    " ",
  );
const initial = {
  icon: "ceramic",
  mode: "dark",
  darkTheme: "Studio",
  lightTheme: "Studio",
  transparency: 0,
  blur: true,
  outlines: true,
  fades: false,
  adaptive: true,
  breakPause: false,
};
const palettes = {
  dark: {
    Studio: [
      "#1a1a20",
      "#eeeeef",
      "#c2b1e5",
      "#121216",
      "#232329",
      "#34343c",
      "#a8a6b0",
    ],
    Dune: [
      "#26221e",
      "#f2ede5",
      "#e2bd8a",
      "#191613",
      "#302b25",
      "#454039",
      "#b5aba0",
    ],
    Grove: [
      "#1c2420",
      "#e8eee9",
      "#a3c6a4",
      "#151b17",
      "#28302a",
      "#3b483e",
      "#a3afa6",
    ],
  },
  light: {
    Studio: [
      "#faf9f7",
      "#29272b",
      "#655382",
      "#eeedeb",
      "#ffffff",
      "#dedce1",
      "#68646e",
    ],
    Dune: [
      "#faf6eb",
      "#352c23",
      "#8c6238",
      "#f1eadb",
      "#fffaf1",
      "#ded5c6",
      "#736959",
    ],
    Grove: [
      "#f2f7f2",
      "#28362c",
      "#476b4f",
      "#e9efe8",
      "#fafcf9",
      "#d1dcd2",
      "#5d705f",
    ],
  },
};
const cssKeys = [
  "base",
  "text",
  "accent",
  "gutter",
  "surface",
  "outline",
  "subtext",
];
function colours(css) {
  const result = {};
  for (const [, key, value] of css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .matchAll(/--([\w-]+)\s*:\s*(#[\da-f]{3,6})\s*[;}]/gi))
    if (cssKeys.includes(key)) result[key] = value;
  if (!result.base || !result.text || !result.accent) return null;
  return {
    mode: /color-scheme:\s*light/i.test(css) ? "light" : "dark",
    result,
  };
}
export const invoke = (command, args) =>
  window.__TAURI__.core.invoke(command, args);
export function useAppearance(report) {
  const [prefs, set] = useState(() => {
    try {
      return {
        ...initial,
        ...JSON.parse(localStorage.getItem("fokus-appearance")),
      };
    } catch {
      return initial;
    }
  });
  const [system, setSystem] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [extra, setExtra] = useState({});
  const mode =
    prefs.mode === "system" ? (system ? "dark" : "light") : prefs.mode;
  useEffect(() => {
    const q = matchMedia("(prefers-color-scheme: dark)"),
      cb = (e) => setSystem(e.matches);
    q.addEventListener("change", cb);
    return () => q.removeEventListener("change", cb);
  }, []);
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      invoke("theme_files", { open: false })
        .then((files) => {
          if (alive)
            setExtra((old) =>
              JSON.stringify(old) === JSON.stringify(files) ? old : files,
            );
        })
        .catch(report);
    refresh();
    const id = setInterval(refresh, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const all = Object.fromEntries(
    Object.entries({ ...BUNDLED_THEMES, ...extra })
      .map(([name, css]) => [name, colours(css)])
      .filter(([, value]) => value),
  );
  const selected = prefs[mode + "Theme"];
  const base = palettes[mode][selected] || palettes[mode].Studio;
  const colors = {
    ...Object.fromEntries(cssKeys.map((k, i) => [k, base[i]])),
    ...all[selected]?.result,
  };
  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(colors))
      root.style.setProperty("--" + k, v);
    root.style.setProperty("--opacity", 100 - 0.7 * prefs.transparency + "%");
    root.dataset.outlines = prefs.outlines;
    root.dataset.fades = prefs.fades;
    root.dataset.adaptive = prefs.adaptive;
    root.style.colorScheme = mode;
    document.querySelector('link[rel="icon"]').href =
      "icons/" + prefs.icon + ".png";
    localStorage.setItem("fokus-appearance", JSON.stringify(prefs));
  }, [prefs, mode, JSON.stringify(colors)]);
  useEffect(() => {
    invoke("appearance", {
      icon: prefs.icon,
      mode: prefs.mode,
      blur: prefs.transparency > 0 && prefs.blur,
    }).catch(report);
  }, [prefs.icon, prefs.mode, prefs.blur, prefs.transparency > 0]);
  return {
    prefs,
    mode,
    colors,
    choices: [
      ...Object.keys(palettes[mode]),
      ...Object.keys(all)
        .filter((n) => all[n].mode === mode)
        .sort(),
    ],
    save: (patch) => set((p) => ({ ...p, ...patch })),
  };
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);
function CometProtection({ report }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let mounted = true;
    const read = () => invoke("comet_status").then(value => {
      if (mounted) setStatus(value);
    }).catch(report);
    read();
    const timer = setInterval(read, 3000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);
  if (!status?.available) return null;
  const hints = {
    connected: "Open tabs follow your block list during sessions.",
    waiting: "Ready when Comet opens.",
    idle: "Ready for your next session.",
    denied: "Allow Fokus to control Comet in macOS Automation settings.",
    retrying: "Reconnecting to Comet…",
  };
  return <Row label="Comet tab blocking" hint={hints[status.state]}>
    {status.state === "denied" && <Button variant="soft" onClick={() => invoke("open_automation_settings").catch(report)}>Open settings…</Button>}
    {status.state === "connected" && <Check size={16} aria-label="Connected" />}
  </Row>;
}

export function Settings({
  appearance: a,
  back,
  ready,
  installed,
  needsUpdate,
  blockingSites,
  configure,
  busy,
  report,
}) {
  const [tab, setTab] = useState("App icon");
  const { prefs: p, save } = a;
  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <Button variant="ghost" color="gray" onClick={back}>
          <ArrowLeft size={15} />
          Back
        </Button>
      </div>
      <div className="setting-tabs" aria-label="Settings sections">
        {["App icon", "Colours", "Window", "Blocker"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "App icon" ? (
        <section>
          <h2>App icon</h2>
          <div className="finish-grid">
            {finishes.map((f) => (
              <button
                key={f}
                className="finish"
                aria-pressed={p.icon === f}
                onClick={() => save({ icon: f })}
              >
                <span>
                  <img src={"icons/" + f + ".png"} alt="" />
                  {p.icon === f && (
                    <i>
                      <Check size={12} />
                    </i>
                  )}
                </span>
                {cap(f)}
              </button>
            ))}
          </div>
        </section>
      ) : tab === "Colours" ? (
        <section>
          <h2>Colours</h2>
          <div className="panel">
            <Row label="Mode">
              <SegmentedControl.Root
                value={p.mode}
                onValueChange={(mode) => save({ mode })}
              >
                {["system", "dark", "light"].map((m) => (
                  <SegmentedControl.Item key={m} value={m}>
                    {cap(m)}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
            </Row>
            <Row label={cap(a.mode) + " theme"}>
              <Select.Root
                value={p[a.mode + "Theme"]}
                onValueChange={(v) => save({ [a.mode + "Theme"]: v })}
              >
                <Select.Trigger aria-label="Colour theme" />
                <Select.Content position="popper">
                  {a.choices.map((c) => (
                    <Select.Item key={c} value={c}>
                      {c}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Row>
            <Row
              label="Custom themes"
              hint="Add a CSS colour scheme to your themes folder."
            >
              <Button
                variant="soft"
                color="gray"
                onClick={() =>
                  invoke("theme_files", { open: true }).catch(report)
                }
              >
                <FolderOpen size={15} />
                Open folder
              </Button>
            </Row>
          </div>
        </section>
      ) : tab === "Window" ? (
        <section>
          <h2>Window</h2>
          <div className="panel">
            <Row label="Transparency">
              <input
                aria-label="Window transparency"
                type="range"
                min="0"
                max="100"
                value={p.transparency}
                onChange={(e) => save({ transparency: Number(e.target.value) })}
              />
              <output>{p.transparency}%</output>
            </Row>
            {[
              [
                "blur",
                "Background blur",
                "Soften the desktop behind a transparent window.",
              ],
              [
                "outlines",
                "Card outlines",
                "Show a fine border around panels.",
              ],
              ["fades", "Scroll fades", "Fade the bottom edge of long pages."],
              [
                "adaptive",
                "Adaptive header colour",
                "Tint the landscape with your theme.",
              ],
            ].map(([k, l, h]) => (
              <Row key={k} label={l} hint={h}>
                <Switch
                  aria-label={l}
                  disabled={k === "blur" && !p.transparency}
                  checked={p[k]}
                  onCheckedChange={(v) => save({ [k]: v })}
                />
              </Row>
            ))}
          </div>
        </section>
      ) : (
        <section>
          <h2>Website blocker</h2>
          <div className="panel">
            <CometProtection report={report}/>
            {needsUpdate && (
              <Row
                label="Blocker update available"
                hint="Keep your current session and enable the new session controls."
              >
                <Button
                  variant="soft"
                  disabled={busy}
                  onClick={() => configure(true)}
                >
                  Update blocker
                </Button>
              </Row>
            )}
            <Row
              label="Pause before a break"
              hint="Wait five seconds before opening blocked sites."
            >
              <Switch
                aria-label="Pause before a break"
                checked={p.breakPause}
                onCheckedChange={(v) => save({ breakPause: v })}
              />
            </Row>
            <Row
              label={
                ready
                  ? "Blocker connected"
                  : installed
                    ? "Blocker needs attention"
                    : "Blocker setup"
              }
              hint={
                ready
                  ? "Working hours and breaks continue when the window is closed."
                  : "Allow the local helper to apply your block list on this Mac."
              }
            >
              <Button
                variant="soft"
                color="gray"
                disabled={busy}
                onClick={() => configure(!installed)}
              >
                {installed ? "Uninstall blocker" : "Enable blocking"}
              </Button>
            </Row>
            {blockingSites && <Row label="Share a successful block"
              hint="Optional. Opens the Fokus site with an anonymous setup receipt. Your block list stays on this Mac.">
              <Button variant="soft" color="gray" onClick={async () => {
                try {
                  const key = "fokus.setup-receipt";
                  const id = localStorage.getItem(key) || crypto.randomUUID();
                  localStorage.setItem(key, id);
                  await invoke("open_game", { url: "https://usefokus.dev/setup-confirmed/#" + id });
                } catch (err) { report(String(err)); }
              }}>Share result</Button>
            </Row>}
          </div>
        </section>
      )}
    </>
  );
}
export function Row({ label, hint, children }) {
  return (
    <div className="setting-row">
      <div>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}
