# Opening database

Source: https://github.com/lichess-org/chess-openings
Downloaded: 2026-10-27. Licence: CC0 1.0; dedication in opening-source/COPYING.txt.

openings.json contains all 3,865 source opening lines, ECO codes, canonical SAN moves and final FENs. Some opening names have multiple move orders. Every PGN is replayed using chess.js by scripts/build-openings.js before this file is generated. Opening recognition matches board positions and retains the latest named position, including transpositions; it does not invent game frequencies or win rates.

The original five source TSV volumes are in opening-source/. Rebuild with node scripts/build-openings.js.
