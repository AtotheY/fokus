import React, { useState } from "react";
import { Button, Dialog } from "@radix-ui/themes";
import {
  Check,
  Plus,
  SlidersHorizontal,
  Sprout,
} from "lucide-react";
import { ShelfTiles } from "./shelf-tiles";
import { invoke } from "./settings";

import { catalog } from "./daily-games.mjs";

export function useSaved(key, initial) {
  const [data, set] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initial;
    } catch {
      return initial;
    }
  });
  function save(next) {
    localStorage.setItem(key, JSON.stringify(next));
    set(next);
  }
  return [data, save];
}
function dateKey(date, offset = 0) {
  const d = new Date(date);
  d.setDate(d.getDate() + offset);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export function DailyShelf({ now, report, blocked }) {
  const [data, save] = useSaved("fokus-shelf-v1", {
    games: catalog.slice(0, 4),
    history: {},
  });
  const [editing, setEditing] = useState(false),
    [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const { games, history } = data,
    date = new Date(now * 1000),
    today = dateKey(date),
    done = history[today] ?? [];
  const remaining = games.filter((g) => !done.includes(g.url)),
    completed = games.length - remaining.length;
  let streak = 0;
  for (
    let off = done.length ? 0 : -1;
    history[dateKey(date, off)]?.length;
    off--
  )
    streak++;
  const add = (g) => {
    if (!games.some((x) => x.url === g.url))
      save({ ...data, games: [...games, g] });
    setAdding(false);
    setError("");
    setName("");
    setUrl("");
  };
  function custom(e) {
    e.preventDefault();
    try {
      const target = new URL(url.trim());
      if (
        !["http:", "https:"].includes(target.protocol) ||
        target.username ||
        target.password ||
        !name.trim()
      )
        throw Error();
      if (games.some((g) => g.url === target.href)) {
        setError("Already on your shelf.");
        return;
      }
      add({ name: name.trim(), url: target.href, type: "Custom game" });
    } catch {
      setError("Enter a name and a complete website URL.");
    }
  }
  function open(g) {
    const host = new URL(g.url).hostname.replace(/^www\./, "");
    if (blocked.some((s) => host === s || host.endsWith("." + s))) {
      report(host + " is blocked during this session.");
      return;
    }
    invoke("open_game", { url: g.url }).catch(report);
  }
  function reorder(i, step) {
    const list = [...games];
    [list[i], list[i + step]] = [list[i + step], list[i]];
    save({ ...data, games: list });
  }
  return (
    <section className="shelf-page">
      <div className="page-head">
        <h1>Daily shelf</h1>
        <div className="shelf-actions">
          {games.length > 0 && <button className="text-action" onClick={() => setEditing(!editing)}>
            {editing ? <Check size={14}/> : <SlidersHorizontal size={14}/>}
            {editing ? "Done editing" : "Edit shelf"}
          </button>}
          <button className="text-action" onClick={()=>setAdding(true)}><Plus size={14}/> Add game</button>
        </div>
      </div>
      <div className="shelf-summary">
        <span role="status">{games.length ? completed === games.length ? "All done for today" : completed + " of " + games.length + " complete" : "Choose your first daily game"}</span>
        <details><summary><Sprout size={14}/>{streak ? streak + " day streak" : "Past 7 days"}</summary>
          <div className="stamps">
            {Array.from({ length: 7 }, (_, i) => {
              const day = new Date(date);
              day.setDate(date.getDate() + i - 6);
              const key = dateKey(day),
                played = history[key]?.length > 0;
              return (
                <span
                  key={key}
                  title={
                    day.toLocaleDateString() + (played ? " · completed" : "")
                  }
                  className={
                    (played ? "filled " : "") + (i === 6 ? "today-stamp" : "")
                  }
                >
                  <i />
                  {day.toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
              );
            })}
          </div>
        </details>
      </div>
      <ShelfTiles games={games} done={done} open={open} editing={editing} reorder={reorder}
        remove={game=>save({...data, games:games.filter(g=>g !== game)})}
        toggle={game=>save({...data, history:{...history, [today]:done.includes(game.url)
          ? done.filter(url=>url !== game.url) : [...done, game.url]}})} />
      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Content maxWidth="380px">
          <Dialog.Title>Add game</Dialog.Title>
          <div className="app-picker">
            {catalog
              .filter((g) => !games.some((a) => a.url === g.url))
              .map((g) => (
                <button key={g.url} onClick={() => add(g)}>
                  {g.name}
                  <small>{g.type}</small>
                </button>
              ))}
          </div>
          <form onSubmit={custom}>
            <h3>Custom game</h3>
            <input
              className="entry"
              placeholder="Game name"
              aria-label="Game name"
              maxLength={70}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="entry"
              placeholder="https://example.com/game"
              aria-label="Game URL"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {error && <p role="alert">{error}</p>}
            <div className="dialog-foot">
              <Button
                type="button"
                variant="soft"
                onClick={() => setAdding(false)}
              >
                Close
              </Button>
              <Button disabled={!name.trim() || !url.trim()}>Add game</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Root>
    </section>
  );
}
