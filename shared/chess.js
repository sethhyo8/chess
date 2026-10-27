import { Chess, DEFAULT_POSITION, validateFen } from "chess.js";
import { parse } from "@mliebelt/pgn-parser";
export { Chess, DEFAULT_POSITION };
export function position(fen = DEFAULT_POSITION, moves = []) {
  validatePosition(fen);
  const g = new Chess(fen);
  for (const m of moves) g.move(m);
  return g;
}
export function validatePosition(fen) {
  const v = validateFen(fen);
  if (!v.ok) throw Error(v.error);
  const g = new Chess(fen),
    other = g.turn() === "w" ? "b" : "w";
  const king = g
    .board()
    .flat()
    .find((p) => p?.type === "k" && p.color === other);
  if (king && g.isAttacked(king.square, g.turn()))
    throw Error(
      "The side that just moved cannot leave its king in check. Check the turn or piece placement.",
    );
  for (const c of ["w", "b"]) {
    const ps = g
      .board()
      .flat()
      .filter((p) => p?.color === c);
    if (ps.length > 16 || ps.filter((p) => p.type === "p").length > 8)
      throw Error("Too many pieces or pawns for one side.");
  }
  return g;
}
export function importPgn(text) {
  if (typeof text !== "string" || text.length > 1000000)
    throw Error("PGN must be under 1 MB.");
  if (!text.trim()) throw Error("Paste or choose a PGN first.");
  const trees = parse(text, { startRule: "games" });
  return trees.map((tree) => {
    const headers = Object.fromEntries(
      Object.entries(tree.tags || {})
        .filter(([k]) => k !== "messages")
        .map(([k, v]) => [
          k,
          typeof v === "object" ? (v.value ?? String(v)) : String(v),
        ]),
    );
    const start = headers.FEN || DEFAULT_POSITION,
      g = position(start),
      moves = [],
      fens = [g.fen()];
    for (const node of tree.moves) {
      const m = g.move(node.notation.notation);
      moves.push(m.san);
      fens.push(g.fen());
    }
    if (!moves.length) throw Error("No legal moves found in this PGN.");
    return {
      id: crypto.randomUUID(),
      headers,
      start,
      moves,
      fens,
      tree,
      raw: text,
      title: `${headers.White || "White"} vs ${headers.Black || "Black"}`,
      source: "PGN",
      created: Date.now(),
    };
  });
}
export function importMoveText(text) {
  if (typeof text !== "string" || !text.trim())
    throw Error("Paste moves first.");
  if (text.length > 1000000) throw Error("Move text must be under 1 MB.");
  const tokens = text
    .replace(/\d+\.(?:\.\.)?/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => !["*", "1-0", "0-1", "1/2-1/2"].includes(token));
  if (
    tokens.length &&
    tokens.every((token) => /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(token))
  ) {
    return makeGame(
      DEFAULT_POSITION,
      tokens.map((token) => ({
        from: token.slice(0, 2).toLowerCase(),
        to: token.slice(2, 4).toLowerCase(),
        ...(token[4] ? { promotion: token[4].toLowerCase() } : {}),
      })),
      { White: "White", Black: "Black" },
    );
  }
  const games = importPgn(text);
  if (games.length !== 1) throw Error("Paste one game's moves at a time.");
  return games[0];
}
export function makeGame(start = DEFAULT_POSITION, moves = [], headers = {}) {
  const g = position(start),
    fens = [g.fen()];
  const sans = moves.map((m) => {
    const x = g.move(m);
    fens.push(g.fen());
    return x.san;
  });
  return {
    id: crypto.randomUUID(),
    start,
    moves: sans,
    fens,
    headers,
    title: `${headers.White || "You"} vs ${headers.Black || "Practice"}`,
    created: Date.now(),
  };
}
export function exportPgn(game) {
  // Preserve the exact imported game tree (comments and RAVs) when untouched.
  if (game.tree) return treePgn(game);
  const g = position(game.start);
  Object.entries(game.headers || {}).forEach(([k, v]) =>
    g.setHeader(k, String(v)),
  );
  game.moves.forEach((m) => g.move(m));
  return g.pgn();
}
function treePgn(game) {
  const tags = Object.entries(game.headers)
    .map(([k, v]) => `[${k} "${String(v).replaceAll('"', '\\"')}"]`)
    .join("\n");
  function line(nodes) {
    return nodes
      .map(
        (n) =>
          `${n.moveNumber ? n.moveNumber + (n.turn === "b" ? "..." : ".") : ""} ${n.notation.notation}${(n.nag || []).map((x) => " " + x).join("")}${n.commentAfter ? " {" + n.commentAfter + "}" : ""}${(n.variations || []).map((v) => " (" + line(v) + ")").join("")}`,
      )
      .join(" ");
  }
  return (
    tags + "\n\n" + line(game.tree.moves) + " " + (game.headers.Result || "*")
  );
}
export const qualityColors = {
  Best: "#97bd56",
  Excellent: "#96b953",
  Good: "#95b58b",
  Inaccuracy: "#edc451",
  Mistake: "#e99d38",
  Blunder: "#e65353",
};
export function classify(loss) {
  return loss < 12
    ? "Best"
    : loss < 35
      ? "Excellent"
      : loss < 80
        ? "Good"
        : loss < 150
          ? "Inaccuracy"
          : loss < 300
            ? "Mistake"
            : "Blunder";
}
export function moveQuality(before, after, turn) {
  const loss = Math.max(0, (before - after) * (turn === "w" ? 1 : -1));
  return {
    loss,
    label: classify(loss),
    accuracy: Math.round(100 * Math.exp(-loss / 200)),
  };
}
export function resultText(g) {
  return g.isCheckmate()
    ? `${g.turn() === "w" ? "Black" : "White"} wins by checkmate`
    : g.isStalemate()
      ? "Draw by stalemate"
      : g.isThreefoldRepetition()
        ? "Draw by repetition"
        : g.isInsufficientMaterial()
          ? "Draw · insufficient material"
          : g.isDraw()
            ? "Draw · fifty-move rule"
            : null;
}
export function timeoutResult(g, loser) {
  const winner = loser === "w" ? "b" : "w",
    ps = g.board().flat().filter(Boolean),
    own = ps.filter((p) => p.color === winner && p.type !== "k"),
    other = ps.filter((p) => p.color === loser && p.type !== "k");
  const noMate =
    g.isInsufficientMaterial() ||
    own.length === 0 ||
    (own.length === 1 &&
      ["b", "n"].includes(own[0].type) &&
      other.length === 0);
  return noMate
    ? "Draw on time · insufficient mating material"
    : `${winner === "w" ? "White" : "Black"} wins on time`;
}
export function formatClock(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function sanLine(fen, pv) {
  const g = new Chess(fen),
    out = [];
  for (const uci of pv || []) {
    try {
      out.push(
        g.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci[4],
        }).san,
      );
    } catch {
      break;
    }
  }
  return out;
}
export function cpText(cp, mate) {
  return mate != null
    ? `M${mate}`
    : `${cp >= 0 ? "+" : ""}${(cp / 100).toFixed(2)}`;
}
export function tacticalFacts(fen, uci) {
  const g = position(fen),
    from = uci.slice(0, 2),
    to = uci.slice(2, 4),
    m = g.move({ from, to, promotion: uci[4] }),
    facts = [],
    names = {
      p: "pawn",
      n: "knight",
      b: "bishop",
      r: "rook",
      q: "queen",
      k: "king",
    };
  // Hypothetical captures by the moved piece must preserve its own king's safety.
  const fields = g.fen().split(" ");
  fields[1] = m.color;
  fields[3] = "-";
  const nextTurn = new Chess(fields.join(" "));
  const captures = new Set(
    nextTurn
      .moves({ square: to, verbose: true })
      .filter((x) => x.captured && x.captured !== "p" && x.captured !== "k")
      .map((x) => x.to),
  );
  const targets = g
    .board()
    .flat()
    .filter(
      (p) =>
        p &&
        p.color !== m.color &&
        p.type !== "p" &&
        g.attackers(p.square, m.color).includes(to) &&
        (p.type === "k" || captures.has(p.square)),
    );
  if (targets.length >= 2)
    facts.push(
      `The ${names[m.piece]} attacks ${targets.map((p) => `the ${names[p.type]} on ${p.square}`).join(" and ")} at once: a fork. This does not by itself guarantee a material win.`,
    );
  if (["b", "r", "q"].includes(m.piece)) {
    const dirs =
      m.piece === "b"
        ? [
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ]
        : m.piece === "r"
          ? [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]
          : [
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ];
    for (const [dx, dy] of dirs) {
      let x = to.charCodeAt(0) - 97,
        y = Number(to[1]) - 1,
        first = null;
      while (true) {
        x += dx;
        y += dy;
        if (x < 0 || x > 7 || y < 0 || y > 7) break;
        const sq = String.fromCharCode(97 + x) + (y + 1),
          p = g.get(sq);
        if (!p) continue;
        if (p.color === m.color) break;
        if (!first) {
          if (p.type === "k") break;
          first = { ...p, square: sq };
        } else {
          if (p.type === "k")
            facts.push(
              `The ${names[first.type]} on ${first.square} is pinned to its king on ${sq}; moving it off that line would expose check.`,
            );
          break;
        }
      }
    }
  }
  if (
    m.captured &&
    !g
      .moves({ verbose: true })
      .some((reply) => reply.to === to && reply.captured)
  )
    facts.push(`There is no legal immediate recapture of the piece on ${to}.`);
  return facts;
}
export function coachText(
  fen,
  analysis,
  focus = "fundamentals",
  question = "idea",
  detail = "balanced",
) {
  const g = position(fen),
    line = analysis?.lines?.[0];
  if (!line)
    return (
      resultText(g) ||
      "Analyse this position first so I can give you a grounded suggestion."
    );
  const u = line.pv[0],
    move = g
      .moves({ verbose: true })
      .find((m) => m.from + m.to + (m.promotion || "") === u);
  if (!move) return "This position has no legal continuation.";
  const names = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  };
  const capture = move.captured
    ? `This captures a ${names[move.captured]}.`
    : "";
  const check = move.san.includes("+")
    ? "It gives check, so your opponent must answer the check."
    : move.san.includes("#")
      ? "This is checkmate."
      : "";
  const center = ["d4", "d5", "e4", "e5"].includes(move.to)
    ? "The destination is a central square."
    : "";
  const developed =
    ["n", "b"].includes(move.piece) && ["1", "8"].includes(move.from[1])
      ? "It brings a minor piece off its starting rank."
      : "";
  const castle =
    move.isKingsideCastle() || move.isQueensideCastle()
      ? "Castling moves your king toward the edge and brings your rook into play."
      : "";
  if (question === "why") {
    const reason = move.san.includes("#")
      ? "is checkmate"
      : move.captured
        ? `captures a ${names[move.captured]}${move.san.includes("+") ? " and gives check" : ""}`
        : move.san.includes("+")
          ? "gives check"
          : castle
            ? "brings your rook into play and moves your king to the side"
            : developed
              ? `develops your ${names[move.piece]}`
              : center
                ? `moves your ${names[move.piece]} into the centre`
                : "is the engine’s preferred move";
    return (
      `${move.san} ${reason}.` +
      (detail === "detailed" && !move.san.includes("#")
        ? ` Line: ${sanLine(fen, line.pv).slice(0, 3).join(" ")}.`
        : "")
    );
  }
  if (question === "hint1")
    return focus === "tactics"
      ? `Look for forcing moves: checks and captures. ${check || capture ? "There is a forcing candidate here." : "Compare the legal replies before committing."}`
      : focus === "planning"
        ? `Compare piece activity and the centre. ${center || developed || castle || "Look for a useful square for your least active piece."}`
        : `Check king safety, then look at your legal ${move.piece === "p" ? "pawn moves" : "piece moves"}.`;
  if (question === "hint2")
    return `Look at your ${names[move.piece]} on ${move.from}. ${capture || check || center || developed || "Compare its available squares."}`;
  if (question === "threat") {
    const exposed = g
      .board()
      .flat()
      .filter(
        (p) =>
          p &&
          p.color === g.turn() &&
          p.type !== "k" &&
          g.isAttacked(p.square, g.turn() === "w" ? "b" : "w"),
      );
    return exposed.length
      ? `Your ${exposed.map((p) => names[p.type] + " on " + p.square).join(", ")} ${exposed.length === 1 ? "is" : "are"} attacked. An attack is not necessarily a winning capture; check defenders and the legal continuation.`
      : "None of your non-king pieces is currently attacked. Check your king safety and your opponent’s forcing replies next.";
  }
  const tactical =
    focus === "tactics" || detail === "detailed"
      ? tacticalFacts(fen, u).join(" ")
      : "";
  const main =
    `${move.san} is Stockfish’s preferred move at depth ${line.depth}. ${capture} ${check} ${focus === "planning" ? center + " " + developed : developed + " " + center} ${castle}`
      .replace(/ +/g, " ")
      .trim() + (tactical ? " " + tactical : "");
  return (
    main +
    (detail === "detailed" || question === "why"
      ? ` A legal engine line is ${sanLine(fen, line.pv).slice(0, 6).join(" ")}. The evaluation is ${cpText(line.cp, line.mate)} from White’s perspective; this is an estimate, not a guarantee.`
      : "")
  );
}
