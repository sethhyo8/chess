import { findOpening } from "./openings.js";
export const samplePgn = `[Event "An evening at the grove"]
[White "You"]
[Black "Milo"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Bxc3 9. d5 Bf6 10. Re1 Ne7 *`;
export const bots = [
  {
    id: "milo",
    name: "Milo",
    elo: 350,
    group: "Beginner",
    color: "#b4c88d",
    kind: "bear",
    desc: "A curious beginner. Plenty of room to find your feet.",
  },
  {
    id: "pip",
    name: "Pip",
    elo: 600,
    group: "Beginner",
    color: "#d6b484",
    kind: "fox",
    desc: "Learning the ropes, one pawn at a time.",
  },
  {
    id: "fern",
    name: "Fern",
    elo: 850,
    group: "Novice",
    color: "#a1bba9",
    kind: "owl",
    desc: "Developing a plan. Keep an eye on your pieces.",
  },
  {
    id: "jasper",
    name: "Jasper",
    elo: 1200,
    group: "Intermediate",
    color: "#9eacc7",
    kind: "bear",
    desc: "A thoughtful rival with a few tricks up his sleeve.",
  },
  {
    id: "sage",
    name: "Sage",
    elo: 1600,
    group: "Advanced",
    color: "#bc9bc4",
    kind: "owl",
    desc: "Patient, precise, and ready to test your calculation.",
  },
  {
    id: "rowan",
    name: "Rowan",
    elo: 2000,
    group: "Expert",
    color: "#c7a28b",
    kind: "fox",
    desc: "Sharp tactics meet a very steady game.",
  },
  {
    id: "atlas",
    name: "Atlas",
    elo: 2600,
    group: "Master",
    color: "#8eaeb7",
    kind: "owl",
    desc: "A formidable challenge. Bring your best ideas.",
  },
];
export const coaches = [
  {
    id: "fundamentals",
    name: "Olive",
    desc: "Build good habits",
    detail: "Development, central squares, and a safe king.",
    color: "#d4af88",
    kind: "coach",
  },
  {
    id: "tactics",
    name: "Theo",
    desc: "See the possibilities",
    detail: "Forcing moves, checks, captures, and legal replies.",
    color: "#9aacc9",
    kind: "coach",
  },
  {
    id: "planning",
    name: "Iris",
    desc: "Find a thoughtful plan",
    detail: "Piece activity, central control, and candidate moves.",
    color: "#b99bc4",
    kind: "coach",
  },
];
export function opening(moves, start) {
  const match = findOpening(moves, start);
  return match
    ? `${match.eco} · ${match.name}`
    : moves.length
      ? "Position analysis"
      : "Starting position";
}
