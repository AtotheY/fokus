import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Chess } from "chess.js";
import { Chessground } from "@lichess-org/chessground";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  acceptChessMove,
  boardRange,
  chessPuzzle,
  playedPositions,
  ratingRanges,
  rangeLabel,
} from "./chess-rules.mjs";
import "@lichess-org/chessground/assets/chessground.base.css";
import "@lichess-org/chessground/assets/chessground.brown.css";
import "@lichess-org/chessground/assets/chessground.cburnett.css";

const pieces = { q: "queen", r: "rook", b: "bishop", n: "knight" };
const pieceImage = (color, type) =>
  "chess/" + color + type.toUpperCase() + ".svg";
const colorName = (color) => (color === "w" ? "white" : "black");
export function ChessPreview() {
  return (
    <div className="activity-sample sample-chess" aria-hidden="true">
      {["", "bK", "", "", "bP", "", "wN", "", "", "", "", ""].map(
        (piece, i) => (
          <i
            key={i}
            className={(i + Math.floor(i / 4)) % 2 ? "dark-square" : ""}
          >
            {piece && <img src={"chess/" + piece + ".svg"} alt="" />}
          </i>
        ),
      )}
    </div>
  );
}

// Keep one Chessground instance for the round so it can animate between positions.
function BoardSurface({ frame, side, legal, onMove }) {
  const host = useRef(null);
  const api = useRef(null);
  const handler = useRef(onMove);
  useLayoutEffect(() => {
    handler.current = onMove;
  });
  useLayoutEffect(() => {
    const ground = Chessground(host.current, {
      orientation: colorName(side),
      premovable: { enabled: false },
      drawable: { enabled: false, visible: false },
      animation: {
        enabled: !matchMedia("(prefers-reduced-motion: reduce)").matches,
        duration: 220,
      },
      blockTouchScroll: true,
      movable: {
        free: false,
        rookCastle: false,
        events: {
          after: (from, to) => {
            if (api.current === ground) handler.current(from, to);
          },
        },
      },
      fen: frame.fen,
    });
    api.current = ground;
    return () => {
      api.current = null;
      ground.destroy();
    };
  }, [side]);
  useLayoutEffect(() => {
    const dests = new Map();
    for (const { from, to } of legal) {
      if (!dests.has(from)) dests.set(from, []);
      dests.get(from).push(to);
    }
    api.current.cancelMove();
    api.current.set({
      fen: frame.fen,
      lastMove: frame.lastMove,
      turnColor: colorName(new Chess(frame.fen).turn()),
      movable: { color: legal.length ? colorName(side) : undefined, dests },
    });
  }, [frame, side, legal]);
  return (
    <div
      className="chess-surface"
      ref={host}
      role="img"
      tabIndex={-1}
      onPointerDownCapture={(e) =>
        e.currentTarget.focus({ preventScroll: true })
      }
      aria-label={
        "Chessboard, " + frame.label + ", " + colorName(side) + " at bottom"
      }
    />
  );
}

export function ChessPuzzle({ board, save, onRange, shortcutScope }) {
  const frames = useMemo(() => playedPositions(board), [board]);
  const [cursor, setCursor] = useState(board.ply === 1 ? 0 : board.ply);
  const [autoAdvance, setAutoAdvance] = useState(board.ply === 1);
  const [promotion, setPromotion] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState("");
  const frame = frames[cursor];
  const live = cursor === board.ply;
  const canPlay = live && !board.ended && !promotion;
  // A rejected drag also needs a board sync, even if the position is unchanged.
  const legal = useMemo(
    () => (canPlay ? new Chess(frame.fen).moves({ verbose: true }) : []),
    [frame, canPlay, attempt],
  );
  const side = board.side === "w" ? "White" : "Black";

  function review(offset) {
    setAutoAdvance(false);
    setPromotion(null);
    setFeedback("");
    setTyped("");
    setCursor((i) => Math.max(0, Math.min(i + offset, board.ply)));
  }
  useEffect(() => {
    if (!autoAdvance) return;
    const timer = setTimeout(() => {
      setCursor(board.ply);
      setAutoAdvance(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [autoAdvance, board.ply]);
  useEffect(() => {
    function key(event) {
      if (shortcutScope && !shortcutScope.contains(event.target)) return;
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.target.closest?.(
          "select, input, textarea, [contenteditable=true]",
        ) ||
        document.querySelector(
          '[role="dialog"], [data-radix-popper-content-wrapper]',
        )
      )
        return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      review(event.key === "ArrowLeft" ? -1 : 1);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [board.ply, shortcutScope]);

  function play(move) {
    setPromotion(null);
    const next = acceptChessMove(board, move);
    if (!next) {
      setFeedback("Try another move.");
      setAttempt((n) => n + 1);
      return;
    }
    save(next);
    setFeedback("Correct. Find the next move.");
    setCursor(board.ply + 1);
    setAutoAdvance(next.ply > board.ply + 1);
  }
  function choose(from, to) {
    const moves = legal.filter((move) => move.from === from && move.to === to);
    if (moves.length > 1) setPromotion(moves);
    else if (moves.length) play(moves[0]);
  }
  function enterMove(event) {
    event.preventDefault();
    const text = typed.trim();
    const move = legal.find(
      (m) => m.lan === text.toLowerCase() || m.san === text,
    );
    if (move) play(move);
    else setFeedback("Enter a legal move, such as e2e4.");
    setTyped("");
  }
  return (
    <>
      <div className="puzzle-tools chess-tools">
        <span>Lichess · {chessPuzzle(board).rating}</span>
        <label>
          Rating range
          <select
            value={boardRange(board)}
            onChange={(e) => onRange(Number(e.target.value))}
          >
            {ratingRanges.map((low) => (
              <option key={low} value={low}>
                {rangeLabel(low)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <BoardSurface
        frame={frame}
        side={board.side}
        legal={legal}
        onMove={choose}
      />
      <div className="chess-underboard">
        <span className="chess-turn" role="status">
          {!live
            ? autoAdvance
              ? "Opponent’s move"
              : "Reviewing"
            : board.ended
              ? "Finished"
              : side + " to move"}
        </span>
        <div className="chess-history" role="group" aria-label="Move history">
          <button
            className="puzzle-icon-button"
            aria-label="Previous move"
            title="Previous move (←)"
            disabled={cursor === 0}
            onClick={() => review(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span aria-live="polite">{frame.label}</span>
          <button
            className="puzzle-icon-button"
            aria-label="Next move"
            title="Next move (→)"
            disabled={live}
            onClick={() => review(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      {promotion && (
        <div
          className="promotion-choices"
          role="group"
          aria-label="Choose promotion"
        >
          Promote to{" "}
          {promotion.map((move) => (
            <button
              key={move.promotion}
              aria-label={"Promote to " + pieces[move.promotion]}
              onClick={() => play(move)}
            >
              <img src={pieceImage(board.side, move.promotion)} alt="" />
            </button>
          ))}
        </div>
      )}
      {canPlay && (
        <form className="keyboard-chess" onSubmit={enterMove}>
          <input
            aria-label="Enter a chess move in notation"
            placeholder="Enter a move, e.g. e2e4"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button type="submit">Play</button>
        </form>
      )}
      {feedback && live && !board.ended && (
        <p className="play-hint" role="status">
          {feedback}
        </p>
      )}
    </>
  );
}
