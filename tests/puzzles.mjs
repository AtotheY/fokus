import assert from "node:assert/strict";
import test from "node:test";
import {
  CELLS,
  neighbors,
  uncover,
  toggleFlag,
  wordPath,
  matchWord,
} from "../ui/puzzle-rules.mjs";

const fresh = { order: CELLS, mines: null, flags: [], revealed: [], ended: "" };
test("every first reveal opens a safe area", () => {
  for (const cell of CELLS) {
    const next = uncover(fresh, cell);
    assert.equal(next.mines.length, 8);
    assert(!next.mines.includes(cell));
    assert(neighbors[cell].every((n) => next.revealed.includes(n)));
  }
});
test("chording requires the matching count and respects misplaced flags", () => {
  const board = {
    ...fresh,
    revealed: [9],
    mines: [0, 5, 7, 39, 45, 55, 60, 63],
  };
  assert.equal(uncover(board, 9), board);
  const marked = toggleFlag(board, 0);
  assert.equal(uncover(marked, 0), marked);
  const cleared = uncover(marked, 9);
  assert(neighbors[9].every((i) => i === 0 || cleared.revealed.includes(i)));
  const lost = uncover(toggleFlag(board, 8), 9);
  assert.equal(lost.exploded, 0);
  assert.equal(lost.ended, "Mine found");
  assert.equal(toggleFlag(lost, 1), lost);
});
test("revealing the final safe tile wins even without flags", () => {
  const mines = [0, 1, 2, 3, 4, 5, 6, 7];
  const next = uncover({ ...fresh, mines, revealed: CELLS.slice(8, -1) }, 63);
  assert.equal(next.ended, "Board cleared");
});
test("word selection works in eight directions and snaps a crooked drag", () => {
  for (const step of [-9, -8, -7, -1, 1, 7, 8, 9]) {
    const path = [27, 27 + step, 27 + step * 2];
    const cells = Array(64).fill("X");
    path.forEach((cell, i) => (cells[cell] = "INK"[i]));
    assert.deepEqual(wordPath(path[0], path[2]), path);
    assert.equal(
      matchWord({ cells, words: ["INK"] }, path.toReversed()),
      "INK",
    );
  }
  assert.deepEqual(wordPath(0, 13), [0, 1, 2, 3, 4, 5]);
});
