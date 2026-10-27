import sharp from "sharp";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { Chess, DEFAULT_POSITION } from "../shared/chess.js";
import { samplePgn } from "../src/data.js";
export async function renderBoard(
  fen,
  { flipped = false, padding = 0, size = 480, unknown = false } = {},
) {
  const g = new Chess(fen),
    cell = size / 8,
    composites = [];
  let svg = `<svg width="${size + padding * 2}" height="${size + padding * 2}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#302e2b"/>`;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      svg += `<rect x="${padding + c * cell}" y="${padding + r * cell}" width="${cell}" height="${cell}" fill="${(r + c) % 2 ? "#769656" : "#eeeed2"}"/>`;
  svg += "</svg>";
  for (const row of g.board())
    for (const p of row)
      if (p) {
        let x = p.square.charCodeAt(0) - 97,
          y = 8 - Number(p.square[1]);
        if (flipped) {
          x = 7 - x;
          y = 7 - y;
        }
        const piece = await sharp(
          await readFile(
            new URL(
              "../public/pieces/" + p.color + p.type.toUpperCase() + ".svg",
              import.meta.url,
            ),
          ),
        )
          .resize(cell, cell)
          .png()
          .toBuffer();
        composites.push({
          input: piece,
          left: padding + x * cell,
          top: padding + y * cell,
        });
      }
  if (unknown)
    composites.push({
      input: Buffer.from(
        `<svg width="${cell}" height="${cell}" xmlns="http://www.w3.org/2000/svg"><circle cx="${cell / 2}" cy="${cell / 2}" r="${cell * 0.35}" fill="red"/></svg>`,
      ),
      left: padding + 4 * cell,
      top: padding + 4 * cell,
    });
  return sharp(Buffer.from(svg)).composite(composites).png().toBuffer();
}
export async function renderGif(
  start,
  moves,
  { flipped = false, duplicates = true, animation = false, omit = false } = {},
) {
  const encoder = GIFEncoder(),
    g = new Chess(start),
    fens = [g.fen()];
  for (const m of moves) {
    g.move(m);
    fens.push(g.fen());
  }
  for (let i = 0; i < fens.length; i++) {
    if (omit && i === 1) continue;
    if (animation && i > 0) {
      const frame = await renderBoard(fens[i], {
        size: 240,
        unknown: true,
        flipped,
      });
      const rgba = await sharp(frame).ensureAlpha().raw().toBuffer(),
        palette = quantize(rgba, 256);
      encoder.writeFrame(applyPalette(rgba, palette), 240, 240, {
        palette,
        delay: 60,
        dispose: 1,
      });
    }
    const rgba = await sharp(await renderBoard(fens[i], { size: 240, flipped }))
        .ensureAlpha()
        .raw()
        .toBuffer(),
      palette = quantize(rgba, 256);
    for (let j = 0; j < (duplicates ? 2 : 1); j++)
      encoder.writeFrame(applyPalette(rgba, palette), 240, 240, {
        palette,
        delay: 350,
        dispose: 1,
      });
  }
  encoder.finish();
  return Buffer.from(encoder.bytes());
}
// A transient overlay is disposed to the previous frame before a transparent
// delta frame arrives. Ignoring disposal leaves a spurious piece on c4.
export async function renderDisposalGif() {
  const size = 240,
    g = new Chess(),
    encoder = GIFEncoder();
  const before = await sharp(await renderBoard(g.fen(), { size }))
    .ensureAlpha()
    .raw()
    .toBuffer();
  const palette = quantize(before, 256);
  encoder.writeFrame(applyPalette(before, palette), size, size, {
    palette,
    dispose: 1,
    delay: 200,
  });
  const overlay = new Uint8Array(size * size);
  for (let y = 123; y < 147; y++)
    for (let x = 63; x < 87; x++) overlay[y * size + x] = 1;
  encoder.writeFrame(overlay, size, size, {
    palette: [
      [0, 0, 0],
      [255, 0, 0],
    ],
    transparent: true,
    transparentIndex: 0,
    dispose: 3,
    delay: 60,
  });
  g.move("e4");
  const after = await sharp(await renderBoard(g.fen(), { size }))
    .ensureAlpha()
    .raw()
    .toBuffer();
  const colors = quantize(after, 255),
    indices = applyPalette(after, colors),
    delta = new Uint8Array(size * size);
  for (let i = 0; i < indices.length; i++) {
    const j = i * 4;
    delta[i] =
      before[j] === after[j] &&
      before[j + 1] === after[j + 1] &&
      before[j + 2] === after[j + 2]
        ? 0
        : indices[i] + 1;
  }
  encoder.writeFrame(delta, size, size, {
    palette: [[1, 2, 3], ...colors],
    transparent: true,
    transparentIndex: 0,
    dispose: 2,
    delay: 200,
  });
  encoder.finish();
  return Buffer.from(encoder.bytes());
}
if (process.argv[1]?.endsWith("/scripts/fixtures.js")) {
  await mkdir("public/fixtures", { recursive: true });
  const g = new Chess();
  ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4"].forEach((m) => g.move(m));
  await writeFile(
    "public/fixtures/sicilian.png",
    await renderBoard(g.fen(), { padding: 35 }),
  );
  await writeFile(
    "public/fixtures/sicilian-flipped.png",
    await renderBoard(g.fen(), { flipped: true, padding: 35 }),
  );
  await writeFile(
    "public/fixtures/starting-position.png",
    await renderBoard(DEFAULT_POSITION),
  );
  await writeFile(
    "public/fixtures/sample.gif",
    await renderGif(
      DEFAULT_POSITION,
      ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"],
      { animation: true },
    ),
  );
  await writeFile("public/fixtures/sample.pgn", samplePgn + "\n");
  await writeFile(
    "public/fixtures/expected.json",
    JSON.stringify(
      {
        screenshotFen: g.fen(),
        gifMoves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"],
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Sample PGN, screenshots, GIF and expected positions generated.");
}
