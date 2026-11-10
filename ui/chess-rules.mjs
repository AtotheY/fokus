import { Chess } from "chess.js";
import puzzles from "./lichess-puzzles.json" with { type: "json" };

export const ratingRanges = [
  0, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600,
];
const byId = new Map(puzzles.map((p) => [p.id, p]));
const byRange = new Map(ratingRanges.map((low) => [low, []]));
function band(rating) {
  return rating < 800 ? 0 : Math.min(2600, Math.floor(rating / 200) * 200);
}
for (const puzzle of puzzles) byRange.get(band(puzzle.rating)).push(puzzle);

export function rangeLabel(low) {
  if (!low) return "Under 800";
  return low === 2600 ? "2600+" : low + "–" + (low + 199);
}

export function chessPuzzle(board) {
  return byId.get(board?.id);
}

export function newChessBoard(
  previous,
  low = band(chessPuzzle(previous)?.rating ?? 1000),
) {
  const pool = byRange.get(low);
  const seen = { ...previous?.seen };
  const previousPuzzle = chessPuzzle(previous);
  if (previousPuzzle && !seen[band(previousPuzzle.rating)]) {
    seen[band(previousPuzzle.rating)] = [previousPuzzle.id];
  }
  let used = new Set(seen[low]);
  let available = pool.filter((p) => !used.has(p.id));
  if (!available.length) {
    const last = seen[low].at(-1);
    used = new Set();
    available = pool.filter((p) => p.id !== last);
  }
  const puzzle = available[Math.floor(Math.random() * available.length)];
  seen[low] = [...used, puzzle.id];
  const position = new Chess(puzzle.fen);
  const first = position.move(puzzle.moves.split(" ")[0]);
  return {
    id: puzzle.id,
    seen,
    side: position.turn(),
    ply: 1,
    fen: position.fen(),
    lastMove: [first.from, first.to],
    ended: "",
  };
}

export function boardRange(board) {
  return band(chessPuzzle(board).rating);
}

export function moveFrame(move) {
  const number = move.before.split(" ")[5];
  return {
    fen: move.after,
    lastMove: [move.from, move.to],
    label: number + (move.color === "w" ? ". " : "… ") + move.san,
  };
}

export function solutionPositions(board) {
  const puzzle = chessPuzzle(board);
  const game = new Chess(puzzle.fen);
  return [
    { fen: game.fen(), label: "Starting position" },
    ...puzzle.moves.split(" ").map((uci) => moveFrame(game.move(uci))),
  ];
}

// Rebuild only the moves the player has reached, including the opponent's setup move.
export function playedPositions(board) {
  const puzzle = chessPuzzle(board);
  const game = new Chess(puzzle.fen);
  const frames = [{ fen: game.fen(), label: "Starting position" }];
  const line = puzzle.moves.split(" ").slice(0, board.ply);
  for (const [i, expected] of line.entries()) {
    let uci = expected;
    if (board.ended && i === line.length - 1) {
      // Older saves can contain an alternative mating move, including underpromotion.
      const [from, to] = board.lastMove;
      const promotes = game.get(from)?.type === "p" && /[18]$/.test(to);
      uci = from + to + (promotes ? new Chess(board.fen).get(to).type : "");
    }
    frames.push(moveFrame(game.move(uci)));
  }
  return frames;
}

export function acceptChessMove(board, move) {
  const line = chessPuzzle(board).moves.split(" ");
  const position = new Chess(board.fen);
  position.move(move);
  const mate = position.isCheckmate();
  if (!mate && move.lan !== line[board.ply]) return null;
  let last = move;
  let ply = board.ply + 1;
  if (!mate && ply < line.length) last = position.move(line[ply++]);
  return {
    ...board,
    fen: position.fen(),
    ply,
    lastMove: [last.from, last.to],
    ended: mate || ply === line.length ? "Puzzle solved" : "",
  };
}
