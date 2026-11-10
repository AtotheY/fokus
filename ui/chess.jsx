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
  moveFrame,
  solutionPositions,
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
    const position = new Chess(frame.fen);
    const turnColor = colorName(position.turn());
    api.current.cancelMove();
    api.current.set({
      fen: frame.fen,
      lastMove: frame.lastMove,
      turnColor,
      check: position.isCheck(),
      movable: { color: legal.length ? turnColor : undefined, dests },
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
  const puzzleFrames = useMemo(() => playedPositions(board), [board]);
  const [cursor, setCursor] = useState(board.ply === 1 ? 0 : board.ply);
  const [autoAdvance, setAutoAdvance] = useState(board.ply === 1);
  const [promotion, setPromotion] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [variation, setVariation] = useState(null);
  const [miss, setMiss] = useState(null);
  const [showMiss, setShowMiss] = useState(false);
  const [typed, setTyped] = useState("");
  const frames = variation ?? puzzleFrames;
  const frame = showMiss ? miss : frames[cursor];
  const lastPly = frames.length - 1;
  const live = !variation && cursor === board.ply;
  const solving = live && !board.ended;
  const position = useMemo(() => new Chess(frame.fen), [frame]);
  const canPlay = !autoAdvance && !showMiss && !promotion;
  const legal = useMemo(
    () => (canPlay ? position.moves({ verbose: true }) : []),
    [position, canPlay],
  );
  const side = position.turn() === "w" ? "White" : "Black";
  const status = showMiss
    ? "Try again"
    : autoAdvance
      ? "Opponent’s move"
      : variation
        ? position.isCheckmate()
          ? "Checkmate"
          : position.isStalemate()
            ? "Stalemate"
            : side + " to move"
        : !live
          ? "Reviewing"
          : board.ended
            ? "Finished"
            : side + " to move";

  function navigate(line, ply) {
    setAutoAdvance(false);
    setShowMiss(false);
    setPromotion(null);
    setFeedback("");
    setTyped("");
    setVariation(line);
    setCursor(ply);
  }
  function review(offset) {
    const next = cursor + offset + (showMiss ? 1 : 0);
    navigate(variation, Math.max(0, Math.min(next, lastPly)));
  }
  function explore() {
    const line = frames.slice(0, cursor + 1);
    if (live && miss) line.push(miss);
    navigate(line, line.length - 1);
  }
  useEffect(() => {
    if (!showMiss) return;
    const timer = setTimeout(() => setShowMiss(false), 300);
    return () => clearTimeout(timer);
  }, [showMiss, miss]);
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
  }, [cursor, lastPly, variation, showMiss, shortcutScope]);

  function play(move) {
    setPromotion(null);
    if (!solving) {
      const line = [...frames.slice(0, cursor + 1), moveFrame(move)];
      navigate(line, line.length - 1);
      return;
    }
    const next = acceptChessMove(board, move);
    if (!next) {
      setMiss(moveFrame(move));
      setShowMiss(true);
      setFeedback(move.san + " misses the tactic. Try again.");
      return;
    }
    setMiss(null);
    save(next);
    setFeedback(next.ended ? "" : "Correct. Find the next move.");
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
          {status}
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
            disabled={cursor >= lastPly}
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
              <img src={pieceImage(move.color, move.promotion)} alt="" />
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
      {feedback && (
        <p className="play-hint" role="status">
          {feedback}
        </p>
      )}
      <div className="chess-study-actions">
        {variation ? (
          <button
            className="text-action"
            onClick={() => navigate(null, board.ply)}
          >
            Return to puzzle
          </button>
        ) : (
          <>
            <button
              className="text-action"
              disabled={autoAdvance}
              onClick={explore}
            >
              {miss && live ? "Explore this move" : "Explore position"}
            </button>
            {miss && live && (
              <button
                className="text-action"
                onClick={() =>
                  navigate(solutionPositions(board), board.ply + 1)
                }
              >
                View solution
              </button>
            )}
            </>
        )}
      </div>
    </>
  );
}
