import React from "react";
import { ArrowDown, ArrowUp, Check, Circle, Trash2 } from "lucide-react";
import { catalog } from "./daily-games.mjs";
import "./shelf-tiles.css";

function GameCover({ game }) {
  const entry = catalog.find(item => item.url === game.url);
  const initials = game.name.trim().split(/\s+/u).slice(0, 2)
    .map(word => Array.from(word)[0]).join("").toLocaleUpperCase();
  return (
    <span className="shelf-cover" style={{ backgroundColor: entry?.paper }} aria-hidden="true">
      {entry ? (
        <img className="game-mark" src={`/daily-games/${entry.artwork}.png`} width="96" height="96" alt="" />
      ) : (
        <span className="game-initials">{initials}</span>
      )}
    </span>
  );
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
