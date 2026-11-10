import React, { useEffect, useRef, useState } from "react";
import { Button, Dialog, Popover } from "@radix-ui/themes";
import {
  ArrowLeft,
  ArrowRight,
  Bomb,
  Check,
  CircleHelp,
  Flag,
  MousePointer2,
  RotateCcw,
  X,
} from "lucide-react";
import { invoke } from "./settings";
import { useSaved } from "./library";
import {
  SIDE,
  CELLS,
  MINE_COUNT,
  clue,
  uncover,
  toggleFlag,
  wordPath,
  matchWord,
  arrowCell,
} from "./puzzle-rules.mjs";
import "./puzzles.css";

const MINES = "Minesweeper";
const WORDS = "Word Search";
const colors = [
  "#99bea1",
  "#d9b583",
  "#b3a6cf",
  "#96b9d0",
  "#dba6a5",
  "#b6be82",
];
const location = (i) =>
  "Row " + (Math.floor(i / SIDE) + 1) + ", column " + ((i % SIDE) + 1);

function useGridKeys(onMove) {
  const [cursor, setCursor] = useState(0);
  return (i) => ({
    "data-cell": i,
    tabIndex: cursor === i ? 0 : -1,
    onFocus: () => setCursor(i),
    onKeyDown: (event) => {
      const next = arrowCell(i, event.key);
      if (next === null) return;
      event.preventDefault();
      event.currentTarget.parentElement
        .querySelector('[data-cell="' + next + '"]')
        .focus();
      onMove?.(next);
    },
  });
}

export function Mines({ board, save }) {
  const [flagMode, setFlagMode] = useState(false);
  const flagsLeft = MINE_COUNT - board.flags.length;
  const bind = useGridKeys();
  return (
    <>
      <div className="puzzle-tools">
        <span className="puzzle-count">
          <Flag size={14} />
          {flagsLeft >= 0
            ? flagsLeft + (flagsLeft === 1 ? " flag left" : " flags left")
            : -flagsLeft + " extra flags"}
        </span>
        <div className="mine-modes" role="group" aria-label="Click action">
          <button aria-pressed={!flagMode} onClick={() => setFlagMode(false)}>
            <MousePointer2 size={13} /> Reveal
          </button>
          <button aria-pressed={flagMode} onClick={() => setFlagMode(true)}>
            <Flag size={13} /> Flag
          </button>
        </div>
      </div>
      <div className="mine-frame">
        <div
          className="puzzle-grid mine-grid"
          role="group"
          aria-label="Minefield"
        >
          {CELLS.map((i) => {
            const shown = board.revealed.includes(i),
              flag = board.flags.includes(i);
            const mine = Boolean(board.ended && board.mines?.includes(i));
            const wrong = flag && board.ended === "Mine found" && !mine;
            const count = shown ? clue(board.mines, i) : 0;
            const name = wrong
              ? "incorrect flag"
              : flag
                ? "flagged"
                : mine
                  ? "mine"
                  : shown
                    ? count + " adjacent mines"
                    : "covered";
            const keys = bind(i);
            return (
              <button
                key={i}
                {...keys}
                aria-label={location(i) + ", " + name}
                className={[
                  "mine-cell",
                  shown || mine ? "open" : "",
                  flag ? "flagged" : "",
                  board.exploded === i || wrong ? "mistake" : "",
                ].join(" ")}
                data-clue={count}
                onClick={() =>
                  save(flagMode ? toggleFlag(board, i) : uncover(board, i))
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  save(toggleFlag(board, i));
                }}
                onKeyDown={(e) => {
                  if (e.key.toLowerCase() === "f") {
                    e.preventDefault();
                    if (!e.repeat) save(toggleFlag(board, i));
                  } else keys.onKeyDown(e);
                }}
              >
                {wrong ? (
                  <X />
                ) : flag ? (
                  <Flag />
                ) : mine ? (
                  <Bomb />
                ) : (
                  count || ""
                )}
              </button>
            );
          })}
        </div>
      </div>
      {!board.ended && (
        <p className="play-hint">
          {board.mines
            ? "Click a number with its flags in place to clear around it."
            : "Pick any square to start. Your first move is safe."}
        </p>
      )}
    </>
  );
}

function Ink({ path, color }) {
  const first = path[0],
    last = path[path.length - 1];
  const point = (i) => [(i % SIDE) + 0.5, Math.floor(i / SIDE) + 0.5];
  const [x1, y1] = point(first),
    [x2, y2] = point(last);
  return first === last ? (
    <circle cx={x1} cy={y1} r=".34" fill={color} />
  ) : (
    <line
      {...{ x1, y1, x2, y2 }}
      stroke={color}
      strokeWidth=".68"
      strokeLinecap="round"
    />
  );
}

