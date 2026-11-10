import React from 'react';
import {createRoot} from 'react-dom/client';
import {ChessBreak, DailyPreview} from './puzzle-preview.jsx';
import {chessPuzzle, startChessBoard} from '../../ui/chess-rules.mjs';

const chess = document.getElementById('game-chess');
const opening = chessPuzzle({id: chess.dataset.start});
createRoot(chess).render(<ChessBreak startingBoard={startChessBoard(opening)} shortcutScope={chess}/>);
createRoot(document.getElementById('daily-preview')).render(<DailyPreview/>);
