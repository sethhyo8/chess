import { readFile, writeFile } from "node:fs/promises";
import { Chess } from "chess.js";

// Source TSVs and CC0 dedication are retained alongside the generated database.
const entries = [];
for (const volume of "abcde") {
  const source = await readFile(
    `public/data/opening-source/${volume}.tsv`,
    "utf8",
  );
  for (const row of source.trim().split(/\r?\n/).slice(1)) {
    const [eco, name, pgn] = row.split("\t");
    const chess = new Chess();
    chess.loadPgn(pgn);
    entries.push({ eco, name, pgn, moves: chess.history(), fen: chess.fen() });
  }
}
await writeFile("public/data/openings.json", JSON.stringify(entries));
console.log(`Validated and built ${entries.length} opening lines.`);
