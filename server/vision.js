import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { parseGIF, decompressFrames } from "gifuct-js";
import { Chess, DEFAULT_POSITION, makeGame } from "../shared/chess.js";
const pieces = [
  "bR",
  "bN",
  "bB",
  "bQ",
  "bK",
  "bP",
  "wR",
  "wN",
  "wB",
  "wQ",
  "wK",
  "wP",
];
let defaults;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function pixel(raw, w, x, y) {
  return [
    ...raw.subarray(
      (Math.floor(y) * w + Math.floor(x)) * 3,
      (Math.floor(y) * w + Math.floor(x)) * 3 + 3,
    ),
  ];
}
export async function imageData(buffer) {
  const s = sharp(buffer, { limitInputPixels: 16000000, animated: false }),
    m = await s.metadata();
  if (!["png", "jpeg", "webp", "gif"].includes(m.format))
    throw Error("Use a PNG, JPEG, WebP or GIF image.");
  if (m.width < 80 || m.height < 80)
    throw Error("Image is too small; use at least 80 × 80 pixels.");
  const { data, info } = await s
    .rotate()
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
export function detectBoard({ data, w, h }) {
  const candidates = [];
  for (let y = 2; y < h; y += Math.max(2, Math.floor(h / 160))) {
    const runs = [];
    let x = 0;
    while (x < w) {
      const start = x,
        c = pixel(data, w, x, y);
      while (x < w && dist(c, pixel(data, w, x, y)) < 22) x++;
      if (x - start >= 8) runs.push({ start, len: x - start, c });
      else x = Math.max(x, start + 1);
    }
    for (let k = 0; k <= runs.length - 8; k++) {
      const r = runs.slice(k, k + 8),
        s = r.reduce((a, b) => a + b.len, 0) / 8;
      if (
        s < 10 ||
        r.some(
          (a, i) =>
            Math.abs(a.len - s) > s * 0.13 ||
            (i && Math.abs(a.start - (r[i - 1].start + r[i - 1].len)) > 2),
        )
      )
        continue;
      if (
        dist(r[0].c, r[1].c) < 35 ||
        r.some((a, i) => dist(a.c, r[i % 2].c) > 25)
      )
        continue;
      const left = r[0].start,
        size = Math.round(s * 8),
        probe = Math.min(w - 1, Math.round(left + s * 0.06));
      let top = y;
      while (
        top > 0 &&
        Math.min(
          dist(pixel(data, w, probe, top - 1), r[0].c),
          dist(pixel(data, w, probe, top - 1), r[1].c),
        ) < 30
      )
        top--;
      if (top + size > h + 2 || left + size > w + 2) continue;
      let good = 0;
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++) {
          const c = pixel(
            data,
            w,
            Math.min(w - 1, left + (col + 0.06) * s),
            Math.min(h - 1, top + (row + 0.06) * s),
          );
          if (Math.min(dist(c, r[0].c), dist(c, r[1].c)) < 35) good++;
        }
      if (good > 57) candidates.push({ left, top, size, good });
    }
  }
  candidates.sort((a, b) => b.size - a.size || b.good - a.good);
  if (!candidates.length)
    throw Error(
      "Could not find a complete checkerboard. Set the crop to the board edges, then try again. Your image is preserved.",
    );
  return candidates[0];
}
async function feature(tile) {
  const { data } = await sharp(tile)
    .resize(32, 32)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bg = pixel(data, 32, 1, 1),
    values = [];
  let light = 0,
    chroma = 0,
    n = 0;
  for (let y = 3; y < 29; y++)
    for (let x = 3; x < 29; x++) {
      const p = pixel(data, 32, x, y),
        d = dist(p, bg);
      const foreground = d > 25 ? 1 : 0;
      values.push(foreground);
      if (foreground) {
        light += (p[0] + p[1] + p[2]) / 3;
        chroma += Math.max(...p) - Math.min(...p);
        n++;
      }
    }
  return {
    mask: values,
    light: n ? light / n : 0,
    chroma: n ? chroma / n : 0,
    occupancy: n / 676,
  };
}
async function templates() {
  if (defaults) return defaults;
  defaults = {};
  for (const key of pieces) {
    const svg = await readFile(
      new URL("../public/pieces/" + key + ".svg", import.meta.url),
    );
    const tile = await sharp({
      create: { width: 80, height: 80, channels: 3, background: "#eeeed2" },
    })
      .composite([{ input: await sharp(svg).resize(80, 80).png().toBuffer() }])
      .png()
      .toBuffer();
    defaults[key] = await feature(tile);
  }
  return defaults;
}
export function placement(board, orientation = "white") {
  const rows = [];
  for (let row = 0; row < 8; row++) {
    let out = "",
      empty = 0;
    for (let col = 0; col < 8; col++) {
      let i = row * 8 + col;
      if (orientation === "black") i = 63 - i;
      const key = board[i];
      if (!key) empty++;
      else {
        if (empty) {
          out += empty;
          empty = 0;
        }
        out += key[0] === "w" ? key[1].toUpperCase() : key[1].toLowerCase();
      }
    }
    if (empty) out += empty;
    rows.push(out);
  }
  return rows.join("/");
}
export async function recognize(
  buffer,
  { crop, orientation = "white", calibrate = false, customTemplates } = {},
) {
  const img = await imageData(buffer);
  const bounds = crop || detectBoard(img);
  const left = Math.round(Number(bounds.left)),
    top = Math.round(Number(bounds.top)),
    size = Math.round(Number(bounds.size));
  if (
    !Number.isFinite(size) ||
    size < 80 ||
    left < 0 ||
    top < 0 ||
    left + size > img.w ||
    top + size > img.h
  )
    throw Error(
      "Crop must be a square inside the image, at least 80 pixels wide.",
    );
  const normalized = await sharp(img.data, {
    raw: { width: img.w, height: img.h, channels: 3 },
  })
    .extract({ left, top, width: size, height: size })
    .resize(640, 640, { kernel: "nearest" })
    .png()
    .toBuffer();
  const features = [];
  for (let i = 0; i < 64; i++)
    features.push(
      await feature(
        await sharp(normalized)
          .extract({
            left: (i % 8) * 80,
            top: Math.floor(i / 8) * 80,
            width: 80,
            height: 80,
          })
          .png()
          .toBuffer(),
      ),
    );
  const refs = { ...(await templates()), ...customTemplates };
  let learned;
  if (calibrate) {
    learned = {};
    const start = new Chess()
      .board()
      .flat()
      .map((p) => (p ? p.color + p.type.toUpperCase() : null));
    for (let i = 0; i < 64; i++) {
      const key = start[orientation === "black" ? 63 - i : i];
      if (key && features[i].occupancy > 0.05 && !learned[key])
        learned[key] = features[i];
    }
    if (Object.keys(learned).length !== 12)
      throw Error("Starting-position calibration needs all 32 pieces visible.");
    Object.assign(refs, learned);
  }
  const board = [],
    uncertain = [];
  for (let i = 0; i < 64; i++) {
    const f = features[i];
    if (f.occupancy < 0.045) {
      board.push(null);
      continue;
    }
    const scores = Object.entries(refs)
      .map(([key, t]) => {
        if (!Array.isArray(t.mask) || t.mask.length !== 676)
          throw Error("Invalid piece-style calibration.");
        let intersect = 0,
          union = 0;
        for (let j = 0; j < 676; j++) {
          if (f.mask[j] || t.mask[j]) union++;
          if (f.mask[j] && t.mask[j]) intersect++;
        }
        return {
          key,
          score:
            1 -
            intersect / Math.max(1, union) +
            Math.abs(f.light - t.light) / 500 +
            Math.abs(f.chroma - (t.chroma || 0)) / 180,
        };
      })
      .sort((a, b) => a.score - b.score);
    board.push(scores[0].key);
    if (scores[0].score > 0.25 || scores[1].score - scores[0].score < 0.035)
      uncertain.push({
        index: i,
        square:
          String.fromCharCode(
            97 + (orientation === "black" ? 7 - (i % 8) : i % 8),
          ) +
          (orientation === "black"
            ? 1 + Math.floor(i / 8)
            : 8 - Math.floor(i / 8)),
        confidence: Math.max(0, 1 - scores[0].score),
        alternatives: scores.slice(0, 3).map((s) => s.key),
      });
  }
  return {
    placement: placement(board, orientation),
    uncertain,
    crop: { left, top, size },
    width: img.w,
    height: img.h,
    templates: learned,
    preview: "data:image/png;base64," + normalized.toString("base64"),
    note: "Turn, castling, en passant and history cannot be recovered from pixels. Confirm metadata before analysis.",
  };
}
export async function reconstructGif(
  buffer,
  {
    orientation = "white",
    crop,
    customTemplates,
    calibrate = false,
    start = DEFAULT_POSITION,
  } = {},
  onProgress = () => {},
  signal,
) {
  const gif = parseGIF(buffer),
    width = gif.lsd.width,
    height = gif.lsd.height;
  if (
    width * height > 4000000 ||
    gif.frames.length > 600 ||
    width * height * gif.frames.length > 180000000
  )
    throw Error(
      "GIF exceeds limits: 4 MP, 600 frames or 180 million frame pixels.",
    );
  const frames = decompressFrames(gif, true),
    canvas = new Uint8ClampedArray(width * height * 4);
  let previous,
    bounds = crop,
    templates = customTemplates,
    lastSeen = "",
    lastMatched = -1;
  const g = new Chess(start),
    moves = [],
    issues = [];
  const began = Date.now();
  for (let i = 0; i < frames.length; i++) {
    if (Date.now() - began > 90000)
      throw Error(
        "Animation processing exceeded 90 seconds. Use a smaller GIF or import PGN.",
      );
    if (signal?.aborted) throw Error("Cancelled");
    const frame = frames[i];
    if (frame.disposalType === 3) previous = canvas.slice();
    for (let y = 0; y < frame.dims.height; y++)
      for (let x = 0; x < frame.dims.width; x++) {
        const a = (y * frame.dims.width + x) * 4,
          b = ((frame.dims.top + y) * width + frame.dims.left + x) * 4,
          alpha = frame.patch[a + 3] / 255;
        if (alpha) {
          for (let c = 0; c < 3; c++)
            canvas[b + c] =
              frame.patch[a + c] * alpha + canvas[b + c] * (1 - alpha);
          canvas[b + 3] = 255;
        }
      }
    const png = await sharp(Buffer.from(canvas), {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toBuffer();
    let r;
    try {
      r = await recognize(png, {
        crop: bounds,
        orientation,
        customTemplates: templates,
        calibrate: calibrate && i === 0,
      });
      bounds = r.crop;
      if (r.templates) templates = r.templates;
    } catch (e) {
      issues.push({ frame: i, message: e.message });
    }
    if (r) {
      lastSeen = r.placement;
      const current = g.fen().split(" ")[0];
      if (lastSeen === current) {
        lastMatched = i;
        issues.length = 0;
      } else {
        const matches = g.moves({ verbose: true }).filter((m) => {
          const next = new Chess(g.fen());
          next.move(m);
          return next.fen().split(" ")[0] === lastSeen;
        });
        if (matches.length === 1) {
          g.move(matches[0]);
          moves.push(matches[0].san);
          lastMatched = i;
          issues.length = 0;
        } else
          issues.push({
            frame: i,
            message:
              "No unique one-move legal transition from the last confirmed position.",
            preview: r.preview,
            placement: lastSeen,
          });
      }
    }
    if (frame.disposalType === 2) {
      for (let y = 0; y < frame.dims.height; y++)
        for (let x = 0; x < frame.dims.width; x++) {
          const b = ((frame.dims.top + y) * width + frame.dims.left + x) * 4;
          canvas.fill(0, b, b + 4);
        }
    } else if (frame.disposalType === 3 && previous) canvas.set(previous);
    onProgress(i + 1, frames.length);
  }
  const complete = lastMatched === frames.length - 1 && moves.length > 0;
  return {
    game: makeGame(start, moves, {
      White: "GIF White",
      Black: "GIF Black",
      Result: "*",
    }),
    complete,
    frames: frames.length,
    lastMatched,
    issues: issues.slice(-4),
    templates,
    note: complete
      ? "All frame positions resolve to a legal game."
      : "Partial reconstruction. The final transition is unresolved; no missing moves have been invented. Correct the source or import PGN.",
  };
}
