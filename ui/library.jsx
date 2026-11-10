import React, { useState } from "react";
import { Button, Dialog } from "@radix-ui/themes";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Check,
  Circle,
  CircleCheck,
  Grid2X2,
  PenLine,
  Plus,
  SlidersHorizontal,
  Sprout,
  Trash2,
  Waves,
} from "lucide-react";
import { invoke } from "./settings";

const catalog = [
  ["Krillion", "Timed trivia", "https://krillion.io/"],
  ["Connections", "Word groups", "https://www.nytimes.com/games/connections"],
  ["Wordle", "Word puzzle", "https://www.nytimes.com/games/wordle/index.html"],
  ["Minute Cryptic", "Daily clue", "https://www.minutecryptic.com/"],
  ["Number Waffle", "Number puzzle", "https://wafflegame.net/numberwaffle"],
  ["Size It Up", "Visual estimation", "https://magnitudle.com/size-it-up"],
  ["Layers", "Word groups", "https://www.hiddenlayerlabs.com/play/"],
  ["Poople", "Word ladder", "https://poople.io/"],
  ["Dartwords", "Word puzzle", "https://www.dartwords.com/"],
  ["Feetle", "Word ladder", "https://feetle.fun/"],
  ["Originle", "Geography", "https://originle.io/"],
  ["Moonshot", "Trivia", "https://moonshotdailygame.com/"],
  ["Draw the Border", "Geography", "https://drawtheborder.com/"],
].map(([name, type, url]) => ({ name, type, url }));

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
    next = remaining[0],
    completed = games.length - remaining.length;
  const FeaturedIcon = next?.name === "Krillion" ? Waves : next?.name === "Minute Cryptic" ? PenLine : Grid2X2;
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
        <button className="text-action" onClick={() => setEditing(!editing)}>
          {editing ? <Check size={14} /> : <SlidersHorizontal size={14} />}{" "}
          {editing ? "Done editing" : "Edit shelf"}
        </button>
      </div>
      <div className="routine-header">
        <div>
          <small>
            {date.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
            })}
          </small>
          <h2>
            {date.toLocaleDateString(undefined, { weekday: "long" })}’s dailies
          </h2>
          {games.length > 0 && (
            <div className="routine-progress">
              <progress value={completed} max={games.length} />
              {completed} of {games.length} complete
            </div>
          )}
        </div>
        <div className="history">
          <div>
            <b>
              <Sprout size={14} />{" "}
              {streak ? streak + " day streak" : "Past 7 days"}
            </b>
            {streak > 0 && <small>Past 7 days</small>}
          </div>
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
        </div>
      </div>
      {next ? (
        <div className="next-game">
          <div>
            <small>Up next</small>
            <h3>{next.name}</h3>
            <p>{next.type}</p>
            <Button size="1" onClick={() => open(next)}>
              Play {next.name}
              <ArrowUpRight size={13} />
            </Button>
          </div>
          <FeaturedIcon aria-hidden="true" />
        </div>
      ) : (
        <p className="shelf-empty">
          {games.length ? "All done for today" : "Choose your first daily game"}
        </p>
      )}
      <div className="section-head">
        <h2>My routine</h2>
        <button className="text-action" onClick={() => setAdding(true)}>
          <Plus size={14} />
          Add game
        </button>
      </div>
      {games.map((g, i) => {
        const finished = done.includes(g.url);
        return (
          <div className="routine-line" key={g.url}>
            <button
              className="small-action"
              aria-label={
                (finished ? "Undo completion of " : "Mark done ") + g.name
              }
              onClick={() =>
                save({
                  ...data,
                  history: {
                    ...history,
                    [today]: finished
                      ? done.filter((x) => x !== g.url)
                      : [...done, g.url],
                  },
                })
              }
            >
              {finished ? <CircleCheck size={16} /> : <Circle size={16} />}
            </button>
            <button onClick={() => open(g)}>
              {g.name}
              <ArrowUpRight size={11} />
            </button>
            <small>{finished ? "Done today" : g.type}</small>
            {editing && (
              <>
                <button
                  disabled={!i}
                  aria-label={"Move " + g.name + " up"}
                  onClick={() => reorder(i, -1)}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  disabled={i === games.length - 1}
                  aria-label={"Move " + g.name + " down"}
                  onClick={() => reorder(i, 1)}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  aria-label={"Remove " + g.name}
                  onClick={() =>
                    save({ ...data, games: games.filter((x) => x !== g) })
                  }
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        );
      })}
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
