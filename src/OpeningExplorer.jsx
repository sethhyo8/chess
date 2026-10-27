import React, { useMemo, useState } from "react";
import { Search, ChevronRight, ArrowRight, BookOpen } from "lucide-react";
import Board from "./Board.jsx";
import { Chess, DEFAULT_POSITION } from "../shared/chess.js";

export default function OpeningExplorer({ entries, error, onRetry, onOpen }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [selected, setSelected] = useState(null);
  const [ply, setPly] = useState(0);
  const results = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return (entries || []).filter(
      (entry) =>
        (!family || entry.eco.startsWith(family)) &&
        words.every((word) =>
          `${entry.eco} ${entry.name} ${entry.pgn}`
            .toLowerCase()
            .includes(word),
        ),
    );
  }, [entries, query, family]);
  const current =
    selected ||
    results.find((entry) => entry.name === "Italian Game") ||
    results[0];
  const moves = current?.moves || [];
  const preview = useMemo(() => {
    const chess = new Chess();
    const fens = [chess.fen()];
    for (const move of moves) {
      chess.move(move);
      fens.push(chess.fen());
    }
    return fens;
  }, [moves]);
  function choose(entry) {
    setSelected(entry);
    setPly(entry.moves.length);
  }
  return (
    <div className="selection-page openings-page">
      <h1>Opening database</h1>
      <p className="muted">
        Explore {entries ? entries.length.toLocaleString() : ""} opening lines.
        Choose a line to study it on the board.
      </p>
      <div className="opening-filters">
        <label className="opening-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search openings"
            placeholder="Search a name, ECO code, or moves"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="ECO family"
          value={family}
          onChange={(event) => setFamily(event.target.value)}
        >
          <option value="">All openings</option>
          <option value="A">A · Flank openings</option>
          <option value="B">B · Semi-open games</option>
          <option value="C">C · Open games & French</option>
          <option value="D">D · Closed games</option>
          <option value="E">E · Indian defences</option>
        </select>
      </div>
      {!entries ? (
        <div className="empty-state" role="status">
          {error || "Loading opening database…"}
          {error && (
            <button className="primary" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      ) : (
        <div className="opening-explorer">
          <div className="opening-results">
            <div className="opening-result-count" role="status">
              {results.length.toLocaleString()} openings
              {results.length > 100
                ? " · Showing the first 100; search to narrow results"
                : ""}
            </div>
            <div className="opening-list">
              {results.slice(0, 100).map((entry) => (
                <button
                  key={`${entry.eco}:${entry.name}:${entry.pgn}`}
                  className={current === entry ? "selected-opening" : ""}
                  aria-pressed={current === entry}
                  onClick={() => choose(entry)}
                >
                  <span className="eco-code">{entry.eco}</span>
                  <span>
                    <strong>{entry.name}</strong>
                    <small>{entry.pgn}</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {!results.length && (
                <p className="opening-no-results">
                  No openings found. Try a name such as “Sicilian” or an ECO
                  code such as “B90”.
                </p>
              )}
            </div>
          </div>
          <section className="opening-preview" aria-label="Opening preview">
            {current && (
              <>
                <div className="opening-preview-heading">
                  <span className="eco-code">{current.eco}</span>
                  <h2>{current.name}</h2>
                </div>
                <Board
                  fen={preview[Math.min(ply, moves.length)] || DEFAULT_POSITION}
                  disabled
                />
                <div className="opening-moves" aria-label="Opening moves">
                  <button aria-pressed={ply === 0} onClick={() => setPly(0)}>
                    Start
                  </button>
                  {moves.map((move, index) => (
                    <button
                      key={index}
                      aria-pressed={ply === index + 1}
                      onClick={() => setPly(index + 1)}
                    >
                      {index % 2 === 0 ? `${index / 2 + 1}. ` : ""}
                      {move}
                    </button>
                  ))}
                </div>
                <button
                  className="primary full"
                  onClick={() => onOpen(current)}
                >
                  Analyse opening <ArrowRight size={18} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
      <p className="opening-source">
        <BookOpen size={15} /> Opening names from{" "}
        <a
          href="https://github.com/lichess-org/chess-openings"
          target="_blank"
          rel="noreferrer"
        >
          Lichess’s CC0 database
        </a>
        . These are named lines, not game statistics.
      </p>
    </div>
  );
}
