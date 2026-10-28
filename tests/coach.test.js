import test from "node:test";
import assert from "node:assert/strict";
import { Chess, DEFAULT_POSITION } from "../shared/chess.js";
import { coachMoveComment } from "../shared/coach.js";

test("coach comments describe both sides' actual moves without classification jargon", () => {
  const human = coachMoveComment(DEFAULT_POSITION, "e4", { loss: 50 });
  assert.match(human, /centre/);
  assert.doesNotMatch(human, /inaccuracy|centipawn|depth|good at/i);
  const board = new Chess();
  board.move("e4");
  assert.match(
    coachMoveComment(board.fen(), "e5", { loss: 0 }, { human: false }),
    /I'm/,
  );
  assert.match(
    coachMoveComment(DEFAULT_POSITION, "Nf3", { loss: 0 }),
    /knight/,
  );
});

test("mistake advice validates engine alternatives and checks real captures", () => {
  const message = coachMoveComment(
    DEFAULT_POSITION,
    "a3",
    { loss: 200 },
    { alternative: "e2e4" },
  );
  assert.match(message, /e4/);
  assert.doesNotMatch(message, /inaccuracy|mistake|depth|pawns/i);
  assert.doesNotMatch(
    coachMoveComment(
      DEFAULT_POSITION,
      "a3",
      { loss: 200 },
      { alternative: "a1a8" },
    ),
    /Ra8/,
  );
  const board = new Chess();
  board.move("e4");
  board.move("d5");
  assert.match(
    coachMoveComment(board.fen(), "exd5", { loss: 0 }),
    /taken my pawn/,
  );
});
