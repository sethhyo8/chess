import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { recognize, reconstructGif } from "../server/vision.js";
import {
  renderBoard,
  renderGif,
  renderDisposalGif,
} from "../scripts/fixtures.js";
import { Chess, DEFAULT_POSITION } from "../shared/chess.js";
test("screenshot recognition in both orientations, larger image and explicit crop", async () => {
  const g = new Chess();
  ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"].forEach((m) => g.move(m));
  for (const flipped of [false, true]) {
    const png = await renderBoard(g.fen(), { flipped, padding: 35 });
    const r = await recognize(png, {
      orientation: flipped ? "black" : "white",
    });
    assert.equal(r.placement, g.fen().split(" ")[0]);
    assert.equal(r.crop.left, 35);
    assert.equal(r.crop.top, 35);
  }
  const r = await recognize(await renderBoard(g.fen(), { padding: 35 }), {
    crop: { left: 35, top: 35, size: 480 },
  });
  assert.equal(r.placement, g.fen().split(" ")[0]);
});
test("uncertain pieces flagged and learned starting-position style", async () => {
  const r = await recognize(
    await renderBoard(DEFAULT_POSITION, { unknown: true }),
  );
  assert.ok(r.uncertain.some((x) => x.square === "e4"));
  const s = await recognize(await renderBoard(DEFAULT_POSITION), {
    calibrate: true,
  });
  assert.equal(Object.keys(s.templates).length, 12);
  assert.equal(s.placement, DEFAULT_POSITION.split(" ")[0]);
  await assert.rejects(recognize(Buffer.from("bad")), /unsupported|Input/);
});
test("GIF reconstruction handles duplicate, intermediate frames, flipped and castling", async () => {
  const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"];
  for (const flipped of [false, true]) {
    const r = await reconstructGif(
      await renderGif(DEFAULT_POSITION, moves, { flipped, animation: true }),
      { orientation: flipped ? "black" : "white" },
    );
    assert.ok(
      r.complete,
      JSON.stringify(r.issues.map(({ preview, ...issue }) => issue)),
    );
    assert.deepEqual(r.game.moves, moves);
    const g = new Chess();
    moves.forEach((m) => g.move(m));
    assert.equal(r.game.fens.at(-1), g.fen());
  }
});
test("GIF promotion, en passant and unresolved gap", async () => {
  const p = "7k/P7/8/8/8/8/8/7K w - - 0 1";
  const promotion = await reconstructGif(await renderGif(p, ["a8=Q+"]), {
    start: p,
  });
  assert.ok(promotion.complete);
  assert.equal(promotion.game.moves[0], "a8=Q+");
  const ep = "7k/8/8/3pP3/8/8/8/7K w - d6 0 1";
  const r = await reconstructGif(await renderGif(ep, ["exd6"]), { start: ep });
  assert.ok(r.complete);
  assert.equal(new Chess(r.game.fens.at(-1)).get("d5"), undefined);
  const gap = await reconstructGif(
    await renderGif(DEFAULT_POSITION, ["e4", "e5"], { omit: true }),
  );
  assert.equal(gap.complete, false);
  assert.equal(gap.game.moves.length, 0);
  assert.ok(gap.issues.length);
});
test("GIF disposal restores previous pixels before transparent delta composition", async () => {
  const r = await reconstructGif(await renderDisposalGif());
  assert.ok(r.complete, JSON.stringify(r.issues.map(({ preview, ...x }) => x)));
  assert.deepEqual(r.game.moves, ["e4"]);
  const g = new Chess();
  g.move("e4");
  assert.equal(r.game.fens.at(-1), g.fen());
});
