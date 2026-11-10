import React, {useState} from 'react';
import {Mines} from '../../ui/activities.jsx';
import {uncover} from '../../ui/puzzle-rules.mjs';
import {ChessPuzzle} from '../../ui/chess.jsx';
import {newChessBoard, chessPuzzle} from '../../ui/chess-rules.mjs';
import '../../ui/puzzles.css';
import {catalog} from '../../ui/daily-games.mjs';
import {ShelfTiles} from '../../ui/shelf-tiles.jsx';

export function ChessBreak({startingBoard, shortcutScope}) {
  const key = 'fokus-preview-chess-1';
  const [board, setBoard] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key));
      if (chessPuzzle(saved)) return saved;
    } catch {}
    return startingBoard;
  });
  function save(next) {
    setBoard(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
  }
  return <>
    <ChessPuzzle
      key={board.id}
      board={board}
      shortcutScope={shortcutScope}
      onRange={range => save(newChessBoard(board, range))}
      save={next => {
        save(next);
        window.fokusEvent?.('demo');
      }}
    />
    {board.ended && (
      <div className="chess-result">
        <strong role="status">{board.ended}</strong>
        <button onClick={() => save(newChessBoard(board))}>Next puzzle</button>
      </div>
    )}
  </>;
}

function halfwayMinefield() {
  const start = {mines: [9, 12, 23, 28, 40, 45, 55, 58], flags: [9, 23], revealed: [], ended: ''};
  return [0, 4, 7, 24].reduce(uncover, start);
}

export function MinesBreak() {
  const [board, setBoard] = useState(halfwayMinefield);
  function save(next) {
    if (next === board) return;
    setBoard(next);
    window.fokusEvent?.('demo');
  }
  return <>
    <Mines board={board} save={save}/>
    {board.ended && <div className="mine-result">
      <strong role="status">{board.ended}</strong>
      <button onClick={() => setBoard(halfwayMinefield())}>Try again</button>
    </div>}
  </>;
}

export function DailyPreview() {
  const [done, setDone] = useState([]);
  const games = [catalog[2], catalog[1], catalog[3], catalog[0]];
  function toggle(game) {
    setDone(current=>current.includes(game.url) ? current.filter(url=>url !== game.url) : [...current,game.url]);
    window.fokusEvent?.('demo');
  }
  return <>
    <div className="daily-preview-head"><strong>Daily shelf</strong><span role="status">{done.length} of {games.length} complete</span></div>
    <ShelfTiles games={games} done={done} toggle={toggle}/>
  </>;
}
