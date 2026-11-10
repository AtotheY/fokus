import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Chess} from 'chess.js';
import {chessPuzzle, startChessBoard} from '../../ui/chess-rules.mjs';
import {ChessBreak, DailyPreview, MinesBreak} from './puzzle-preview.jsx';

const puzzle = chessPuzzle({id: '02HAo'});
const startingBoard = startChessBoard(puzzle);
const squares = new Chess(puzzle.fen).board().flat();
if (startingBoard.side === 'b') squares.reverse();

export const previews = {
  startingId: puzzle.id,
  mines: renderToStaticMarkup(<MinesBreak/>),
  daily: renderToStaticMarkup(<DailyPreview/>),
  chess: renderToStaticMarkup(<>
    <ChessBreak startingBoard={startingBoard}/>
    <div className="opening-position" aria-hidden="true">
      {squares.map((piece, index) => <span key={index}>
        {piece && <img width="64" height="64" alt="" src={'/chess/' + piece.color + piece.type.toUpperCase() + '.svg'}/>}
      </span>)}
    </div>
  </>)
};