export function WordSearch({ board, save }) {
  const [anchor, setAnchor] = useState(null),
    [end, setEnd] = useState(null);
  const [message, setMessage] = useState("");
  const gesture = useRef(null);
  const path = anchor === null ? [] : wordPath(anchor, end ?? anchor);
  function reset() {
    setAnchor(null);
    setEnd(null);
    gesture.current = null;
  }
  function finish(from, to) {
    const selected = wordPath(from, to),
      word = matchWord(board, selected);
    reset();
    if (!word) {
      setMessage("No match. Try another line.");
      return;
    }
    if (board.found[word]) {
      setMessage(word + " is already marked.");
      return;
    }
    const found = { ...board.found, [word]: selected };
    save({
      ...board,
      found,
      ended:
        Object.keys(found).length === board.words.length
          ? "All words found"
          : "",
    });
    setMessage(word + " found");
  }
  function choose(i) {
    if (board.ended) return;
    setMessage("");
    if (anchor === null) {
      setAnchor(i);
      setEnd(i);
    } else if (anchor === i) reset();
    else finish(anchor, i);
  }
  function cellAt(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) * SIDE) / rect.width);
    const y = Math.floor(((e.clientY - rect.top) * SIDE) / rect.height);
    return x >= 0 && x < SIDE && y >= 0 && y < SIDE ? y * SIDE + x : null;
  }
  const bind = useGridKeys((i) => {
    if (anchor !== null) setEnd(i);
  });
  const foundCount = Object.keys(board.found).length;
  return (
    <>
      <div className="puzzle-tools word-tools">
        <span>{board.theme || "In the wild"}</span>
        <span className="puzzle-count">
          {foundCount} of {board.words.length} found
        </span>
      </div>
      <div className="word-paper">
        <div
          className="puzzle-grid word-grid"
          role="group"
          aria-label="Word search grid"
          onPointerDown={(e) => {
            if (!e.isPrimary || e.button !== 0 || board.ended) return;
            const i = cellAt(e);
            if (i === null) return;
            e.preventDefault();
            e.currentTarget
              .querySelector('[data-cell="' + i + '"]')
              .focus({ preventScroll: true });
            gesture.current = {
              id: e.pointerId,
              from: anchor ?? i,
              anchored: anchor !== null,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
            setAnchor(anchor ?? i);
            setEnd(i);
            setMessage("");
          }}
          onPointerMove={(e) => {
            if (anchor === null || !e.isPrimary) return;
            const i = cellAt(e);
            if (i !== null) setEnd(i);
          }}
          onPointerUp={(e) => {
            const g = gesture.current;
            if (!g || g.id !== e.pointerId) return;
            gesture.current = null;
            const i = cellAt(e);
            if (i === null || (i === g.from && g.anchored)) reset();
            else if (i !== g.from) finish(g.from, i);
          }}
          onPointerCancel={reset}
          onLostPointerCapture={() => {
            if (gesture.current) reset();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              reset();
              setMessage("");
            }
          }}
        >
          <svg className="word-ink" viewBox="0 0 8 8" aria-hidden="true">
            {board.words.map(
              (w, i) =>
                board.found[w] && (
                  <Ink
                    key={w}
                    path={board.found[w]}
                    color={colors[i % colors.length]}
                  />
                ),
            )}
            {path.length > 0 && <Ink path={path} color="#c3b7d9" />}
          </svg>
          {CELLS.map((i) => (
            <button
              key={i}
              {...bind(i)}
              aria-label={location(i) + ", " + board.cells[i]}
              onClick={(e) => {
                if (e.detail === 0) choose(i);
              }}
            >
              {board.cells[i]}
            </button>
          ))}
        </div>
      </div>
      <ul className="word-bank" aria-label="Words to find">
        {board.words.map((w, i) => (
          <li
            key={w}
            className={board.found[w] ? "found" : ""}
            style={{ "--ink": colors[i % colors.length] }}
          >
            {board.found[w] && <Check size={12} />}
            <span>{w.toLowerCase()}</span>
            {board.found[w] && <span className="puzzle-sr"> found</span>}
          </li>
        ))}
      </ul>
      {!board.ended && (
        <p className="play-hint" role="status">
          {path.length > 1
            ? path.map((c) => board.cells[c]).join("")
            : anchor !== null
              ? "Choose the last letter. Esc cancels."
              : message || "Drag across a word, or click its two ends."}
        </p>
      )}
    </>
  );
}

