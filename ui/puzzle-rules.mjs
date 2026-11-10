export const SIDE = 8;
export const CELLS = Array.from({ length: SIDE * SIDE }, (_, i) => i);
export const MINE_COUNT = 8;
const x = (cell) => cell % SIDE;
const y = (cell) => Math.floor(cell / SIDE);
export const neighbors = CELLS.map((i) =>
  CELLS.filter(
    (j) => i !== j && Math.abs(x(i) - x(j)) <= 1 && Math.abs(y(i) - y(j)) <= 1,
  ),
);
export const clue = (mines, cell) =>
  neighbors[cell].filter((n) => mines.includes(n)).length;

export function toggleFlag(board, cell) {
  if (board.ended || board.revealed.includes(cell)) return board;
  const flags = board.flags.includes(cell)
    ? board.flags.filter((f) => f !== cell)
    : [...board.flags, cell];
  return { ...board, flags };
}

export function uncover(board, cell) {
  if (board.ended || board.flags.includes(cell)) return board;
  const mines =
    board.mines ??
    board.order
      .filter((n) => n !== cell && !neighbors[cell].includes(n))
      .slice(0, MINE_COUNT);
  const shown = new Set(board.revealed);
  let queue = [cell];
  if (shown.has(cell)) {
    const around = neighbors[cell];
    if (
      around.filter((n) => board.flags.includes(n)).length !== clue(mines, cell)
    )
      return board;
    queue = around.filter((n) => !shown.has(n) && !board.flags.includes(n));
    if (!queue.length) return board;
  }
  while (queue.length) {
    const n = queue.pop();
    if (shown.has(n) || board.flags.includes(n)) continue;
    if (mines.includes(n))
      return {
        ...board,
        mines,
        revealed: [...shown],
        exploded: n,
        ended: "Mine found",
      };
    shown.add(n);
    if (clue(mines, n) === 0) queue.push(...neighbors[n]);
  }
  return {
    ...board,
    mines,
    revealed: [...shown],
    ended: shown.size === CELLS.length - mines.length ? "Board cleared" : "",
  };
}

// Project onto the nearest of the eight puzzle directions so a slightly crooked drag still works.
export function wordPath(start, end) {
  if (start === end) return [start];
  const dx = x(end) - x(start),
    dy = y(end) - y(start);
  const angle = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
  const sx = Math.round(Math.cos(angle)),
    sy = Math.round(Math.sin(angle));
  const steps = Math.round((dx * sx + dy * sy) / (sx * sx + sy * sy));
  const path = [start];
  for (let i = 1; i <= steps; i++) {
    const col = x(start) + sx * i,
      row = y(start) + sy * i;
    if (col < 0 || row < 0 || col >= SIDE || row >= SIDE) break;
    path.push(row * SIDE + col);
  }
  return path;
}

export function matchWord(board, path) {
  const letters = path.map((cell) => board.cells[cell]).join("");
  const backwards = [...letters].reverse().join("");
  return board.words.find((word) => word === letters || word === backwards);
}

export function arrowCell(cell, key) {
  const col = x(cell),
    row = y(cell);
  switch (key) {
    case "ArrowLeft":
      return row * SIDE + Math.max(0, col - 1);
    case "ArrowRight":
      return row * SIDE + Math.min(SIDE - 1, col + 1);
    case "ArrowUp":
      return Math.max(0, row - 1) * SIDE + col;
    case "ArrowDown":
      return Math.min(SIDE - 1, row + 1) * SIDE + col;
    default:
      return null;
  }
}
