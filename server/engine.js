import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { position } from "../shared/chess.js";
const executable =
  process.env.STOCKFISH_JS ||
  fileURLToPath(
    new URL(
      "../node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js",
      import.meta.url,
    ),
  );
export let engineInfo = {
  name: "Stockfish 17.1 Lite",
  options: [],
  ready: false,
};
let active = 0;
const waiting = [],
  cache = new Map();
async function acquire(signal) {
  if (signal?.aborted) throw Error("Cancelled");
  if (active < 2) {
    active++;
    return;
  }
  if (waiting.length >= 12) throw Error("Engine busy; try again shortly.");
  await new Promise((resolve, reject) => {
    const item = {
      resolve: () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      },
    };
    const abort = () => {
      waiting.splice(waiting.indexOf(item), 1);
      reject(Error("Cancelled"));
    };
    waiting.push(item);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
function release() {
  if (waiting.length) waiting.shift().resolve();
  else active--;
}
export async function search({
  fen,
  moves = [],
  depth = 10,
  multi = 3,
  elo,
  signal,
  discover = false,
} = {}) {
  const g = position(fen, moves);
  const key = createHash("sha256")
    .update(JSON.stringify([fen, moves, depth, multi, elo, "17.1-lite"]))
    .digest("hex");
  if (!discover && cache.has(key)) return cache.get(key);
  if (!discover && g.isGameOver())
    return {
      lines: [],
      cp: g.isCheckmate() ? (g.turn() === "w" ? -100000 : 100000) : 0,
      mate: g.isCheckmate() ? 0 : null,
      depth: 0,
      terminal: true,
      engine: engineInfo.name,
    };
  await acquire(signal);
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [executable], {
          stdio: ["pipe", "pipe", "pipe"],
        }),
        options = [],
        lines = new Map();
      let buffer = "",
        settled = false,
        phase = "uci",
        name = "",
        err = "";
      const timer = setTimeout(
        () => finish(Error("Engine timed out after 30 seconds.")),
        30000,
      );
      const abort = () => finish(Error("Cancelled"));
      function finish(error, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        child.stdin.end("quit\n");
        child.kill();
        error ? reject(error) : resolve(value);
      }
      function send(s) {
        if (!child.stdin.destroyed) child.stdin.write(s + "\n");
      }
      child.stdin.on("error", () => {});
      child.on("error", (e) => finish(e));
      child.on("exit", (code) => {
        if (!settled)
          finish(Error("Engine stopped: " + code + " " + err.slice(-150)));
      });
      child.stderr.on("data", (d) => (err += d));
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) return abort();
      child.stdout.on("data", (data) => {
        buffer += data;
        const chunks = buffer.split("\n");
        buffer = chunks.pop();
        for (const line of chunks) {
          if (line.startsWith("id name ")) name = line.slice(8).trim();
          if (line.startsWith("option name ")) options.push(line.trim());
          if (line.trim() === "uciok") {
            engineInfo = { name, options, ready: true };
            if (discover) return finish(null, engineInfo);
            const set = (n, v) => {
              if (
                options.some((x) => x.startsWith("option name " + n + " type "))
              )
                send(`setoption name ${n} value ${v}`);
            };
            set("Hash", 32);
            set("Threads", 1);
            set("MultiPV", multi);
            if (elo) {
              const opt = options.find((x) =>
                  x.startsWith("option name UCI_Elo "),
                ),
                min = Number(opt?.match(/min (\d+)/)?.[1]),
                max = Number(opt?.match(/max (\d+)/)?.[1]);
              if (elo >= min && elo <= max) {
                set("UCI_LimitStrength", "true");
                set("UCI_Elo", elo);
              }
            }
            send("isready");
            phase = "ready";
          }
          if (line.trim() === "readyok" && phase === "ready") {
            phase = "search";
            send(
              `position fen ${fen}${
                moves.length
                  ? " moves " +
                    g
                      .history({ verbose: true })
                      .map((m) => m.from + m.to + (m.promotion || ""))
                      .join(" ")
                  : ""
              }`,
            );
            send("go depth " + depth);
          }
          if (line.startsWith("info depth") && line.includes(" pv ")) {
            const d = Number(line.match(/depth (\d+)/)?.[1]),
              rank = Number(line.match(/multipv (\d+)/)?.[1] || 1),
              score = line.match(/score (cp|mate) (-?\d+)/),
              pv = line.split(" pv ")[1]?.trim().split(/\s+/);
            if (score && pv) {
              const sign = g.turn() === "w" ? 1 : -1,
                mate = score[1] === "mate" ? Number(score[2]) * sign : null,
                cp =
                  mate == null
                    ? Number(score[2]) * sign
                    : (Number(score[2]) > 0 ? 1 : -1) *
                      sign *
                      (100000 - Math.abs(Number(score[2])));
              lines.set(rank, { depth: d, cp, mate, pv });
            }
          }
          if (line.startsWith("bestmove ")) {
            const out = {
              bestmove: line.split(" ")[1],
              lines: [...lines.entries()]
                .sort((a, b) => a[0] - b[0])
                .map((x) => x[1]),
              engine: name,
            };
            Object.assign(out, out.lines[0] || { cp: 0, depth: 0 });
            if (cache.size > 5000) cache.delete(cache.keys().next().value);
            cache.set(key, out);
            finish(null, out);
          }
        }
      });
      send("uci");
    });
  } finally {
    release();
  }
}
export function selectWeakMove(lines, elo, turn, random = Math.random) {
  const sign = turn === "w" ? 1 : -1,
    best = lines[0].cp * sign;
  const temperature =
    elo <= 400 ? 240 : elo <= 700 ? 150 : elo <= 1000 ? 85 : 45;
  const weights = lines.map((l) =>
    Math.exp(-Math.max(0, best - l.cp * sign) / temperature),
  );
  // Keep a deliberate preference for the best move, even at beginner levels.
  weights[0] *= 1.5;
  let x = random() * weights.reduce((a, b) => a + b, 0);
  return lines[weights.findIndex((w) => (x -= w) <= 0)] || lines.at(-1);
}
export async function botMove({ fen, moves, elo, signal }) {
  const g = position(fen, moves);
  if (g.isGameOver()) return { move: null };
  const opt = engineInfo.options.find((x) =>
    x.startsWith("option name UCI_Elo "),
  );
  const min = Number(opt?.match(/min (\d+)/)?.[1] || 1320);
  const native = elo >= min;
  const result = await search({
    fen,
    moves,
    depth: native ? 12 : 7,
    multi: native ? 1 : Math.min(24, g.moves().length),
    elo: native ? elo : undefined,
    signal,
  });
  const chosen = native
    ? result.lines[0]
    : selectWeakMove(result.lines, elo, g.turn());
  const u = native ? result.bestmove : chosen?.pv[0];
  if (!u) throw Error("Engine returned no legal move.");
  const move = g.move({
    from: u.slice(0, 2),
    to: u.slice(2, 4),
    promotion: u[4],
  });
  return {
    move: move.san,
    policy: native
      ? "native UCI strength"
      : "weighted centipawn-loss candidates",
    engine: result.engine,
  };
}
