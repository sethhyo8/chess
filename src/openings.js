import { Chess, DEFAULT_POSITION } from "../shared/chess.js";

let entries = [],
  request;
let lookup = () => undefined;
const positionKey = (fen) => fen.split(" ").slice(0, 4).join(" ");
export function loadOpeningDatabase() {
  if (!request)
    request = fetch("/data/openings.json")
      .then((response) => {
        if (!response.ok)
          throw new Error("The opening database could not be loaded.");
        return response.json();
      })
      .then((data) => {
        entries = data;
        lookup = createOpeningLookup(data);
        return entries;
      })
      .catch((error) => {
        request = undefined;
        throw error;
      });
  return request;
}

export function findOpening(moves, start = DEFAULT_POSITION) {
  return lookup(moves, start);
}

export function createOpeningLookup(data) {
  const positions = new Map(
    data.map((entry) => [positionKey(entry.fen), entry]),
  );
  const matches = new Map();
  return (moves, start = DEFAULT_POSITION) => {
    const key = start + ":" + moves.join(" ");
    if (matches.has(key)) return matches.get(key);
    let match;
    try {
      const chess = new Chess(start);
      match = positions.get(positionKey(chess.fen()));
      for (const move of moves) {
        chess.move(move);
        match = positions.get(positionKey(chess.fen())) || match;
      }
    } catch {
      /* Unknown or incomplete custom positions have no opening name. */
    }
    if (matches.size > 512) matches.clear();
    matches.set(key, match);
    return match;
  };
}
