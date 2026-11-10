import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Mines, WordSearch } from '../../ui/activities.jsx';

// The same Rainy afternoon board pictured in the static Mac preview.
const words = {
  theme: 'Rainy afternoon',
  cells: [...'XBLVMSWJTOPAETVJYESKAFCHMZMXPOFTXJKICWQOXYROGUMAODARAINSWYGKVYQT'],
  words: ['DRIP', 'COCOA', 'TOAST', 'RAIN', 'MUG', 'TEAPOT'],
  found: { DRIP: [49,42,35,28], COCOA: [22,29,36,43,50] },
  ended: ''
};
const mines = {
  order: [51, 10, 3, 53, 40, 52, 19, 46, 8, 47, 11, 12, 16, 21, 41, 0, 4, 15, 44, 6, 58, 25, 24, 18, 54, 23, 17, 13, 50, 55, 7, 48, 63, 30, 43, 1, 9, 5, 20, 60, 36, 27, 29, 14, 2, 37, 26, 59, 62, 49, 31, 34, 42, 22, 39, 56, 45, 33, 35, 38, 61, 28, 32, 57],
  mines: null, flags: [], revealed: [], ended: ''
};

function PuzzlePreview({ initial, name, Game }) {
  const key = 'fokus-preview-v1-' + name;
  const [board, setBoard] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(key)) ?? initial; }
    catch { return initial; }
  });
  const [round, setRound] = useState(0);
  function save(next) {
    setBoard(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
  }
  return <>
    <Game key={round} board={board} save={next => { save(next); window.fokusEvent?.('demo'); }} />
    <div className="preview-end">
      <span role="status">{board.ended}</span>
      <button className="preview-reset" onClick={() => { save(initial); setRound(round + 1); }}>Reset example</button>
    </div>
  </>;
}

for (const [name, initial, Game] of [['words', words, WordSearch], ['mines', mines, Mines]]) {
  const panel = document.getElementById('game-' + name);
  panel.classList.add('playable');
  createRoot(panel).render(<PuzzlePreview {...{ name, initial, Game }} />);
}
