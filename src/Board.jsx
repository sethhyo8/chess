import React, { useState } from "react";
import { Chess } from "../shared/chess.js";
export const pieceName = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
export function Piece({ code }) {
  return (
    <img
      draggable={false}
      className="piece"
      alt={
        code[0] === "w"
          ? "White " + pieceName[code[1].toLowerCase()]
          : "Black " + pieceName[code[1].toLowerCase()]
      }
      src={"/pieces/neo/" + code + ".png"}
      decoding="async"
    />
  );
}
export default function Board({
  fen,
  flipped,
  onMove,
  disabled,
  last,
  moveBadge,
  arrow,
  editing,
  onEdit,
  uncertain = [],
}) {
  const [selected, setSelected] = useState(null),
    [promotion, setPromotion] = useState(null);
  let g;
  try {
    g = new Chess(fen);
  } catch {
    g = new Chess();
    g.clear();
    const rows = fen.split(" ")[0].split("/");
    rows.forEach((row, r) => {
      let c = 0;
      for (const p of row) {
        if (/\d/.test(p)) c += +p;
        else {
          g.put(
            { type: p.toLowerCase(), color: p === p.toUpperCase() ? "w" : "b" },
            String.fromCharCode(97 + c) + (8 - r),
          );
          c++;
        }
      }
    });
  }
  const legal =
    !editing && selected ? g.moves({ square: selected, verbose: true }) : [];
  const attempt = (from, to) => {
    setSelected(null);
    if (disabled || !from || from === to) return;
    const candidates = g
      .moves({ square: from, verbose: true })
      .filter((m) => m.to === to);
    if (candidates.some((m) => m.promotion))
      setPromotion({ from, to, color: g.turn() });
    else if (candidates.length) onMove?.({ from, to });
  };
  const select = (sq) => {
    if (editing) {
      onEdit?.(sq);
      return;
    }
    if (disabled) return;
    if (selected && legal.some((m) => m.to === sq)) attempt(selected, sq);
    else setSelected(g.get(sq)?.color === g.turn() ? sq : null);
  };
  const xy = (sq) => {
    const x = sq.charCodeAt(0) - 97,
      y = 8 - Number(sq[1]);
    return flipped ? [7 - x, 7 - y] : [x, y];
  };
  const squares = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const file = flipped ? 7 - c : c,
        rank = flipped ? r + 1 : 8 - r,
        sq = String.fromCharCode(97 + file) + rank,
        p = g.get(sq),
        check = p?.type === "k" && p.color === g.turn() && g.isCheck();
      squares.push(
        <button
          key={sq}
          data-square={sq}
          aria-label={sq + (p ? " " + p.color + " " + pieceName[p.type] : "")}
          className={
            "square " +
            ((r + c) % 2 ? "dark" : "light") +
            (last && (last.from === sq || last.to === sq) ? " last" : "") +
            (selected === sq ? " selected" : "") +
            (check ? " check" : "") +
            (uncertain.includes(sq) ? " uncertain" : "")
          }
          onClick={() => select(sq)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            attempt(e.dataTransfer.getData("text/plain"), sq);
          }}
        >
          <span className="coord rank">{c === 0 ? rank : ""}</span>
          <span className="coord file">
            {r === 7 ? String.fromCharCode(97 + file) : ""}
          </span>
          {p && (
            <span
              className="piece-wrap"
              draggable={!disabled && !editing && p.color === g.turn()}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", sq);
                setSelected(sq);
              }}
            >
              <Piece code={p.color + p.type.toUpperCase()} />
            </span>
          )}
          {legal.some((m) => m.to === sq) && (
            <span className={"legal-dot " + (p ? "capture" : "")} />
          )}
          {last?.to === sq && moveBadge && (
            <span className="board-move-quality">{moveBadge}</span>
          )}
        </button>,
      );
    }
  const a = arrow && xy(arrow.slice(0, 2)),
    b = arrow && xy(arrow.slice(2, 4));
  return (
    <div className="board-wrap">
      <div className="board" data-testid="board">
        {squares}
      </div>
      {a && b && (
        <svg className="arrow-layer" viewBox="0 0 800 800">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="3"
              markerHeight="3"
              refX="1.8"
              refY="1.5"
              orient="auto"
            >
              <path d="M0,0 L3,1.5 L0,3Z" fill="#e9a73bc9" />
            </marker>
          </defs>
          <line
            x1={a[0] * 100 + 50}
            y1={a[1] * 100 + 50}
            x2={b[0] * 100 + 50}
            y2={b[1] * 100 + 50}
            stroke="#e9a73bc9"
            strokeWidth="16"
            markerEnd="url(#arrowhead)"
          />
        </svg>
      )}
      {promotion && (
        <div className="promotion">
          <h3>Choose your promotion</h3>
          <div>
            {["q", "r", "b", "n"].map((p) => (
              <button
                key={p}
                aria-label={"Promote to " + pieceName[p]}
                onClick={() => {
                  onMove?.({ ...promotion, promotion: p });
                  setPromotion(null);
                }}
              >
                <Piece code={promotion.color + p.toUpperCase()} />
              </button>
            ))}
          </div>
          <button onClick={() => setPromotion(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