function HowTo({ mines }) {
  return (
    <Popover.Root>
      <Popover.Trigger>
        <button
          className="puzzle-icon-button"
          aria-label="How to play"
          title="How to play"
        >
          <CircleHelp size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Content
        size="1"
        width="244px"
        align="end"
        className="puzzle-help"
      >
        <strong>How to play</strong>
        {mines ? (
          <>
            <p>
              Reveal every safe square. Each number counts the mines touching
              it, including diagonals.
            </p>
            <p>
              Right-click to flag, or switch to Flag. Click a number to open its
              neighbors when the flag count matches. A misplaced flag can expose
              a mine.
            </p>
          </>
        ) : (
          <p>
            Find each word in a straight line, including diagonals. Drag in
            either direction, or click the first and last letters.
          </p>
        )}
        <p>
          Use the arrow keys to move and Enter to select.{" "}
          {mines ? "F toggles a flag." : "Esc clears your selection."}
        </p>
      </Popover.Content>
    </Popover.Root>
  );
}

function Preview({ mines }) {
  return (
    <div
      className={"activity-sample " + (mines ? "sample-mines" : "sample-words")}
      aria-hidden="true"
    >
      {(mines
        ? ["", 1, "", "", 2, "", 1, "", "", 2, "", 1]
        : [..."FERNMOSSOWLS"]
      ).map((letter, i) => (
        <i
          key={i}
          className={
            mines
              ? letter
                ? "uncovered"
                : ""
              : i >= 4 && i <= 7
                ? "inked"
                : ""
          }
        >
          {mines && i === 2 ? <Flag size={13} /> : letter}
        </i>
      ))}
    </div>
  );
}

export function Activities({ report }) {
  const [boards, save] = useSaved("fokus-boards-v1", {});
  const [game, setGame] = useState(null),
    [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false),
    [round, setRound] = useState(0);
  const launchers = useRef({}),
    title = useRef(null);
  const board = boards[game],
    mines = game === MINES;
  useEffect(() => {
    if (game) title.current?.focus({ preventScroll: true });
  }, [game]);
  function back() {
    setGame(null);
    requestAnimationFrame(() =>
      launchers.current[game]?.focus({ preventScroll: true }),
    );
  }
  async function begin(name, fresh = false) {
    if (loading) return;
    if (!fresh && boards[name] && !boards[name].ended) {
      setGame(name);
      return;
    }
    setLoading(true);
    try {
      const next = await invoke("new_board", { game: name });
      save({ ...boards, [name]: next });
      setRound((r) => r + 1);
      setGame(name);
      setConfirm(false);
    } catch (e) {
      report(String(e));
    } finally {
      setLoading(false);
    }
  }
  if (!game)
    return (
      <section className="activities-home">
        <h1>Activities</h1>
        <div className="activity-choices">
          {[MINES, WORDS].map((name) => (
            <button
              key={name}
              disabled={loading}
              ref={(el) => {
                launchers.current[name] = el;
              }}
              onClick={() => begin(name)}
            >
              <Preview mines={name === MINES} />
              <strong>{name}</strong>
              <span>
                {boards[name] && !boards[name].ended ? "Resume board" : "Play"}{" "}
                <ArrowRight size={13} />
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  const started = mines
    ? board.revealed.length || board.flags.length
    : Object.keys(board.found).length;
  function change(next) {
    if (next !== board) save({ ...boards, [game]: next });
  }
  return (
    <section className="puzzle-stage">
      <div className="puzzle-column">
        <button
          className="puzzle-back"
          disabled={loading}
          onClick={back}
          aria-label="Back to activities"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <header className="puzzle-heading">
          <h1 ref={title} tabIndex={-1}>
            {game}
          </h1>
          <div>
            <HowTo mines={mines} />
            {!board.ended && (
              <button
                className="puzzle-icon-button"
                title="New board"
                aria-label="New board"
                disabled={loading}
                onClick={() => (started ? setConfirm(true) : begin(game, true))}
              >
                <RotateCcw size={15} />
              </button>
            )}
          </div>
        </header>
        {mines ? (
          <Mines key={round} board={board} save={change} />
        ) : (
          <WordSearch key={round} board={board} save={change} />
        )}
        {board.ended && (
          <div className="puzzle-result" role="status">
            <strong>{board.ended}</strong>
            <Button
              size="1"
              onClick={() => begin(game, true)}
              disabled={loading}
            >
              Play again <ArrowRight size={13} />
            </Button>
          </div>
        )}
        <Dialog.Root open={confirm} onOpenChange={setConfirm}>
          <Dialog.Content maxWidth="340px">
            <Dialog.Title>Start a new board?</Dialog.Title>
            <Dialog.Description>
              This will replace your current puzzle.
            </Dialog.Description>
            <div className="dialog-foot">
              <Dialog.Close>
                <Button variant="soft">Keep playing</Button>
              </Dialog.Close>
              <Button disabled={loading} onClick={() => begin(game, true)}>
                New board
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Root>
      </div>
    </section>
  );
}
