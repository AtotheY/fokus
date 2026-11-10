import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ChessPuzzle} from '../../ui/chess.jsx';
import {newChessBoard, chessPuzzle} from '../../ui/chess-rules.mjs';
import '../../ui/puzzles.css';
import {catalog} from '../../ui/library.jsx';
import {ShelfTiles} from '../../ui/shelf-tiles.jsx';

function ChessBreak() {
  const key = 'fokus-preview-chess-1';
  const [board, setBoard] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key));
      if (chessPuzzle(saved)) return saved;
    } catch {}
    return newChessBoard(null, 0);
  });
  function save(next) {
    setBoard(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
  }
  return <>
    <ChessPuzzle key={board.id} board={board} shortcutScope={document.getElementById('game-chess')} onRange={range=>save(newChessBoard(board, range))} save={next => {save(next); window.fokusEvent?.('demo');}}/>
    {board.ended && <div className="preview-end"><span role="status">{board.ended}</span>
      <button className="preview-reset" onClick={()=>save(newChessBoard(board))}>Next puzzle</button>
    </div>}
  </>;
}

function DailyPreview() {
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

const chess = document.getElementById('game-chess');
chess.classList.add('playable');
createRoot(chess).render(<ChessBreak/>);
createRoot(document.getElementById('daily-preview')).render(<DailyPreview/>);
