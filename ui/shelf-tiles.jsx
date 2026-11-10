import React from "react";
import { ArrowDown, ArrowUp, Check, Circle, Clock3, Crosshair, Dices, Flag, Globe2, Grid3X3, Layers, Moon, Pencil, Ruler, Spline, Trash2, Waves, Waypoints } from "lucide-react";
import "./shelf-tiles.css";

const covers = {
  "Timed trivia": [Waves, "#b4dacf", "#215c60"],
  "Daily clue": [Pencil, "#efc3a5", "#65402c"],
  "Number puzzle": [Grid3X3, "#f0d58c", "#695024"],
  "Visual estimation": [Ruler, "#b8d4e7", "#36566b"],
  "Word ladder": [Waypoints, "#e2bbd4", "#634156"],
  "Geography": [Globe2, "#acccb5", "#294c47"],
  "Word puzzle": [Crosshair, "#dfc1a5", "#684730"],
  "Word groups": [Layers, "#c3b9e0", "#50466b"],
  "Trivia": [Moon, "#bfc6e8", "#373e68"],
  "Custom game": [Dices, "#cfc8df", "#524760"],
};
const special = {
  "https://feetle.fun/": Flag,
  "https://drawtheborder.com/": Spline,
  "https://krillion.io/": Clock3
};
export function GameCover({ game }) {
  const [Glyph, paper, ink] = covers[game.type] ?? covers["Custom game"];
  const Detail = special[game.url];
  const wordle = game.url === "https://www.nytimes.com/games/wordle/index.html";
  const groups = game.url === "https://www.nytimes.com/games/connections";
  return <span className={'shelf-cover' + (wordle ? ' cover-wordle' : groups ? ' cover-groups' : '')} style={{'--paper':paper,'--pigment':ink}} aria-hidden="true">
    {wordle || groups ? <span className="tile-pattern">{Array.from({length:wordle ? 9 : 16}, (_, i)=><i key={i}/>)}</span>
      : <span className="cover-seal"><Glyph size={31} strokeWidth={1.65}/>{Detail && <Detail className="cover-detail" size={15}/>}</span>}
  </span>;
}

export function ShelfTiles({games, done, toggle, open, editing = false, reorder, remove}) {
  return <div className="shelf-tiles">{games.map((game, i)=>{
    const finished = done.includes(game.url);
    const face = <><GameCover game={game}/><span className="tile-name">{game.name}</span></>;
    return <div className="shelf-tile" key={game.url}>
      {open ? <button className="tile-play" aria-label={'Play ' + game.name} onClick={()=>open(game)}>{face}</button>
        : <a className="tile-play" aria-label={'Play ' + game.name} href={game.url} target="_blank" rel="noreferrer">{face}</a>}
      {editing ? <div className="tile-edit">
        <button disabled={!i} aria-label={'Move '+game.name+' up'} onClick={()=>reorder(i,-1)}><ArrowUp size={15}/></button>
        <button disabled={i===games.length-1} aria-label={'Move '+game.name+' down'} onClick={()=>reorder(i,1)}><ArrowDown size={15}/></button>
        <button aria-label={'Remove '+game.name} onClick={()=>remove(game)}><Trash2 size={15}/></button>
      </div> : <button className="tile-done" aria-pressed={finished}
        aria-label={(finished ? 'Undo completion of ' : 'Mark done ') + game.name}
        title={finished ? 'Undo completion' : 'Mark done'} onClick={()=>toggle(game)}>
        {finished ? <Check size={15}/> : <Circle size={15}/>}
      </button>}
    </div>;
  })}</div>;
}
