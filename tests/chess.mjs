import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import puzzles from "../ui/lichess-puzzles.json" with { type: "json" };
import {
  acceptChessMove,
  boardRange,
  newChessBoard,
  playedPositions,
  ratingRanges,
} from "../ui/chess-rules.mjs";

test("each rating range deals its 150 unique puzzles before recycling", () => {
  let board;
  const all = new Set();
  for (const low of ratingRanges) {
    for (let i = 0; i < 150; i++) {
      board = newChessBoard(board, low);
      assert.equal(boardRange(board), low);
      assert.equal(all.has(board.id), false);
      all.add(board.id);
    }
  }
  assert.equal(all.size, puzzles.length);
  for (const low of ratingRanges) {
    const last = board.seen[low].at(-1);
    board = newChessBoard(board, low);
    assert.notEqual(board.id, last);
    assert.deepEqual(board.seen[low], [board.id]);
  }
});

test("every bundled line is legal and review ends at the saved board", () => {
  for (const puzzle of puzzles) {
    const game = new Chess(puzzle.fen);
    const line = puzzle.moves.split(" ");
    const setup = game.move(line[0]);
    let board = {
      id: puzzle.id,
      ply: 1,
      ended: "",
      fen: game.fen(),
      lastMove: [setup.from, setup.to],
    };
    assert.equal(playedPositions(board).length, 2);
    for (let ply = 1; ply < line.length; ply += 2) {
      const move = game.move(line[ply]);
      board = acceptChessMove(board, move);
      assert.ok(board, puzzle.id);
      if (ply + 1 < line.length) game.move(line[ply + 1]);
      assert.equal(board.fen, game.fen());
    }
    assert.equal(board.ended, "Puzzle solved");
    const frames = playedPositions(board);
    assert.equal(frames.length, line.length + 1);
    assert.equal(frames.at(-1).fen, board.fen);
    assert.equal(frames[0].fen, new Chess(puzzle.fen).fen());
  }
});

test("review reconstructs an alternative mate from a legacy save", () => {
  const puzzle = puzzles.find((p) => p.id === "02VaY");
  const game = new Chess(puzzle.fen);
  game.move(puzzle.moves.split(" ")[0]);
  const board = { id: puzzle.id, ply: 1, fen: game.fen() };
  const played = game.move("g6h6");
  const solved = acceptChessMove(board, played);
  assert.equal(solved.ended, "Puzzle solved");
  assert.equal(playedPositions(solved).at(-1).fen, game.fen());
});
