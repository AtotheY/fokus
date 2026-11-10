import React from 'react';
import {createRoot} from 'react-dom/client';
import {ChessBreak, DailyPreview, MinesBreak} from './puzzle-preview.jsx';
import {chessPuzzle, startChessBoard} from '../../ui/chess-rules.mjs';

const chess = document.getElementById('game-chess');
// A stationary tap produces a native mouse event for Chessground. Leave a
// vertical swipe to the page, even when it starts on a movable piece.
chess.addEventListener('touchstart', event => {
  if (event.target.closest('cg-board')) event.stopPropagation();
}, {capture: true, passive: true});
const opening = chessPuzzle({id: chess.dataset.start});
createRoot(chess).render(<ChessBreak startingBoard={startChessBoard(opening)} shortcutScope={chess}/>);
createRoot(document.getElementById('daily-preview')).render(<DailyPreview/>);
createRoot(document.getElementById('game-mines')).render(<MinesBreak/>);
