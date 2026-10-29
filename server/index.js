import express from "express";
import { fileURLToPath } from "node:url";
import { search, botMove, engineInfo } from "./engine.js";
import { recognize, reconstructGif } from "./vision.js";
import { position, moveQuality } from "../shared/chess.js";
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "22mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.get("/api/health", (_, res) => res.json(engineInfo));
app.get("/api/ready", (_, res) => res.status(engineInfo.ready ? 200 : 503).json(engineInfo));
function route(path, fn) {
  app.post(path, async (req, res) => {
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });
    try {
      res.json(await fn(req.body, abort.signal));
    } catch (e) {
      if (!res.destroyed) res.status(400).json({ error: e.message });
    }
  });
}
function settings(b) {
  if (
    !b.fen ||
    typeof b.fen !== "string" ||
    b.fen.length > 120 ||
    !Array.isArray(b.moves || []) ||
    (b.moves || []).length > 1000
  )
    throw Error("Invalid position or move history.");
  position(b.fen, b.moves || []);
  return { fen: b.fen, moves: b.moves || [] };
}
route("/api/analyse", async (b, signal) =>
  search({
    ...settings(b),
    depth: Math.min(14, Math.max(6, Number(b.depth) || 10)),
    multi: 3,
    signal,
  }),
);
route("/api/bot", async (b, signal) => {
  const elo = Number(b.elo);
  if (!Number.isInteger(elo) || elo < 250 || elo > 3000)
    throw Error("Unsupported strength.");
  return botMove({ ...settings(b), elo, signal });
});
route("/api/review", async (b, signal) => {
  const { fen, moves } = settings(b);
  if (moves.length > 400) throw Error("Review is limited to 400 half-moves.");
  const evaluations = [],
    qualities = [];
  for (let i = 0; i <= moves.length; i++) {
    if (signal.aborted) throw Error("Cancelled");
    const r = await search({
      fen,
      moves: moves.slice(0, i),
      depth: 9,
      multi: 1,
      signal,
    });
    evaluations.push(r);
    if (i)
      qualities.push(
        moveQuality(
          evaluations[i - 1].cp,
          r.cp,
          position(fen, moves.slice(0, i - 1)).turn(),
        ),
      );
  }
  return {
    evaluations,
    qualities,
    settings: "depth 9; 1 PV; 32 MB hash; 1 thread",
    engine: engineInfo.name,
  };
});
function upload(b) {
  if (typeof b.image !== "string" || b.image.length > 21000000)
    throw Error("Image must be under 15 MB.");
  const bytes = Buffer.from(
    b.image.replace(/^data:[^;]+;base64,/, ""),
    "base64",
  );
  if (bytes.length < 10 || bytes.length > 15000000)
    throw Error("Invalid image or file too large.");
  return bytes;
}
route("/api/recognize", async (b) => recognize(upload(b), b));
let imageJobs = 0;
app.post("/api/gif", async (req, res) => {
  if (imageJobs >= 1)
    return res
      .status(429)
      .json({
        error: "Another animation is being processed. Try again shortly.",
      });
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  imageJobs++;
  try {
    const bytes = upload(req.body);
    if (bytes.subarray(0, 3).toString() !== "GIF")
      throw Error("Choose an animated GIF.");
    res.setHeader("Content-Type", "application/x-ndjson");
    const send = (value) => {
      if (!res.destroyed) res.write(JSON.stringify(value) + "\n");
    };
    const result = await reconstructGif(
      bytes,
      req.body,
      (frame, total) => send({ progress: frame, total }),
      controller.signal,
    );
    send({ result });
    res.end();
  } catch (e) {
    if (!res.destroyed) {
      if (!res.headersSent) res.status(400);
      res.end(JSON.stringify({ error: e.message }) + "\n");
    }
  } finally {
    imageJobs--;
  }
});
app.use(
  "/pieces",
  express.static(fileURLToPath(new URL("../public/pieces", import.meta.url))),
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url))));
  app.get("/{*path}", (_, res) =>
    res.sendFile(fileURLToPath(new URL("../dist/index.html", import.meta.url))),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use((e, req, res, next) =>
  res.status(400).json({
    error: e.type === "entity.too.large" ? "File is too large." : e.message,
  }),
);
const server = app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log("Chessgrove listening on port " + (process.env.PORT || 3000)),
);
try {
  await search({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    discover: true,
  });
  console.log("Engine ready:", engineInfo.name);
} catch (e) {
  console.error("Engine unavailable:", e.message);
}
process.on("SIGTERM", () => server.close(() => process.exit(0)));
