import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createOpeningLookup } from "../src/openings.js";
const entries = JSON.parse(
  await readFile(new URL("../public/data/openings.json", import.meta.url)),
);
const lookup = createOpeningLookup(entries);

test("opening database recognises specific variations and transpositions", () => {
  assert.ok(entries.length > 3800);
  assert.deepEqual(
    new Set(entries.map((entry) => entry.eco[0])),
    new Set("ABCDE"),
  );
  assert.match(lookup(["e4", "c5"]).name, /Sicilian Defense/);
  const najdorf = lookup("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6".split(" "));
  assert.equal(najdorf.eco, "B90");
  assert.equal(najdorf.name, "Sicilian Defense: Najdorf Variation");
  const first = lookup("d4 d5 c4 e6 Nc3 Nf6".split(" "));
  const transposed = lookup("d4 Nf6 c4 e6 Nc3 d5".split(" "));
  assert.match(first.eco, /^D/);
  assert.equal(first.name, transposed.name);
  assert.equal(first.eco, transposed.eco);
});

test("opening lookup keeps the last named position and respects a custom starting board", () => {
  const sicilian = lookup(["e4", "c5"]);
  assert.equal(lookup("e4 c5 h3 a6 a3 h6".split(" ")).name, sicilian.name);
  assert.equal(lookup([], "7k/8/8/8/8/8/8/K7 w - - 0 1"), undefined);
  assert.equal(lookup([]), undefined);
});
