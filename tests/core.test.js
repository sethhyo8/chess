import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  Chess,
  DEFAULT_POSITION,
  importPgn,
  importMoveText,
  exportPgn,
  makeGame,
  moveQuality,
  validatePosition,
  coachText,
  timeoutResult,
  formatClock,
  tacticalFacts,
} from "../shared/chess.js";
import { search, botMove, selectWeakMove } from "../server/engine.js";
test("PGN imports multiple games, comments, variations, result and custom FEN", () => {
  const list = importPgn(
    '[White "Alice"]\n[WhiteElo "1200"]\n\n1. e4 {Centre} (1. d4 d5) e5 2. Nf3 $1 Nc6 *\n\n[White "B"]\n[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ *',
  );
  assert.equal(list.length, 2);
  assert.equal(list[0].headers.WhiteElo, "1200");
  assert.equal(list[0].tree.moves[0].commentAfter, "Centre");
  assert.match(exportPgn(list[0]), /\(1. d4/);
  assert.match(exportPgn(list[0]), /\$1/);
  assert.equal(list[1].moves[0], "a8=Q+");
  assert.equal(
    importPgn(exportPgn(list[0]))[0].fens.at(-1),
    list[0].fens.at(-1),
  );
  assert.throws(() => importPgn("1. e4 e4"));
  assert.throws(() => importPgn(""));
  assert.throws(() => importPgn("not a game"));
});
test("standard chess legality: castle, en passant, promotion, mate and draws", () => {
  const g = new Chess();
  ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"].forEach((m) => g.move(m));
  assert.equal(g.get("g1").type, "k");
  const ep = new Chess();
  ["e4", "a6", "e5", "d5", "exd6"].forEach((m) => ep.move(m));
  assert.equal(ep.get("d5"), undefined);
  assert.equal(ep.get("d6").color, "w");
  const prom = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
  prom.move("a8=N");
  assert.equal(prom.get("a8").type, "n");
  const mate = new Chess();
  ["f3", "e5", "g4", "Qh4#"].forEach((m) => mate.move(m));
  assert.ok(mate.isCheckmate());
  assert.ok(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").isStalemate());
  assert.ok(new Chess("7k/8/8/8/8/8/8/K7 w - - 0 1").isInsufficientMaterial());
  const rep = new Chess();
  ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"].forEach((m) =>
    rep.move(m),
  );
  assert.ok(rep.isThreefoldRepetition());
  assert.ok(new Chess("7k/8/8/8/8/8/R7/K7 w - - 100 1").isDraw());
  assert.throws(() => validatePosition("8/8/8/8/8/8/4k3/4K3 w - - 0 1"));
});
test("evaluation perspective and quality are consistent", () => {
  assert.equal(moveQuality(100, -100, "w").loss, 200);
  assert.equal(moveQuality(-100, 100, "b").loss, 200);
  assert.equal(moveQuality(10, 20, "w").accuracy, 100);
  assert.equal(moveQuality(0, -400, "w").label, "Blunder");
  assert.equal(moveQuality(99995, 0, "w").label, "Blunder");
});
test("clock rollover and timeout mating material", () => {
  assert.equal(formatClock(59999), "1:00");
  assert.equal(formatClock(60000), "1:00");
  assert.equal(formatClock(0), "0:00");
  assert.match(
    timeoutResult(new Chess("7k/8/8/8/8/8/R7/K7 w - - 0 1"), "w"),
    /Draw/,
  );
  assert.equal(timeoutResult(new Chess(), "w"), "Black wins on time");
});
test("lower-strength policy changes loss distribution without uniform randomness", () => {
  const lines = [0, 50, 100, 200, 400, 700].map((loss, i) => ({
    cp: 100 - loss,
    pv: [String(i)],
  }));
  const mean = (elo) => {
    let n = 0;
    for (let i = 0; i < 1000; i++) {
      n += 100 - selectWeakMove(lines, elo, "w", () => i / 1000).cp;
    }
    return n / 1000;
  };
  assert.ok(mean(350) > mean(1200) * 2);
  assert.equal(
    selectWeakMove(lines, 350, "w", () => 0),
    lines[0],
  );
});
test("real production Stockfish advertises options, gives legal lines and mate signs", async () => {
  const info = await search({ fen: DEFAULT_POSITION, discover: true });
  assert.match(info.name, /17.1/);
  assert.ok(
    info.options.some((o) => o.includes("UCI_Elo") && o.includes("min 1320")),
  );
  const r = await search({ fen: DEFAULT_POSITION, depth: 8, multi: 3 });
  assert.equal(r.lines.length, 3);
  for (const l of r.lines) {
    const g = new Chess();
    for (const u of l.pv)
      assert.ok(
        g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }),
      );
  }
  const mate = await search({
    fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
    depth: 8,
    multi: 1,
  });
  assert.ok(mate.cp > 0);
  assert.ok(mate.mate > 0);
  const black = await search({
    fen: "8/8/8/8/8/6k1/5q2/7K b - - 0 1",
    depth: 8,
    multi: 1,
  });
  assert.ok(black.cp < 0);
  assert.ok(black.mate < 0);
  const terminal = await search({ fen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1" });
  assert.ok(terminal.terminal);
  assert.equal(terminal.cp, 100000);
  const bot = await botMove({ fen: DEFAULT_POSITION, moves: ["e4"], elo: 350 });
  assert.ok(
    new Chess(makeGame(DEFAULT_POSITION, ["e4"]).fens.at(-1)).move(bot.move),
  );
  const expert = await botMove({ fen: DEFAULT_POSITION, moves: [], elo: 2000 });
  assert.ok(new Chess().move(expert.move));
  assert.match(expert.policy, /native/);
  const c = new AbortController();
  const p = search({
    fen: DEFAULT_POSITION,
    depth: 30,
    multi: 3,
    signal: c.signal,
  });
  setTimeout(() => c.abort(), 50);
  await assert.rejects(p, /Cancelled/);
});
test("coaching uses legal moves, verified captures/checks, progressive hints", async () => {
  const fen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
    r = await search({ fen, depth: 8, multi: 1 });
  assert.doesNotMatch(coachText(fen, r, "fundamentals", "hint1"), /Qf|Qg/);
  assert.match(coachText(fen, r, "tactics", "hint2"), /queen on f7/);
  const message = coachText(fen, r, "tactics", "why");
  assert.match(message, /checkmate/);
  assert.ok(message.length < 120);
  assert.doesNotMatch(message, /depth|evaluation|legal engine line/);
});

test("pasted SAN, PGN and coordinate moves preserve the full legal history", () => {
  for (const text of [
    "e4 e5 Nf3 Nc6",
    "1. e4 e5 2. Nf3 Nc6",
    "e2e4 e7e5 g1f3 b8c6",
  ]) {
    const game = importMoveText(text);
    assert.deepEqual(game.moves, ["e4", "e5", "Nf3", "Nc6"]);
    assert.equal(game.fens.length, 5);
    assert.equal(new Chess(game.fens.at(-1)).turn(), "w");
  }
  assert.throws(() => importMoveText("e2e5"), /Invalid move/);
  assert.throws(() => importMoveText(""), /Paste moves/);
});
test("coach verifies forks and absolute pins on the legal resulting board", () => {
  assert.match(
    tacticalFacts("3q3k/8/8/4N3/8/8/8/K7 w - - 0 1", "e5f7").join(" "),
    /queen on d8 and the king on h8 at once: a fork/,
  );
  assert.match(
    tacticalFacts("4k3/4r3/8/8/8/8/8/R6K w - - 0 1", "a1e1").join(" "),
    /rook on e7 is pinned to its king on e8/,
  );
  assert.deepEqual(tacticalFacts(DEFAULT_POSITION, "e2e4"), []);
});
test("engine startup failure is reported by the production adapter", async () => {
  const run = promisify(execFile);
  const { stdout } = await run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {search} from './server/engine.js';import {DEFAULT_POSITION} from './shared/chess.js';try{await search({fen:DEFAULT_POSITION,discover:true});process.exit(2);}catch(e){console.log(e.message);}`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        STOCKFISH_JS: "/tmp/chessgrove-missing-engine.js",
      },
    },
  );
  assert.match(stdout, /Engine stopped/);
});
