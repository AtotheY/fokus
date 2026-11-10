import React, { useEffect, useState } from "react";
import { Button, Dialog, Popover, Switch } from "@radix-ui/themes";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Folder,
  Gamepad2,
  LockKeyhole,
  Minus,
  Pencil,
  Plus,
  Shield,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import { IdentityIcon, SitePreviews } from "./identity";
import { invoke } from "./settings";
import { useBreakPause } from "./website";

const groupIcon = (name) =>
  ({
    "Social media": UsersRound,
    Gaming: Gamepad2,
    Shopping: ShoppingBag,
    "Adult websites": Shield,
  })[name] || Folder;
const enabled = (g, now) =>
  now < g.choiceUntil ? (g.sessionChoice ?? g.enabled) : g.enabled;
const entries = (g) => [
  ...g.sites.map((site) => ({ key: site, name: site })),
  ...g.apps.map((app) => ({ key: "app:" + app.id, name: app.name, app: true })),
];
const plural = (n, s) => n + " " + s + (n === 1 ? "" : "s");
const describe = (g) =>
  [
    g.sites.length && plural(g.sites.length, "site"),
    g.apps.length && plural(g.apps.length, "app"),
  ]
    .filter(Boolean)
    .join(" · ") || "Empty group";

function Access({
  item,
  until,
  now,
  clock,
  open,
  setOpen,
  act,
  busy,
  delay,
  sessionEnd,
}) {
  const allowed = until > now;
  const remaining = useBreakPause(open && !allowed, delay);
  async function choose(minutes) {
    const action = minutes
      ? { type: "break", site: item.key, minutes }
      : { type: "resume", site: item.key };
    if (await act(action)) setOpen(false);
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <button
          className={allowed ? "access-chip" : "access-lock"}
          aria-label={
            (allowed ? "Manage access to " : "Temporarily unblock ") + item.name
          }
        >
          {allowed ? (
            <>
              <Clock3 size={12} /> Open until {clock(until)}
            </>
          ) : (
            <>
              <span>Unblock</span>
              <LockKeyhole size={13} />
            </>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Content
        size="1"
        align="end"
        width="214px"
        className="access-pop"
        onOpenAutoFocus={(e) => {
          const el = e.currentTarget.querySelector("[data-default]");
          if (el) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <b>{item.name}</b>
        <p>
          {allowed
            ? (until >= sessionEnd
                ? "Session ends at "
                : "Blocking resumes at ") + clock(until)
            : remaining
              ? "Available in " + remaining + "s"
              : "Unblock temporarily"}
        </p>
        {allowed ? (
          <Button
            size="1"
            variant="soft"
            onClick={() => choose(0)}
            disabled={busy}
          >
            Block now
          </Button>
        ) : (
          <div className="access-durations">
            {[1, 5, 15].map((m) => (
              <Button
                size="1"
                key={m}
                data-default={m === 5 ? "true" : undefined}
                variant={m === 5 ? "solid" : "soft"}
                onClick={() => choose(m)}
                disabled={busy || remaining > 0}
              >
                {m} min
              </Button>
            ))}
          </div>
        )}
      </Popover.Content>
    </Popover.Root>
  );
}

export function SessionGroups({
  state,
  active,
  busy,
  act,
  delay,
  clock,
  onEdit,
  request,
}) {
  const groups = state.rules.groups;
  const [expanded, setExpanded] = useState(() => {
    const first = groups[0];
    return first && first.sites.length + first.apps.length <= 5 ? first.id : null;
  });
  const [access, setAccess] = useState(null);
  const now = state.now;
  useEffect(() => {
    if (!request) return;
    const g = groups.find(
      (g) => enabled(g, now) && entries(g).some((e) => e.key === request.key),
    );
    if (g) {
      setExpanded(g.id);
      setAccess(request.key);
    }
  }, [request]);
  return (
    <section className="session-groups">
      <h2>What to block</h2>
      {groups.map((g) => {
        const Icon = groupIcon(g.name),
          on = enabled(g, now);
        return (
          <section className="session-group" key={g.id}>
            <div className="group-bar">
              <button
                aria-expanded={expanded === g.id}
                className="group-disclose"
                onClick={() => {
                  setAccess(null);
                  setExpanded(expanded === g.id ? null : g.id);
                }}
              >
                {expanded === g.id ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <span className="group-icon">
                  <Icon size={15} />
                </span>
                <b>{g.name}</b>
                <small>{describe(g)}</small>
              </button>
              <Switch
                size="1"
                aria-label={"Block " + g.name}
                checked={on}
                disabled={busy || state.needsUpdate}
                onCheckedChange={(enabled) =>
                  act({
                    type: "group",
                    change: { op: "toggle", id: g.id, enabled },
                  })
                }
              />
            </div>
            {expanded === g.id && (
              <div className="group-body">
                {entries(g).map((item) => {
                  const available =
                    active &&
                    groups.some(
                      (other) =>
                        enabled(other, now) &&
                        entries(other).some((x) => x.key === item.key),
                    );
                  return (
                    <div className="group-item" key={item.key}>
                      <IdentityIcon site={item.key} appId={item.app ? item.key.slice(4) : undefined} />
                      <span>{item.name}</span>
                      {item.app && <small>Desktop app</small>}
                      <div className="item-end">
                        {available ? (
                          <Access
                            {...{ item, now, clock, act, busy, delay }}
                            sessionEnd={state.sessionEnd}
                            until={state.rules.siteBreaks[item.key] || 0}
                            open={access === item.key}
                            setOpen={(value) =>
                              setAccess(value ? item.key : null)
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {!entries(g).length && <small>No sites or apps yet</small>}
                <button className="text-action" onClick={() => onEdit(g.id)}>
                  <Pencil size={12} />
                  Edit group
                </button>
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}

export function Groups({
  state,
  busy,
  act,
  selected,
  setSelected,
  check,
  notify,
}) {
  const groups = state.rules.groups,
    g = groups.find((g) => g.id === selected) || groups[0];
  const [form, setForm] = useState(""),
    [value, setValue] = useState(""),
    [apps, setApps] = useState(null),
    [error, setError] = useState("");
  const edit = (change) => act({ type: "group", change });
  function show(kind) {
    setValue(kind === "rename" ? g.name : "");
    setError("");
    setForm(kind);
  }
  useEffect(() => {
    if (form === "apps")
      invoke("installed_apps")
        .then(setApps)
        .catch((e) => setError(String(e)));
  }, [form]);
  async function save(e) {
    e.preventDefault();
    let change;
    if (form === "sites")
      change = {
        op: "addSites",
        id: g.id,
        sites: value
          .trim()
          .split(/[\s,]+/)
          .filter(Boolean),
      };
    else if (form === "delete") change = { op: "delete", id: g.id };
    else change = { op: form, id: g.id, name: value.trim() };
    if (await edit(change)) {
      if (form === "create")
        setSelected(Math.max(...groups.map((x) => x.id)) + 1);
      setForm("");
    } else setError("Could not save. Check the name or domains and try again.");
  }
  async function remove(item) {
    const change = item.app
      ? { op: "removeApp", id: g.id, app: item.key.slice(4) }
      : { op: "removeSite", id: g.id, site: item.key };
    if (await edit(change))
      notify(item.name + " removed.", () =>
        edit(
          item.app
            ? {
                op: "addApp",
                id: g.id,
                app: { id: item.key.slice(4), name: item.name },
              }
            : { op: "addSites", id: g.id, sites: [item.key] },
        ),
      );
  }
  return (
    <section>
      <div className="page-head">
        <h1>Groups</h1>
        <Button
          size="1"
          disabled={state.needsUpdate}
          onClick={() => show("create")}
        >
          <Plus size={13} />
          New group
        </Button>
      </div>
      <div className="groups-editor">
        <div className="group-index">
          {groups.map((x) => {
            const Icon = groupIcon(x.name);
            return (
              <button
                key={x.id}
                aria-pressed={x.id === g.id}
                onClick={() => setSelected(x.id)}
              >
                <Icon size={14} />
                {x.name}
              </button>
            );
          })}
        </div>
        <div className="group-detail">
          <header>
            <h2>{g.name}</h2>
            <button className="text-action" onClick={() => show("rename")}>
              <Pencil size={12} />
              Rename
            </button>
          </header>
          <small>{describe(g)}</small>
          <div className="group-tools">
            <Button variant="soft" size="1" onClick={() => show("sites")}>
              Add sites
            </Button>
            <Button variant="soft" size="1" onClick={() => show("apps")}>
              Add apps
            </Button>
          </div>
          {entries(g).map((item) => (
            <div key={item.key} className="group-item">
              <IdentityIcon site={item.key} appId={item.app ? item.key.slice(4) : undefined} />
              <span>{item.name}</span>
              <small className="item-end">
                {item.app ? "Desktop app" : "Website"}
              </small>
              {!item.app && (
                <button
                  className="small-action"
                  onClick={() => check(item.key)}
                  aria-label={"Check blocking for " + item.name}
                >
                  <Shield size={13} />
                </button>
              )}
              <button
                className="small-action"
                aria-label={"Remove " + item.name}
                disabled={busy}
                onClick={() => remove(item)}
              >
                <Minus size={14} />
              </button>
            </div>
          ))}
          {!entries(g).length && <small>Add the first site or app.</small>}
          <div className="default-choice">
            <label htmlFor="scheduled-default">Use in new sessions</label>
            <Switch
              id="scheduled-default"
              size="1"
              checked={g.enabled}
              disabled={busy}
              onCheckedChange={(enabled) =>
                edit({ op: "setDefault", id: g.id, enabled })
              }
            />
          </div>
          {groups.length > 1 && (
            <button className="text-action" onClick={() => show("delete")}>
              Delete group
            </button>
          )}
        </div>
      </div>
      <Dialog.Root
        open={!!form}
        onOpenChange={(v) => {
          if (!v && !busy) setForm("");
        }}
      >
        <Dialog.Content maxWidth="380px">
          <Dialog.Title>
            {
              {
                create: "New group",
                rename: "Rename group",
                delete: "Delete " + g.name + "?",
                apps: "Add apps",
                sites: "Add sites",
              }[form]
            }
          </Dialog.Title>
          <form onSubmit={save}>
            {form === "apps" ? (
              <>
                <input
                  autoFocus
                  className="entry"
                  aria-label="Search apps"
                  placeholder="Search installed apps"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                <div className="app-picker">
                  {apps === null
                    ? "Loading apps"
                    : apps
                        .filter((a) =>
                          a.name.toLowerCase().includes(value.toLowerCase()),
                        )
                        .map((a) => (
                          <button
                            type="button"
                            key={a.id}
                            disabled={busy || g.apps.some((x) => x.id === a.id)}
                            onClick={async () => {
                              if (
                                await edit({ op: "addApp", id: g.id, app: a })
                              )
                                setForm("");
                            }}
                          >
                            <IdentityIcon appId={a.id} />
                            {a.name}
                          </button>
                        ))}
                  {apps &&
                    !apps.some((a) =>
                      a.name.toLowerCase().includes(value.toLowerCase()),
                    ) && <small>No matching apps</small>}
                </div>
              </>
            ) : form === "sites" ? (
              <>
              <textarea
                className="entry"
                aria-label="Domains"
                autoFocus
                placeholder="Paste domains, one per line"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
                <SitePreviews value={value} />
              </>
            ) : form === "delete" ? (
              <p>Remove this group and its entries from your schedule.</p>
            ) : (
              <input
                className="entry"
                autoFocus
                aria-label="Group name"
                placeholder="Group name"
                maxLength={60}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
            {error && <p role="alert">{error}</p>}
            <div className="dialog-foot">
              <Button type="button" variant="soft" onClick={() => setForm("")}>
                Close
              </Button>
              {form !== "apps" && (
                <Button disabled={busy || (form !== "delete" && !value.trim())}>
                  {form === "delete"
                    ? "Delete"
                    : form === "sites"
                      ? "Add sites"
                      : "Save"}
                </Button>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Root>
    </section>
  );
}
