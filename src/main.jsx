import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ScanLine,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeftRight,
  Plus,
  Download,
  Upload,
  Settings,
  Lightbulb,
  Flag,
  Undo2,
  Play,
  Pause,
  X,
  Check,
  Search,
  Leaf,
  Save,
  RotateCcw,
  Trash2,
  Camera,
  ArrowRight,
  Volume2,
  MoreHorizontal,
  Compass,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
} from "lucide-react";
import {
  Swords,
  GraduationCap,
  ChartNoAxesCombined,
  Library,
  BookOpen,
  Star,
} from "./Icons.jsx";
import Board, { Piece } from "./Board.jsx";
import OpeningExplorer from "./OpeningExplorer.jsx";
import { loadOpeningDatabase } from "./openings.js";
import {
  Chess,
  DEFAULT_POSITION,
  makeGame,
  importPgn,
  importMoveText,
  exportPgn,
  cpText,
  sanLine,
  qualityColors,
  moveQuality,
  coachText,
  resultText,
  validatePosition,
  position,
  timeoutResult,
  formatClock,
} from "../shared/chess.js";
import { bots, coaches, samplePgn, opening } from "./data.js";
import "./style.css";
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn("Local storage is full. Export important games.");
  }
};
async function api(path, body, signal) {
  const r = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed.");
  return data;
}
async function gifApi(body, signal, progress) {
  const r = await fetch("/api/gif", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) {
    const error = await r.json();
    throw Error(error.error);
  }
  const reader = r.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    result;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.error) throw Error(event.error);
      if (event.progress) progress(event.progress, event.total);
      if (event.result) result = event.result;
    }
  }
  if (!result) throw Error("GIF processing ended before completion.");
  return result;
}
export function Avatar({ item, size = 48 }) {
  const c = item?.color || "#a7b98c",
    human = item?.kind === "coach";
  return (
    <svg
      className="avatar"
      width={size}
      height={size}
      viewBox="0 0 80 80"
      role="img"
      aria-label={item?.name || "Player"}
    >
      <rect width="80" height="80" rx="18" fill={c} />
      {human ? (
        <>
          <path d="M12 80q3-29 28-29t28 29" fill="#46594d" />
          <path d="M20 31q-3-23 20-23t20 28v17H20" fill="#594336" />
          <ellipse cx="40" cy="35" rx="17" ry="21" fill="#f1d1ac" />
          <path d="M20 28q9-26 36-9L26 33" fill="#594336" />
          <path
            d="M33 45q7 6 14 0"
            fill="none"
            stroke="#976b50"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <path
            d={
              item?.kind === "fox"
                ? "M14 37L13 10 35 25 47 25 67 10 65 40"
                : "M15 35Q2 7 25 16L40 25 55 16Q78 7 65 35"
            }
            fill="#4a5145"
          />
          <ellipse cx="40" cy="45" rx="27" ry="25" fill="#f5eedc" />
          <path d="M22 47L40 61 58 47" fill={c} />
        </>
      )}
      <circle cx="31" cy="36" r="2.5" fill="#373c33" />
      <circle cx="49" cy="36" r="2.5" fill="#373c33" />
      {!human && <path d="M36 48L40 53 44 48Z" fill="#373c33" />}
    </svg>
  );
}
const navs = [
  ["play", "Play with Bots", Swords],
  ["coach", "Play With Coach", GraduationCap],
  ["screenshot", "Analyse Screenshot", ScanLine],
  ["review", "Review Game", ChartNoAxesCombined],
  ["openings", "Openings", BookOpen],
];
function Button({ icon: Icon, children, ...props }) {
  return (
    <button {...props}>
      {Icon && <Icon size={18} />} {children}
    </button>
  );
}
function App() {
  const [section, setSection] = useState("review"),
    [tab, setTab] = useState("analysis"),
    [game, setGame] = useState(() =>
      read("grove-current", importPgn(samplePgn)[0]),
    ),
    [idx, setIdx] = useState(0),
    [branch, setBranch] = useState(null),
    [flipped, setFlipped] = useState(() => read("grove-flipped", false)),
    [selectedBot, setSelectedBot] = useState(bots[0]),
    [playerColor, setPlayerColor] = useState("w"),
    [clockPreset, setClockPreset] = useState(0),
    [setup, setSetup] = useState(false),
    [botSession, setBotSession] = useState(() => read("grove-bot", null)),
    [library, setLibrary] = useState(() => read("grove-library", [])),
    [modal, setModal] = useState(null),
    [resultOpen, setResultOpen] = useState(false),
    [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
      read("grove-sidebar-collapsed", false),
    ),
    [theme, setTheme] = useState(() =>
      read("grove-theme", "dark") === "light" ? "light" : "dark",
    ),
    [openingEntries, setOpeningEntries] = useState(null),
    [openingError, setOpeningError] = useState(""),
    [analysis, setAnalysis] = useState(null),
    [engine, setEngine] = useState(null),
    [analysisOn, setAnalysisOn] = useState(() => read("grove-analysis", true)),
    [busy, setBusy] = useState(""),
    [thinking, setThinking] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [auto, setAuto] = useState(false),
    [speed, setSpeed] = useState(() => read("grove-speed", 1000)),
    [showArrow, setShowArrow] = useState(false),
    [hint, setHint] = useState(0),
    [question, setQuestion] = useState(null),
    [feedback, setFeedback] = useState(null),
    [coach, setCoach] = useState(() => read("grove-coach", coaches[0])),
    [coachOn, setCoachOn] = useState(false),
    [coachEnabled, setCoachEnabled] = useState(() =>
      read("grove-commentary", true),
    ),
    [detail, setDetail] = useState(() => read("grove-detail", "balanced")),
    [level, setLevel] = useState(() => read("grove-level", "beginner")),
    [warning, setWarning] = useState(() => read("grove-warning", false)),
    [clocks, setClocks] = useState({ w: 0, b: 0 }),
    [boot, setBoot] = useState(false);
  const gen = useRef(0),
    reviewAbort = useRef(null),
    botAbort = useRef(null),
    analysisAbort = useRef(null),
    botRef = useRef(null),
    workspaces = useRef({}),
    archivedGames = useRef(new Set());
  botRef.current = botSession;
  const currentFen = branch?.fens.at(-1) || game.fens[idx] || game.start;
  const g = branch
      ? position(branch.start, branch.moves)
      : position(game.start, game.moves.slice(0, idx)),
    isPlay = ["play", "coach"].includes(section) && !setup && !!botSession,
    atEnd = idx === game.moves.length && !branch;
  const full = () => makeGame(game.start, game.moves, game.headers);
  const notify = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 3500);
  };
  function invalidate() {
    gen.current++;
    botAbort.current?.abort();
    analysisAbort.current?.abort();
    reviewAbort.current?.abort();
    setBusy("");
    setThinking(false);
    setAnalysis(null);
    setAuto(false);
    setBranch(null);
    setHint(0);
    setQuestion(null);
    setFeedback(null);
    setShowArrow(false);
  }
  function load(next, nextSection = "review", index = 0) {
    rememberWorkspace();
    invalidate();
    setGame(next);
    setIdx(index);
    setSection(nextSection);
    setSetup(false);
    setTab("analysis");
    setBotSession(null);
    setError("");
  }
  function save() {
    const saved = {
      ...game,
      bot: botSession
        ? { ...botSession, ended: end || botSession.ended }
        : game.bot,
      clocks,
    };
    setLibrary((xs) => {
      const out = [saved, ...xs.filter((x) => x.id !== saved.id)];
      write("grove-library", out);
      return out;
    });
    notify("Game saved to your library");
  }
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setEngine)
      .catch(() =>
        setError("The backend is unavailable. Start the server and retry."),
      );
  }, []);
  useEffect(() => {
    write("grove-current", game.completed ? makeGame() : game);
  }, [game]);
  useEffect(() => {
    write(
      "grove-bot",
      botSession && !botSession.ended && !game.completed
        ? { ...botSession, clocks, savedAt: Date.now() }
        : null,
    );
  }, [botSession, clocks, game.completed]);
  useEffect(() => {
    write("grove-sidebar-collapsed", sidebarCollapsed);
  }, [sidebarCollapsed]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#302E2B" : "#f5f3ed");
    write("grove-theme", theme);
  }, [theme]);
  function fetchOpenings() {
    setOpeningError("");
    loadOpeningDatabase()
      .then(setOpeningEntries)
      .catch((error) => setOpeningError(error.message));
  }
  useEffect(() => {
    fetchOpenings();
  }, []);
  useEffect(() => {
    write("grove-coach", coach);
    write("grove-detail", detail);
  }, [coach, detail]);
  useEffect(() => {
    write("grove-commentary", coachEnabled);
    write("grove-level", level);
    write("grove-warning", warning);
    write("grove-flipped", flipped);
    write("grove-speed", speed);
    write("grove-analysis", analysisOn);
  }, [level, warning, flipped, speed, analysisOn, coachEnabled]);
  useEffect(() => {
    setBotSession((s) => (s ? { ...s, coach: coachOn } : s));
  }, [coachOn]);
  useEffect(() => {
    if (!boot) {
      setBoot(true);
      if (botSession) {
        setSection(botSession.workspace === "coach" ? "coach" : "play");
        setTab(botSession.workspace === "coach" ? "coach" : "analysis");
        setIdx(game.moves.length);
        setPlayerColor(botSession.color);
        setClockPreset(botSession.preset);
        setSelectedBot(bots.find((b) => b.id === botSession.botId) || bots[0]);
        setClocks(botSession.clocks || { w: 0, b: 0 });
        setCoachOn(!!botSession.coach);
        setFlipped(botSession.color === "b");
      }
    }
  }, []);
  useEffect(() => {
    if (!toast) return;
  }, [toast]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(
      () =>
        setIdx((i) => {
          if (i >= game.moves.length) {
            setAuto(false);
            return i;
          }
          return i + 1;
        }),
      speed,
    );
    return () => clearInterval(t);
  }, [auto, speed, game]);
  useEffect(() => {
    const handler = (e) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement.tagName,
        ) ||
        modal
      )
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
        setBranch(null);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIdx((i) => Math.min(game.moves.length, i + 1));
        setBranch(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [game, modal]);
  useEffect(() => {
    setShowArrow(false);
  }, [currentFen, idx, game.id]);
  useEffect(() => {
    setHint(0);
    setQuestion(null);
    setAnalysis(null);
    if (!analysisOn && !coachOn) return;
    if (busy === "review") return;
    const c = new AbortController();
    analysisAbort.current?.abort();
    analysisAbort.current = c;
    const t = setTimeout(
      () =>
        api(
          "analyse",
          {
            fen: branch ? currentFen : game.start,
            moves: branch ? [] : game.moves.slice(0, idx),
          },
          c.signal,
        )
          .then((r) => {
            if (!c.signal.aborted) {
              setAnalysis(r);
              setGame((x) => ({
                ...x,
                lastAnalysis: { fen: currentFen, result: r },
              }));
            }
          })
          .catch((e) => {
            if (e.name !== "AbortError") setError(e.message);
          }),
      220,
    );
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [currentFen, idx, analysisOn, coachOn, busy, game.id]);
  useEffect(() => {
    if (
      !isPlay ||
      !atEnd ||
      botSession.ended ||
      g.isGameOver() ||
      g.turn() === botSession.color
    )
      return;
    const token = gen.current,
      c = new AbortController();
    botAbort.current = c;
    setThinking(true);
    api(
      "bot",
      { fen: game.start, moves: game.moves, elo: selectedBot.elo },
      c.signal,
    )
      .then((r) => {
        if (c.signal.aborted || token !== gen.current || botRef.current?.ended)
          return;
        const next = makeGame(
          game.start,
          [...game.moves, r.move],
          game.headers,
        );
        next.id = game.id;
        setGame(next);
        setIdx(next.moves.length);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setThinking(false);
      });
    return () => c.abort();
  }, [
    game.id,
    game.moves.length,
    isPlay,
    atEnd,
    botSession?.ended,
    botSession?.color,
    selectedBot.elo,
  ]);
  useEffect(() => {
    if (!isPlay || botSession.ended || g.isGameOver() || !botSession.preset)
      return;
    const live = position(game.start, game.moves),
      color = live.turn(),
      start = Date.now(),
      initial = clocks[color];
    const t = setInterval(() => {
      const remaining = Math.max(0, initial - (Date.now() - start));
      setClocks((c) => ({ ...c, [color]: remaining }));
      if (remaining === 0) {
        gen.current++;
        botAbort.current?.abort();
        setThinking(false);
        setBotSession((s) => ({
          ...s,
          ended: timeoutResult(live, color),
        }));
      }
    }, 100);
    return () => clearInterval(t);
  }, [isPlay, game.moves.length, botSession?.ended]);
  async function move(m, force = false) {
    if (
      isPlay &&
      (!atEnd ||
        g.turn() !== botSession.color ||
        thinking ||
        botSession.ended ||
        busy)
    )
      return;
    try {
      const test = new Chess(currentFen);
      const played = test.move(m);
      const token = gen.current;
      if (warning && coachOn && isPlay && !force && analysis) {
        setBusy("Checking your move");
        const r = await api("analyse", { fen: test.fen(), depth: 10 });
        if (token !== gen.current) return;
        setBusy("");
        if (moveQuality(analysis.cp, r.cp, g.turn()).loss >= 300) {
          setModal({ type: "warning", m });
          return;
        }
      }
      if (isPlay) {
        const next = makeGame(
          game.start,
          [...game.moves, played.san],
          game.headers,
        );
        next.id = game.id;
        setGame(next);
        setIdx(next.moves.length);
        if (coachOn && detail !== "minimal") {
          const beforeFen = currentFen;
          Promise.all([
            api("analyse", { fen: beforeFen, depth: 9 }),
            api("analyse", { fen: test.fen(), depth: 9 }),
          ])
            .then(([a, b]) => {
              if (token !== gen.current) return;
              const q = moveQuality(a.cp, b.cp, played.color);
              const fact = played.san.includes("#")
                ? " That is checkmate."
                : played.san.includes("+")
                  ? " Your move gives check."
                  : played.captured
                    ? " Your move captures a piece."
                    : ["d4", "d5", "e4", "e5"].includes(played.to)
                      ? " Your piece occupies a central square."
                      : "";
              setFeedback(
                `${played.san}: ${q.label.toLowerCase()} at depth 9.${fact}${q.loss >= 150 ? " The engine sees a loss of about " + (q.loss / 100).toFixed(1) + " pawns. Use Why to compare the continuation, or take back and try again." : ""}`,
              );
            })
            .catch(() => {});
        }
      } else {
        setAuto(false);
        setBranch((b) =>
          b
            ? makeGame(b.start, [...b.moves, played.san])
            : makeGame(currentFen, [played.san]),
        );
        setShowArrow(false);
      }
    } catch (e) {
      setError(e.message);
      setBusy("");
    }
  }
  function startBot() {
    const withCoach = section === "coach";
    invalidate();
    const color =
      playerColor === "random"
        ? Math.random() < 0.5
          ? "w"
          : "b"
        : playerColor;
    const next = makeGame(DEFAULT_POSITION, [], {
      White: color === "w" ? "You" : selectedBot.name,
      Black: color === "b" ? "You" : selectedBot.name,
      Result: "*",
    });
    setGame(next);
    setIdx(0);
    setBotSession({
      botId: selectedBot.id,
      color,
      preset: clockPreset,
      coach: withCoach && coachEnabled,
      workspace: withCoach ? "coach" : "play",
      ended: null,
    });
    setClocks({ w: clockPreset * 60000, b: clockPreset * 60000 });
    setFlipped(color === "b");
    setSection(withCoach ? "coach" : "play");
    setTab(withCoach ? "coach" : "analysis");
    setSetup(false);
    setAnalysisOn(withCoach);
    setCoachOn(withCoach && coachEnabled);
    setError("");
  }
  function takeback() {
    invalidate();
    const n = game.moves.length - (g.turn() === botSession.color ? 2 : 1);
    const next = makeGame(
      game.start,
      game.moves.slice(0, Math.max(0, n)),
      game.headers,
    );
    next.id = game.id;
    setGame(next);
    setIdx(next.moves.length);
    setBotSession((s) => ({ ...s, ended: null }));
  }
  async function review() {
    invalidate();
    const c = new AbortController();
    reviewAbort.current = c;
    const token = gen.current;
    setBusy("review");
    setTab("review");
    setError("");
    const evaluations = [],
      qualities = [];
    try {
      for (let i = 0; i <= game.moves.length; i++) {
        if (c.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        setToast(`Reviewing position ${i + 1} of ${game.moves.length + 1}`);
        const r = await api(
          "analyse",
          { fen: game.start, moves: game.moves.slice(0, i), depth: 9 },
          c.signal,
        );
        evaluations.push(r);
        if (i)
          qualities.push(
            moveQuality(
              evaluations[i - 1].cp,
              r.cp,
              new Chess(game.fens[i - 1]).turn(),
            ),
          );
      }
      if (token === gen.current) {
        setGame((x) => ({
          ...x,
          review: {
            evaluations,
            qualities,
            settings: "depth 9 · 3 candidates · 1 thread · 32 MB",
          },
        }));
        setIdx(0);
        notify("Game review complete");
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      if (token === gen.current) {
        setBusy("");
        setToast("");
      }
    }
  }
  function download() {
    const blob = new Blob([exportPgn(game)], {
        type: "application/x-chess-pgn",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "chessgrove-game.pgn";
    a.click();
    URL.revokeObjectURL(url);
  }
  const last = (() => {
    if (branch) {
      const z = new Chess(branch.start);
      let m;
      branch.moves.forEach((v) => (m = z.move(v)));
      return m;
    }
    if (!idx) return null;
    const z = new Chess(game.fens[idx - 1]);
    return z.move(game.moves[idx - 1]);
  })();
  const end = isPlay
    ? botSession.ended || resultText(position(game.start, game.moves))
    : null;
  useEffect(() => {
    setResultOpen(!!end);
  }, [end, game.id]);
  useEffect(() => {
    if (!end || archivedGames.current.has(game.id)) return;
    archivedGames.current.add(game.id);
    const result = end.startsWith("White")
      ? "1-0"
      : end.startsWith("Black")
        ? "0-1"
        : "1/2-1/2";
    const saved = {
      ...game,
      completed: true,
      ended: end,
      headers: { ...game.headers, Result: result },
      bot: { ...botSession, ended: end },
      clocks,
    };
    setGame(saved);
    setLibrary((items) => {
      const next = [saved, ...items.filter((item) => item.id !== saved.id)];
      write("grove-library", next);
      return next;
    });
  }, [end, game.id]);
  function openBotReview() {
    const result = end?.startsWith("White")
      ? "1-0"
      : end?.startsWith("Black")
        ? "0-1"
        : "1/2-1/2";
    delete workspaces.current[section];
    setGame((x) => ({
      ...x,
      completed: true,
      headers: { ...x.headers, Result: result },
    }));
    invalidate();
    setResultOpen(false);
    setSection("review");
    setBotSession(null);
    setAnalysisOn(true);
    setTab("review");
  }
  const coachMessage =
    !question && !hint && feedback
      ? feedback
      : question === "custom"
        ? null
        : coachText(
            currentFen,
            analysis,
            coach.id,
            question || (hint ? "hint" + hint : "hint1"),
            detail === "minimal"
              ? "minimal"
              : level === "advanced"
                ? "detailed"
                : detail,
          );
  function rememberWorkspace() {
    if (["library", "screenshot", "openings"].includes(section)) return;
    if (game.completed || end) {
      delete workspaces.current[section];
      return;
    }
    workspaces.current[section] = {
      game,
      idx,
      botSession,
      clocks,
      flipped,
      analysisOn,
      coachOn,
      tab,
    };
  }
  function go(s) {
    if (s === section && s !== "screenshot" && !game.completed) return;
    rememberWorkspace();
    invalidate();
    setSection(s);
    setResultOpen(false);
    if (s === "library" || s === "openings") return;
    const next = workspaces.current[s];
    const coachSession =
      s === "coach" && !next?.botSession
        ? {
            botId: bots[0].id,
            color: "w",
            preset: 0,
            coach: coachEnabled,
            workspace: "coach",
            ended: null,
          }
        : null;
    setGame(
      next?.game ||
        (coachSession
          ? makeGame(DEFAULT_POSITION, [], {
              White: "You",
              Black: bots[0].name,
              Result: "*",
            })
          : makeGame()),
    );
    setIdx(next?.idx || 0);
    const session = next?.botSession || coachSession;
    setBotSession(session);
    if (session) {
      setPlayerColor(session.color);
      setClockPreset(session.preset);
      setSelectedBot(bots.find((b) => b.id === session.botId) || bots[0]);
    }
    setClocks(next?.clocks || { w: 0, b: 0 });
    setFlipped(next?.flipped || false);
    setAnalysisOn(next?.analysisOn ?? true);
    setCoachOn(s === "coach" && coachEnabled);
    setTab(next?.tab === "review" && s === "review" ? "review" : "analysis");
    if (s === "play") setSetup(!next?.botSession);
    else if (s === "coach") {
      setSetup(false);
      setTab("coach");
    } else if (s === "screenshot") setModal({ type: "image" });
  }
  const rows = [];
  for (let i = 0; i < game.moves.length; ) {
    const fields = game.fens[i].split(" "),
      number = Number(fields[5]);
    if (fields[1] === "b") {
      rows.push([i - 1, null, game.moves[i], number]);
      i++;
    } else {
      rows.push([i, game.moves[i], game.moves[i + 1], number]);
      i += 2;
    }
  }
  return (
    <div
      className={
        "app-shell " +
        (isPlay && section === "play" ? "playing " : "") +
        (sidebarCollapsed ? "sidebar-collapsed" : "")
      }
    >
      <aside className="sidebar">
        <button
          className="sidebar-toggle"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Minimise sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Minimise sidebar"}
          aria-expanded={!sidebarCollapsed}
          onClick={() => setSidebarCollapsed((value) => !value)}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={19} />
          ) : (
            <PanelLeftClose size={19} />
          )}
        </button>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("review");
          }}
        >
          <Leaf size={32} />
          <span>
            chess<span>grove</span>
            <i>•</i>
          </span>
        </a>
        <div className="side-caption">YOUR NEXT GOOD MOVE</div>
        <nav>
          {navs.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              aria-current={section === id ? "page" : undefined}
              className={section === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon size={21} />
              <span className="nav-label">{label}</span>
              <span className="nav-mobile-label">
                {
                  {
                    play: "Play",
                    coach: "Learn",
                    screenshot: "Import",
                    review: "Review",
                    openings: "Openings",
                  }[id]
                }
              </span>
              {section === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="side-divider" />
        <button
          aria-label="My library"
          className={"library-link " + (section === "library" ? "active" : "")}
          onClick={() => go("library")}
        >
          <Library size={21} /> My library{" "}
          <span className="count">{library.length}</span>
        </button>
        <div className="sidebar-bottom">
          <Button
            icon={theme === "dark" ? Sun : Moon}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <button onClick={() => setModal({ type: "settings" })}>
            <Settings size={19} /> Settings & about
          </button>
          <div className="profile">
            <div className="profile-icon">Y</div>
            <div>
              <strong>Your workspace</strong>
              <small>Saved locally</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              Workspace <ChevronRight size={13} />
            </span>
            <strong>
              {section === "library"
                ? "My library"
                : navs.find((n) => n[0] === section)?.[1]}
            </strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              title="Settings"
              aria-label="Settings"
              onClick={() => setModal({ type: "settings" })}
            >
              <Settings size={19} />
            </button>
            <button
              className="profile-icon small"
              aria-label="Open saved games"
              onClick={() => go("library")}
            >
              Y
            </button>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={17} />
            </button>
          </div>
        )}
        {section === "openings" ? (
          <OpeningExplorer
            entries={openingEntries}
            error={openingError}
            onRetry={fetchOpenings}
            onOpen={(entry) => {
              load(
                makeGame(DEFAULT_POSITION, entry.moves, {
                  Event: entry.name,
                  ECO: entry.eco,
                  Opening: entry.name,
                  White: "White",
                  Black: "Black",
                }),
                "review",
                entry.moves.length,
              );
              setAnalysisOn(true);
            }}
          />
        ) : section === "library" ? (
          <div className="selection-page">
            <div className="eyebrow">YOUR COLLECTION</div>
            <h1>My library</h1>
            <p className="muted">
              Pick up where you left off. Your games stay on this device.
            </p>
            <div className="library-grid">
              {!library.length && (
                <div className="empty-state">
                  <Library size={40} />
                  <h3>No saved games yet</h3>
                  <p>
                    Finished games appear here automatically. You can also save
                    an imported game.
                  </p>
                  <Button
                    className="primary"
                    icon={Upload}
                    onClick={() => setModal({ type: "import" })}
                  >
                    Import a game
                  </Button>
                </div>
              )}
              {library.map((x) => (
                <article className="saved-card" key={x.id}>
                  <BookOpen size={24} />
                  <h3>{x.title}</h3>
                  <p>
                    {x.moves.length} half-moves ·{" "}
                    {new Date(x.created).toLocaleDateString()}
                  </p>
                  {x.ended && <p className="saved-result">{x.ended}</p>}
                  <div>
                    <Button
                      className="primary"
                      onClick={() => {
                        load(x);
                        notify("Saved game opened");
                      }}
                    >
                      Open review
                    </Button>
                    {x.bot && !x.bot.ended && (
                      <button
                        onClick={() => {
                          load(x, "play", x.moves.length);
                          setBotSession(x.bot);
                          setSelectedBot(
                            bots.find((b) => b.id === x.bot.botId),
                          );
                          setClocks(x.clocks);
                          setFlipped(x.bot.color === "b");
                        }}
                      >
                        Resume game
                      </button>
                    )}
                    <button
                      aria-label={"Delete " + x.title}
                      onClick={() => {
                        const list = library.filter((g) => g.id !== x.id);
                        setLibrary(list);
                        write("grove-library", list);
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : section === "play" && setup ? (
          <div className="selection-page">
            <div className="eyebrow">A FRIENDLY CHALLENGE</div>
            <h1>Choose an opponent</h1>
            <p className="muted">
              Pick a bot, choose your pieces, and play at your pace.
            </p>
            <div className="bot-grid">
              {bots.map((b) => (
                <button
                  key={b.id}
                  aria-pressed={selectedBot.id === b.id}
                  className={
                    "bot-card " + (selectedBot.id === b.id ? "chosen" : "")
                  }
                  onClick={() => setSelectedBot(b)}
                >
                  <Avatar item={b} size={88} />
                  <span className="bot-range">{b.group}</span>
                  <h3>
                    {b.name} <span>≈ {b.elo}</span>
                  </h3>
                  <p>{b.desc}</p>
                  {selectedBot.id === b.id && (
                    <Check className="chosen-check" size={20} />
                  )}
                </button>
              ))}
            </div>
            <div className="play-setup">
              <div>
                <label htmlFor="player-color">Your pieces</label>
                <select
                  id="player-color"
                  value={playerColor}
                  onChange={(e) => setPlayerColor(e.target.value)}
                >
                  <option value="w">White</option>
                  <option value="b">Black</option>
                  <option value="random">Random</option>
                </select>
              </div>
              <div>
                <label htmlFor="time-control">Time control</label>
                <select
                  id="time-control"
                  value={clockPreset}
                  onChange={(e) => setClockPreset(+e.target.value)}
                >
                  <option value={0}>Untimed · take your time</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                </select>
              </div>
              <Button
                className="primary large"
                icon={Swords}
                onClick={startBot}
              >
                Play {selectedBot.name}
              </Button>
            </div>
            <p className="fine-print">
              Bot ratings are approximate. Games are saved on this device.
            </p>
          </div>
        ) : (
          <>
            <div className="workspace-heading">
              <div>
                <div className="eyebrow">
                  {isPlay
                    ? "MAKE YOUR MOVE"
                    : section === "coach"
                      ? "UNDERSTAND THE WHY"
                      : "A FRESH PERSPECTIVE"}
                </div>
                <h1>
                  {isPlay && section !== "coach"
                    ? `You vs ${selectedBot.name}`
                    : section === "coach"
                      ? "Play With Coach"
                      : "Game analysis"}
                </h1>
                <p className="muted">
                  {isPlay
                    ? "Take a breath, find a plan, and enjoy the game."
                    : section === "coach"
                      ? "A thoughtful coach, right by your side."
                      : "Find the turning points. Understand your next move."}
                </p>
              </div>
              <div className="heading-actions">
                <Button
                  icon={Upload}
                  onClick={() => setModal({ type: "import" })}
                >
                  Import game
                </Button>
                <Button
                  className="primary"
                  icon={Plus}
                  onClick={() => {
                    if (section === "coach") return startBot();
                    invalidate();
                    setBotSession(null);
                    setSection("play");
                    setSetup(true);
                  }}
                >
                  New game
                </Button>
              </div>
            </div>
            <div className="workspace">
              <section className="board-column">
                <div className="player-line">
                  <Avatar
                    item={
                      isPlay
                        ? selectedBot
                        : {
                            name: game.headers.Black || "Black",
                            kind: "fox",
                            color: "#c4a384",
                          }
                    }
                  />
                  <div>
                    <strong>
                      {isPlay
                        ? selectedBot.name
                        : game.headers.Black || "Black"}{" "}
                      {isPlay && (
                        <span className="rating">≈ {selectedBot.elo}</span>
                      )}
                    </strong>
                    <small>
                      {thinking ? (
                        <span className="thinking">
                          Thinking<span>•••</span>
                        </span>
                      ) : isPlay ? (
                        "Your opponent · " + selectedBot.group
                      ) : (
                        "Black pieces"
                      )}
                    </small>
                    {isPlay && (
                      <Captured
                        game={game}
                        idx={idx}
                        color={botSession.color === "w" ? "b" : "w"}
                      />
                    )}
                  </div>
                  {isPlay && botSession.preset > 0 && (
                    <span
                      className={"clock " + (g.turn() === "b" ? "ticking" : "")}
                    >
                      {formatClock(
                        clocks[botSession.color === "w" ? "b" : "w"],
                      )}
                    </span>
                  )}
                  <button
                    className="icon-button player-settings"
                    aria-label="Board settings"
                    onClick={() => setModal({ type: "settings" })}
                  >
                    <Settings size={18} />
                  </button>
                </div>
                <div className="board-and-eval">
                  {analysisOn && !isPlay && (
                    <div className="eval-bar" aria-label="Evaluation bar">
                      <div
                        style={{
                          height:
                            (analysis
                              ? Math.max(3, Math.min(97, 50 - analysis.cp / 35))
                              : 50) + "%",
                        }}
                      />
                      <span>
                        {analysis ? cpText(analysis.cp, analysis.mate) : "0.0"}
                      </span>
                    </div>
                  )}
                  <Board
                    fen={currentFen}
                    flipped={flipped}
                    onMove={move}
                    disabled={
                      isPlay &&
                      (!atEnd ||
                        thinking ||
                        g.turn() !== botSession.color ||
                        !!end ||
                        !!busy)
                    }
                    last={last}
                    arrow={
                      showArrow || game.source === "Screenshot"
                        ? analysis?.lines?.[0]?.pv[0]
                        : null
                    }
                  />
                </div>
                <div className="player-line bottom-player">
                  <div className="you-avatar">
                    <Piece code="wP" />
                  </div>
                  <div>
                    <strong>
                      {isPlay ? "You" : game.headers.White || "White"}
                      <span className="you-badge">
                        {isPlay ? "YOU" : "WHITE"}
                      </span>
                    </strong>
                    <small>
                      {end ||
                        (isPlay
                          ? g.turn() === botSession.color
                            ? "Your turn"
                            : "Waiting for opponent"
                          : "Ready to explore")}
                    </small>
                    {isPlay && (
                      <Captured
                        game={game}
                        idx={idx}
                        color={botSession.color}
                      />
                    )}
                  </div>
                  {isPlay && botSession.preset > 0 && (
                    <span
                      className={"clock " + (g.turn() === "w" ? "ticking" : "")}
                    >
                      {formatClock(clocks[botSession.color])}
                    </span>
                  )}
                  <button
                    className="icon-button"
                    aria-label="Flip board"
                    title="Flip board"
                    onClick={() => setFlipped((f) => !f)}
                  >
                    <ArrowLeftRight size={19} />
                  </button>
                </div>
                <div className="under-board">
                  <span>
                    <span className="online-dot" />{" "}
                    {g.isCheck()
                      ? "King in check"
                      : isPlay
                        ? end
                          ? "Game complete"
                          : `Practice game · ${idx} of ${game.moves.length}`
                        : branch
                          ? "Exploring an alternative"
                          : `${idx} of ${game.moves.length} moves`}
                  </span>
                  <button
                    className="opening-link"
                    title="Explore openings"
                    onClick={() => go("openings")}
                  >
                    {opening(game.moves.slice(0, idx), game.start)}
                  </button>
                </div>
                {branch && (
                  <div className="branch-banner">
                    <div>
                      <strong>Alternative line</strong>
                      <span>{branch.moves.join(" ")}</span>
                    </div>
                    <button onClick={() => setBranch(null)}>
                      Return to game <Undo2 size={16} />
                    </button>
                  </div>
                )}
                {isPlay && (
                  <div className="play-controls">
                    {end ? (
                      <>
                        <strong>{end}</strong>
                        <Button
                          className="primary"
                          onClick={() => {
                            const result = end.startsWith("White")
                              ? "1-0"
                              : end.startsWith("Black")
                                ? "0-1"
                                : "1/2-1/2";
                            setGame((x) => ({
                              ...x,
                              headers: { ...x.headers, Result: result },
                            }));
                            invalidate();
                            setSection("review");
                            setBotSession(null);
                            setAnalysisOn(true);
                            setTab("review");
                          }}
                        >
                          Review Game
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          icon={Undo2}
                          disabled={!game.moves.length}
                          onClick={takeback}
                        >
                          Practice takeback
                        </Button>
                        <Button
                          icon={RotateCcw}
                          onClick={() => setModal({ type: "restart" })}
                        >
                          Restart
                        </Button>
                        <Button
                          icon={Flag}
                          onClick={() => setModal({ type: "resign" })}
                        >
                          Resign
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </section>
              {isPlay && section === "play" ? (
                <BotPlayPanel
                  game={game}
                  idx={idx}
                  setIdx={setIdx}
                  end={end}
                  thinking={thinking}
                  onReview={openBotReview}
                  onNew={() => {
                    invalidate();
                    setSetup(true);
                    setBotSession(null);
                  }}
                  onRematch={() =>
                    end ? startBot() : setModal({ type: "restart" })
                  }
                  onTakeback={takeback}
                  onResign={() => setModal({ type: "resign" })}
                  onSave={save}
                  onExport={download}
                  onSettings={() => setModal({ type: "settings" })}
                  onHint={() => {
                    setAnalysisOn(true);
                    setShowArrow((visible) => !visible);
                  }}
                  hintActive={showArrow}
                  onFlip={() => setFlipped((value) => !value)}
                  onOpenings={() => go("openings")}
                />
              ) : (
                <aside className="analysis-panel">
                  <div className="panel-tabs">
                    <button
                      className={tab === "analysis" ? "selected-tab" : ""}
                      onClick={() => setTab("analysis")}
                    >
                      <Search size={19} />
                      Analysis
                    </button>
                    <button
                      className={tab === "review" ? "selected-tab" : ""}
                      onClick={() => setTab("review")}
                    >
                      <Star size={18} />
                      Review
                    </button>
                    {section === "coach" && (
                      <button
                        className={tab === "coach" ? "selected-tab" : ""}
                        onClick={() => {
                          setTab("coach");
                          setCoachOn(coachEnabled);
                        }}
                      >
                        <GraduationCap size={20} />
                        Coach
                      </button>
                    )}
                  </div>
                  {tab === "coach" ? (
                    <>
                      <div className="coach-header">
                        <div className="eyebrow">IN YOUR CORNER</div>
                        <h2>Meet your coach.</h2>
                        <div className="coach-picker">
                          {coaches.map((c) => (
                            <button
                              key={c.id}
                              className={coach.id === c.id ? "chosen" : ""}
                              onClick={() => {
                                setCoach(c);
                                setHint(0);
                                setQuestion(null);
                              }}
                            >
                              <Avatar item={c} size={54} />
                              <strong>{c.name}</strong>
                              <small>{c.desc}</small>
                            </button>
                          ))}
                        </div>
                        <p className="muted">{coach.detail}</p>
                      </div>
                      {coachOn && (
                        <div className="coach-bubbles">
                          <Avatar item={coach} size={48} />
                          <div className="bubble">
                            <strong>
                              {coach.name} <span>YOUR COACH</span>
                            </strong>
                            <p>
                              {analysis
                                ? coachMessage
                                : "Let’s take a look. I’m checking the position with Stockfish…"}
                            </p>
                            {hint === 3 && (
                              <small>
                                The arrow shows the recommended move.
                              </small>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="coach-questions">
                        <Button
                          icon={Lightbulb}
                          disabled={!coachOn || !analysis}
                          onClick={() => {
                            const h = Math.min(3, hint + 1);
                            setHint(h);
                            setQuestion(h === 3 ? "idea" : "hint" + h);
                            if (h === 3) setShowArrow(true);
                          }}
                        >
                          Hint {hint ? `${hint}/3` : ""}
                        </Button>
                        <button
                          disabled={!coachOn || !analysis}
                          onClick={() => {
                            setQuestion("why");
                            setShowArrow(true);
                          }}
                        >
                          Why?
                        </button>
                        <button
                          disabled={!coachOn || !analysis}
                          onClick={() => setQuestion("threat")}
                        >
                          What is the threat?
                        </button>
                      </div>
                      <div className="coach-options">
                        <button
                          onClick={() =>
                            setModal({ type: "image", manual: true })
                          }
                        >
                          Practice a custom position
                        </button>
                        {game.review && (
                          <button
                            onClick={() => {
                              const i = game.review.qualities.findIndex(
                                (q) => q.loss >= 150,
                              );
                              if (i < 0) {
                                notify(
                                  "No major mistakes at these review settings.",
                                );
                                return;
                              }
                              setIdx(i);
                              setBranch(null);
                              setQuestion("why");
                              notify(
                                "Try another move here. The original game is preserved.",
                              );
                            }}
                          >
                            Retry a turning point
                          </button>
                        )}
                      </div>
                    </>
                  ) : tab === "review" ? (
                    <ReviewSummary
                      game={game}
                      idx={idx}
                      onJump={(i) => {
                        setIdx(i);
                        setBranch(null);
                      }}
                      busy={busy}
                      onReview={review}
                      onCancel={() => {
                        invalidate();
                        setToast("Review cancelled");
                      }}
                    />
                  ) : (
                    <>
                      <div className="engine-strip">
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={analysisOn}
                            onChange={(e) => setAnalysisOn(e.target.checked)}
                          />
                          <span
                            className={"toggle " + (analysisOn ? "on" : "")}
                          />
                          <strong>Analysis</strong>
                        </label>
                        <small>
                          {analysisOn
                            ? analysis
                              ? `depth ${analysis.depth} · ${analysis.engine?.replace("Stockfish ", "")}`
                              : "Calculating…"
                            : "Paused"}
                        </small>
                        <button
                          className="icon-button"
                          title="Advanced settings"
                          aria-label="Advanced settings"
                          onClick={() => setModal({ type: "settings" })}
                        >
                          <Settings size={17} />
                        </button>
                      </div>
                      <div className="candidate-lines">
                        {!analysisOn ? (
                          <p className="muted">
                            Turn on analysis to see engine candidates.
                          </p>
                        ) : analysis?.lines?.length ? (
                          analysis.lines.slice(0, 3).map((l, i) => (
                            <button
                              key={i}
                              title="Play this continuation as an alternative line"
                              onClick={() => {
                                const san = sanLine(
                                  currentFen,
                                  l.pv.slice(0, 6),
                                );
                                setBranch(makeGame(currentFen, san));
                                setShowArrow(false);
                              }}
                            >
                              <span
                                className={
                                  "score " + (l.cp < 0 ? "negative" : "")
                                }
                              >
                                {cpText(l.cp, l.mate)}
                              </span>
                              <span className="candidate-notation">
                                {sanLine(currentFen, l.pv)
                                  .slice(0, 7)
                                  .join(" ")}
                              </span>
                              <ChevronRight size={15} />
                            </button>
                          ))
                        ) : (
                          <p className="muted">
                            {analysis?.terminal ? (
                              "This position is terminal."
                            ) : (
                              <>
                                <span className="spinner" /> Finding the
                                strongest continuations
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  {tab === "analysis" &&
                    game.source === "Screenshot" &&
                    analysis?.lines?.length > 0 && (
                      <div className="recommendation">
                        <strong>Recommended move</strong>
                        <p>
                          {coachText(
                            currentFen,
                            analysis,
                            "fundamentals",
                            "idea",
                            "detailed",
                          )}
                        </p>
                      </div>
                    )}
                  {tab !== "coach" && (
                    <>
                      <div className="opening-strip">
                        <BookOpen size={17} />
                        <button
                          className="opening-link"
                          title="Explore openings"
                          onClick={() => go("openings")}
                        >
                          {opening(game.moves.slice(0, idx), game.start)}
                        </button>
                        <span className="subtle">
                          {game.headers.Result || "*"}
                        </span>
                      </div>
                      <div className="game-players">
                        <span>{game.headers.White || "White"}</span>
                        <small>vs</small>
                        <span>{game.headers.Black || "Black"}</span>
                        <button
                          className="icon-button"
                          title="Import a game"
                          aria-label="Import a game"
                          onClick={() => setModal({ type: "import" })}
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                      <div className="move-list" data-testid="move-list">
                        {rows.length ? (
                          rows.map(([i, w, b, number]) => (
                            <div className="move-row" key={i}>
                              <span className="move-number">{number}.</span>
                              {[w, b].map((m, k) =>
                                m ? (
                                  <button
                                    key={k}
                                    className={
                                      (idx === i + k + 1 && !branch
                                        ? "current-move "
                                        : "") +
                                      (game.review?.qualities[
                                        i + k
                                      ]?.label?.toLowerCase() || "")
                                    }
                                    onClick={() => {
                                      setIdx(i + k + 1);
                                      setBranch(null);
                                      setAuto(false);
                                    }}
                                  >
                                    <span>{m}</span>
                                    {game.review?.qualities[i + k] && (
                                      <QualityBadge
                                        label={
                                          game.review.qualities[i + k].label
                                        }
                                      />
                                    )}
                                  </button>
                                ) : (
                                  <span key={k} />
                                ),
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="empty-moves">
                            {isPlay
                              ? "Your first move is a fresh start."
                              : "The board is yours. Make a move to explore."}
                          </div>
                        )}
                      </div>
                      {idx > 0 && game.tree?.moves?.[idx - 1]?.commentAfter && (
                        <p className="pgn-comment">
                          {game.tree.moves[idx - 1].commentAfter}
                        </p>
                      )}
                      {idx > 0 &&
                        game.tree?.moves?.[idx - 1]?.variations?.length > 0 && (
                          <div className="pgn-variations">
                            <span>Imported alternatives</span>
                            {game.tree.moves[idx - 1].variations.map(
                              (nodes, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    try {
                                      setBranch(
                                        makeGame(
                                          game.fens[idx - 1],
                                          nodes.map((n) => n.notation.notation),
                                        ),
                                      );
                                    } catch (e) {
                                      setError(
                                        "This imported variation is not legal: " +
                                          e.message,
                                      );
                                    }
                                  }}
                                >
                                  {nodes
                                    .map((n) => n.notation.notation)
                                    .join(" ")}{" "}
                                  <ChevronRight size={13} />
                                </button>
                              ),
                            )}
                          </div>
                        )}
                    </>
                  )}
                  <div className="panel-footer">
                    <div className="navigation">
                      <button
                        aria-label="First move"
                        onClick={() => {
                          setIdx(0);
                          setBranch(null);
                          setAuto(false);
                        }}
                      >
                        <ChevronsLeft />
                      </button>
                      <button
                        aria-label="Previous move"
                        onClick={() => {
                          setIdx((i) => Math.max(0, i - 1));
                          setBranch(null);
                          setAuto(false);
                        }}
                      >
                        <ChevronLeft />
                      </button>
                      <button
                        aria-label={auto ? "Pause replay" : "Autoplay"}
                        onClick={() => {
                          if (idx === game.moves.length) setIdx(0);
                          setAuto((a) => !a);
                        }}
                      >
                        {auto ? <Pause size={19} /> : <Play size={19} />}
                      </button>
                      <button
                        aria-label="Next move"
                        onClick={() => {
                          setIdx((i) => Math.min(game.moves.length, i + 1));
                          setBranch(null);
                          setAuto(false);
                        }}
                      >
                        <ChevronRight />
                      </button>
                      <button
                        aria-label="Last move"
                        onClick={() => {
                          setIdx(game.moves.length);
                          setBranch(null);
                          setAuto(false);
                        }}
                      >
                        <ChevronsRight />
                      </button>
                    </div>
                    <div className="replay-speed">
                      <span>Replay speed</span>
                      <select
                        aria-label="Replay speed"
                        value={speed}
                        onChange={(e) => setSpeed(+e.target.value)}
                      >
                        <option value={2000}>0.5×</option>
                        <option value={1000}>1×</option>
                        <option value={500}>2×</option>
                      </select>
                    </div>
                    <div className="footer-actions">
                      <Button icon={Save} onClick={save}>
                        Save
                      </Button>
                      <Button icon={Download} onClick={download}>
                        Export
                      </Button>
                      <Button
                        icon={Star}
                        onClick={review}
                        disabled={!!busy || !game.moves.length}
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                </aside>
              )}
            </div>
            <div className="workspace-bottom">
              <span>Made for the love of the game.</span>
              <span>
                Local & private <span>·</span> Powered by Stockfish{" "}
                <Leaf size={13} />
              </span>
            </div>
          </>
        )}
      </main>
      {isPlay && end && resultOpen && (
        <div className="result-backdrop">
          <section
            className="game-result"
            role="dialog"
            aria-modal="true"
            aria-label="Game complete"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close result"
              onClick={() => setResultOpen(false)}
            >
              <X />
            </button>
            <div className="result-title">
              <Star size={34} />
              <h2>
                {end.startsWith(botSession.color === "w" ? "White" : "Black")
                  ? "You won!"
                  : end.startsWith("Draw")
                    ? "Game drawn"
                    : "Good game"}
              </h2>
              <p>{end}</p>
            </div>
            <div className="result-body">
              <div className="result-avatars">
                <Avatar
                  item={{ name: "You", kind: "bear", color: "#a7bc89" }}
                  size={64}
                />
                <span>
                  {game.headers.Result === "*" ? "vs" : game.headers.Result}
                </span>
                <Avatar item={selectedBot} size={64} />
              </div>
              <p>
                {game.moves.length} half-moves played. Explore the turning
                points with a Stockfish game review.
              </p>
              <Button
                className="primary full"
                icon={Star}
                onClick={openBotReview}
              >
                Game Review
              </Button>
              <div className="result-actions">
                <button
                  onClick={() => {
                    invalidate();
                    setResultOpen(false);
                    setBotSession(null);
                    setSection("play");
                    setSetup(true);
                  }}
                >
                  New Bot
                </button>
                <button
                  onClick={() => {
                    setResultOpen(false);
                    startBot();
                  }}
                >
                  Rematch
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          {busy === "review" && (
            <button
              onClick={() => {
                invalidate();
                setToast("Review cancelled");
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}
      {modal && (
        <Modal
          data={modal}
          theme={theme}
          onThemeChange={setTheme}
          level={level}
          setLevel={setLevel}
          detail={detail}
          setDetail={setDetail}
          warning={warning}
          setWarning={setWarning}
          coachEnabled={coachEnabled}
          onCommentaryChange={(enabled) => {
            setCoachEnabled(enabled);
            if (section === "coach") setCoachOn(enabled);
          }}
          onRestart={isPlay ? () => setModal({ type: "restart" }) : undefined}
          onClose={() => setModal(null)}
          onImport={(x) => {
            load(x, "review", modal.type === "image" ? x.moves.length : 0);
            if (modal.type === "image") setAnalysisOn(true);
            setModal(null);
            notify("Game imported");
          }}
          onPosition={(fen) => {
            load({ ...makeGame(fen), source: "Screenshot" }, "review");
            setModal(null);
            setAnalysisOn(true);
            setShowArrow(true);
          }}
          onError={setError}
          engine={engine}
          onSample={() => {
            load(importPgn(samplePgn)[0]);
            setModal(null);
          }}
          onConfirm={() => {
            if (modal.type === "resign") {
              invalidate();
              setBotSession((s) => ({
                ...s,
                ended: `${s.color === "w" ? "Black" : "White"} wins by resignation`,
              }));
            }
            if (modal.type === "restart") startBot();
            if (modal.type === "warning") move(modal.m, true);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
function Captured({ game, idx, color }) {
  const g = position(game.start, game.moves.slice(0, idx)),
    values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 },
    taken = g
      .history({ verbose: true })
      .filter((m) => m.color === color && m.captured)
      .map((m) => m.captured)
      .sort((a, b) => values[a] - values[b]);
  const advantage = g
    .board()
    .flat()
    .filter(Boolean)
    .reduce((sum, p) => sum + values[p.type] * (p.color === color ? 1 : -1), 0);
  return (
    <div
      className="captured-tray"
      aria-label={(color === "w" ? "White" : "Black") + " captured pieces"}
      data-piece-color={color === "w" ? "b" : "w"}
    >
      {taken.map((p, i) => (
        <span key={i}>
          <Piece code={(color === "w" ? "b" : "w") + p.toUpperCase()} />
        </span>
      ))}
      {advantage > 0 && <strong>+{advantage}</strong>}
    </div>
  );
}
function BotPlayPanel({
  game,
  idx,
  setIdx,
  end,
  thinking,
  onReview,
  onNew,
  onRematch,
  onTakeback,
  onResign,
  onSave,
  onExport,
  onSettings,
  onHint,
  hintActive,
  onFlip,
  onOpenings,
}) {
  const scroll = useRef(null);
  useEffect(() => {
    scroll.current
      ?.querySelector(".current-move")
      ?.scrollIntoView({ block: "nearest" });
  }, [idx]);
  const rows = [];
  for (let i = 0; i < game.moves.length; ) {
    const fields = game.fens[i].split(" ");
    const blackFirst = fields[1] === "b";
    rows.push({
      number: fields[5],
      white: blackFirst ? null : i,
      black: blackFirst ? i : i + 1,
    });
    i += blackFirst ? 1 : 2;
  }
  return (
    <aside className="bot-play-panel">
      <header className="bot-opening">
        <button
          className="bot-opening-name"
          title="Explore openings"
          onClick={onOpenings}
        >
          {opening(game.moves.slice(0, idx), game.start)}
        </button>
        <button aria-label="Save game" title="Save game" onClick={onSave}>
          <BookOpen size={17} />
        </button>
        <button aria-label="Flip board" title="Flip board" onClick={onFlip}>
          <Compass size={17} />
        </button>
      </header>
      <span className="sr-only" role="status">
        {end
          ? `Game complete. ${end}`
          : thinking
            ? "Opponent is thinking"
            : "Your turn"}
      </span>
      <div
        className="bot-moves move-list"
        ref={scroll}
        data-testid="move-list"
        aria-label="Move history"
      >
        {rows.map(({ number, white, black }) => (
          <div className="move-row" key={number}>
            <span className="move-number">{number}.</span>
            {[white, black].map((moveIndex, k) =>
              moveIndex !== null && game.moves[moveIndex] ? (
                <button
                  key={k}
                  className={idx === moveIndex + 1 ? "current-move" : ""}
                  aria-current={idx === moveIndex + 1 ? "step" : undefined}
                  onClick={() => setIdx(moveIndex + 1)}
                >
                  {game.moves[moveIndex]}
                </button>
              ) : (
                <span key={k} />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="bot-panel-actions">
        {end ? (
          <>
            <div className="bot-action-grid">
              <Button
                icon={Star}
                aria-label="Game Review"
                title="Game Review"
                onClick={onReview}
              />
              <Button
                icon={Plus}
                aria-label="New Bot"
                title="New Bot"
                onClick={onNew}
              />
              <Button
                icon={RotateCcw}
                aria-label="Rematch"
                title="Rematch"
                onClick={onRematch}
              />
            </div>
          </>
        ) : (
          <div className="bot-action-grid">
            <Button
              icon={Flag}
              aria-label="Resign"
              title="Resign"
              onClick={onResign}
            />
            <Button
              icon={Undo2}
              aria-label="Practice takeback"
              title="Take back"
              disabled={!game.moves.length}
              onClick={onTakeback}
            />
            <Button
              icon={Lightbulb}
              aria-label="Hint"
              title="Hint"
              aria-pressed={hintActive}
              onClick={onHint}
            />
          </div>
        )}
      </div>
      <footer>
        <button aria-label="Export PGN" title="Export PGN" onClick={onExport}>
          <Download size={18} />
        </button>
        <button aria-label="Settings" title="Settings" onClick={onSettings}>
          <Settings size={18} />
        </button>
      </footer>
    </aside>
  );
}
function QualityBadge({ label }) {
  const asset = {
    Brilliant: "brilliant",
    "Great Move": "great",
    Best: "best",
    Excellent: "excellent",
    Good: "good",
    Book: "book",
    Inaccuracy: "inaccuracy",
    Mistake: "mistake",
    Miss: "miss",
    Blunder: "blunder",
  }[label];
  const name = label === "Best" ? "Best Move" : label;
  return (
    <img
      className="quality-badge"
      src={`/brand/chesscom/${asset || "good"}.png`}
      alt={name}
      title={name}
      draggable={false}
    />
  );
}

function ReviewSummary({ game, idx, onJump, busy, onReview, onCancel }) {
  const r = game.review;
  const stats = (color) => {
    const qs =
      r?.qualities.filter((_, i) => new Chess(game.fens[i]).turn() === color) ||
      [];
    return {
      accuracy: qs.length
        ? (qs.reduce((s, q) => s + q.accuracy, 0) / qs.length).toFixed(1)
        : "—",
      counts: Object.fromEntries(
        Object.keys(qualityColors).map((k) => [
          k,
          qs.filter((q) => q.label === k).length,
        ]),
      ),
    };
  };
  const w = stats("w"),
    b = stats("b");
  return (
    <div className="review-summary">
      <div className="summary-heading">
        <div>
          <span className="eyebrow">THE BIG PICTURE</span>
          <h2>Game review</h2>
        </div>
        <Star size={23} />
      </div>
      <div className="eval-graph" aria-label="Evaluation graph">
        {r ? (
          <svg
            viewBox="0 0 400 95"
            role="img"
            aria-label="Click the graph to navigate"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onJump(
                Math.round(
                  ((e.clientX - rect.left) / rect.width) * game.moves.length,
                ),
              );
            }}
          >
            <line x1="0" x2="400" y1="47" y2="47" stroke="#ffffff25" />
            <path
              d={
                "M 0 95 " +
                r.evaluations
                  .map(
                    (e, i) =>
                      `L ${(i / Math.max(1, game.moves.length)) * 400} ${47 - Math.max(-6, Math.min(6, e.cp / 100)) * 7}`,
                  )
                  .join(" ") +
                " L 400 95 Z"
              }
              fill="#eeeed230"
            />
            <polyline
              points={r.evaluations
                .map(
                  (e, i) =>
                    `${(i / Math.max(1, game.moves.length)) * 400},${47 - Math.max(-6, Math.min(6, e.cp / 100)) * 7}`,
                )
                .join(" ")}
              fill="none"
              stroke="#c2dba4"
              strokeWidth="2"
            />
            <line
              x1={(idx / Math.max(1, game.moves.length)) * 400}
              x2={(idx / Math.max(1, game.moves.length)) * 400}
              y1="0"
              y2="95"
              stroke="#fff"
            />
            {r.qualities.map((q, i) =>
              q.loss >= 80 ? (
                <circle
                  key={i}
                  cx={((i + 1) / game.moves.length) * 400}
                  cy={
                    47 -
                    Math.max(-6, Math.min(6, r.evaluations[i + 1].cp / 100)) * 7
                  }
                  r="4"
                  fill={qualityColors[q.label]}
                />
              ) : null,
            )}
          </svg>
        ) : (
          <div className="graph-placeholder">
            <ChartNoAxesCombined size={23} />
            <span>Your game, at a glance</span>
          </div>
        )}
      </div>
      <div className="accuracy-grid">
        <span>
          Accuracy <small>Chessgrove estimate</small>
        </span>
        <div>
          <small>{game.headers.White || "White"}</small>
          <strong className="accuracy white">{w.accuracy}</strong>
        </div>
        <div>
          <small>{game.headers.Black || "Black"}</small>
          <strong className="accuracy">{b.accuracy}</strong>
        </div>
      </div>
      {r ? (
        <>
          <div className="quality-table">
            {Object.keys(qualityColors).map((k) => (
              <div key={k}>
                <span>{k === "Best" ? "Best Move" : k}</span>
                <strong style={{ color: qualityColors[k] }}>
                  {w.counts[k]}
                </strong>
                <QualityBadge label={k} />
                <strong style={{ color: qualityColors[k] }}>
                  {b.counts[k]}
                </strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="review-description">
          Analyse your moves, compare accuracy, and review key moments.
        </p>
      )}
      {busy === "review" ? (
        <Button className="primary full" onClick={onCancel}>
          Cancel review
        </Button>
      ) : (
        <Button
          className="primary full"
          icon={Star}
          disabled={!game.moves.length}
          onClick={onReview}
        >
          {r ? "Run review again" : "Start Game Review"}
        </Button>
      )}
    </div>
  );
}

function Modal({
  data,
  onClose,
  onImport,
  onPosition,
  onError,
  onSample,
  onConfirm,
  onRestart,
  theme,
  onThemeChange,
  level,
  setLevel,
  detail,
  setDetail,
  warning,
  setWarning,
  coachEnabled,
  onCommentaryChange,
  engine,
}) {
  const [text, setText] = useState(""),
    [games, setGames] = useState([]),
    [busy, setBusy] = useState(""),
    [err, setErr] = useState(""),
    [image, setImage] = useState(null),
    [result, setResult] = useState(null),
    [orientation, setOrientation] = useState("white"),
    [turn, setTurn] = useState("w"),
    [rights, setRights] = useState("-"),
    [ep, setEp] = useState("-"),
    [fen, setFen] = useState(DEFAULT_POSITION),
    [gifStart, setGifStart] = useState(DEFAULT_POSITION),
    [editor, setEditor] = useState(!!data.manual),
    [piece, setPiece] = useState("wP"),
    [crop, setCrop] = useState(null),
    [calibrate, setCalibrate] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [gifResult, setGifResult] = useState(null);
  const cancel = useRef(null),
    input = useRef(null);
  useEffect(() => () => cancel.current?.abort(), []);
  useEffect(() => {
    const paste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) =>
        i.type.startsWith("image/"),
      );
      if (item) {
        e.preventDefault();
        file(item.getAsFile());
      }
    };
    if (data.type === "image") window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, []);
  async function file(f) {
    cancel.current?.abort();
    setBusy("");
    setErr("");
    setResult(null);
    setGifResult(null);
    if (!f) return;
    if (f.size > 15000000) {
      setErr("Choose a file under 15 MB.");
      return;
    }
    if (/\.pgn$/i.test(f.name)) {
      try {
        const list = importPgn(await f.text());
        setGames(list);
        if (list.length === 1) onImport(list[0]);
      } catch (e) {
        setErr("PGN could not be parsed: " + e.message);
      }
      return;
    }
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(f.type)
    ) {
      setErr("Choose PGN, PNG, JPEG, WebP or GIF.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage({
        src: reader.result,
        name: f.name,
        gif: f.type === "image/gif",
      });
      setCrop(null);
      setEditor(false);
    };
    reader.readAsDataURL(f);
  }
  async function recognizeImage() {
    cancel.current?.abort();
    const c = new AbortController();
    cancel.current = c;
    setBusy(
      image.gif
        ? "Decoding and reconstructing every GIF frame…"
        : "Detecting board and matching pieces…",
    );
    setErr("");
    try {
      const options = {
        image: image.src,
        orientation,
        crop,
        calibrate,
        customTemplates: read("grove-templates", undefined),
        start: gifStart,
      };
      const r = image.gif
        ? await gifApi(options, c.signal, (frame, total) =>
            setBusy(`Reconstructing frame ${frame} of ${total}…`),
          )
        : await api("recognize", options, c.signal);
      if (r.templates) write("grove-templates", r.templates);
      if (image.gif) {
        setGifResult(r);
        setBusy("");
        return;
      }
      setResult(r);
      setCrop(r.crop);
      setFen(r.placement + " " + turn + " - - 0 1");
      setEditor(true);
      setConfirmed(false);
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  function edit(sq) {
    const parts = fen.split(" "),
      rows = parts[0].split("/").map((row) => {
        let a = [];
        for (const x of row) {
          if (/\d/.test(x)) a.push(...Array(+x).fill(null));
          else a.push(x);
        }
        return a;
      });
    rows[8 - Number(sq[1])][sq.charCodeAt(0) - 97] =
      piece === "erase"
        ? null
        : piece[0] === "w"
          ? piece[1]
          : piece[1].toLowerCase();
    parts[0] = rows
      .map((row) => {
        let out = "",
          n = 0;
        for (const p of row) {
          if (!p) n++;
          else {
            if (n) {
              out += n;
              n = 0;
            }
            out += p;
          }
        }
        return out + (n || "");
      })
      .join("/");
    setFen(parts.join(" "));
    setConfirmed(false);
  }
  function confirm() {
    try {
      const fields = fen.trim().split(/\s+/);
      const f =
        fields[0] +
        ` ${turn} ${rights || "-"} ${ep || "-"} ${fields[4] || 0} ${fields[5] || 1}`;
      validatePosition(f);
      if (result && !confirmed) {
        setErr("Confirm the piece placement and side to move first.");
        return;
      }
      onPosition(f);
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={"modal " + (data.type === "image" ? "image-modal" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={
          data.type === "image"
            ? "Analyse a position"
            : data.type === "import"
              ? "Import a game"
              : "Settings"
        }
      >
        <button
          className="modal-close icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
        {data.type === "settings" ? (
          <>
            <div className="eyebrow">UNDER THE HOOD</div>
            <h2>Your workspace</h2>
            <div className="appearance-setting">
              <span>Appearance</span>
              <div role="group" aria-label="Colour theme">
                <button
                  aria-pressed={theme === "dark"}
                  onClick={() => onThemeChange("dark")}
                >
                  <Moon size={16} />
                  Dark
                </button>
                <button
                  aria-pressed={theme === "light"}
                  onClick={() => onThemeChange("light")}
                >
                  <Sun size={16} />
                  Light
                </button>
              </div>
            </div>
            {onRestart && (
              <Button icon={RotateCcw} onClick={onRestart}>
                Restart
              </Button>
            )}
            <p>
              Chessgrove is an independent chess study app. Your games and
              preferences are saved in this browser. Images are processed by
              this local server; no external vision or language-model API is
              used.
            </p>
            <h3>Coach preferences</h3>
            <div className="coach-settings">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={coachEnabled}
                  onChange={(event) => onCommentaryChange(event.target.checked)}
                />
                Coach commentary
              </label>
              <select
                aria-label="Teaching level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              >
                <option value="beginner">Beginner explanations</option>
                <option value="intermediate">Intermediate explanations</option>
                <option value="advanced">Advanced explanations</option>
              </select>
              <select
                aria-label="Commentary detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              >
                <option value="minimal">Minimal commentary</option>
                <option value="balanced">Balanced commentary</option>
                <option value="detailed">Detailed commentary</option>
              </select>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={warning}
                  onChange={(e) => setWarning(e.target.checked)}
                />{" "}
                Warn before serious mistakes
              </label>

              <p>Changes are saved automatically.</p>
            </div>
            <h3>Engine</h3>
            <p>
              {engine?.name || "Not connected"} · single thread · 32 MB hash ·
              at most two concurrent jobs. Analysis: depth 10. Game review:
              depth 9. Evaluations always favour White when positive.
            </p>
            <details>
              <summary>Advertised Stockfish options</summary>
              <pre>
                {engine?.options?.join("\n") ||
                  "Restart the server to retry engine startup."}
              </pre>
            </details>
            <h3>Recognition & licensing</h3>
            <p>
              Template-based recognition works best with the included Cburnett
              pieces. For the Chess.com standard style or another theme, learn
              it from a screenshot of the complete starting position. Confirm
              every recognised position before analysis. Ambiguous GIF
              transitions remain unresolved.
            </p>
            <p>
              Stockfish.js 17.1: GPLv3. Cburnett pieces by Colin M. Burnett:
              GPLv2+. The README contains source, licence, strength-policy and
              recognition details.
            </p>
            <Button className="primary full" onClick={onClose}>
              Back to the board
            </Button>
          </>
        ) : ["resign", "restart", "warning"].includes(data.type) ? (
          <>
            <h2>
              {data.type === "resign"
                ? "Resign this game?"
                : data.type === "restart"
                  ? "Start fresh?"
                  : "A moment to reconsider"}
            </h2>
            <p>
              {data.type === "warning"
                ? "The engine sees a loss of at least three pawns after this move. Would you like to choose a different move?"
                : data.type === "restart"
                  ? "Your current match will be replaced. Save it first if you want to keep it."
                  : "You can review the full match afterwards."}
            </p>
            <div className="modal-actions">
              <button onClick={onClose}>
                {data.type === "warning"
                  ? "Choose another move"
                  : "Keep playing"}
              </button>
              <Button className="primary" onClick={onConfirm}>
                {data.type === "warning"
                  ? "Play it anyway"
                  : data.type === "resign"
                    ? "Resign"
                    : "Restart"}
              </Button>
            </div>
          </>
        ) : data.type === "import" ? (
          <>
            <div className="eyebrow">EVERY GAME HAS A STORY</div>
            <h2>Bring your game.</h2>
            <p className="muted">
              Import a PGN or reconstruct a supported animated GIF.
            </p>
            <div
              className="drop-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                file(e.dataTransfer.files[0]);
              }}
              onClick={() => input.current.click()}
            >
              <Upload size={30} />
              <strong>Drop a PGN or GIF here</strong>
              <span>or click to choose · up to 15 MB</span>
            </div>
            <input
              ref={input}
              hidden
              type="file"
              accept=".pgn,.gif"
              onChange={(e) => file(e.target.files[0])}
            />
            <button
              className="sample-button"
              onClick={async () => {
                const blob = await fetch("/fixtures/sample.gif").then((r) =>
                  r.blob(),
                );
                file(new File([blob], "sample.gif", { type: "image/gif" }));
              }}
            >
              Try the sample GIF <ArrowRight size={14} />
            </button>
            {image?.gif ? (
              <>
                <img className="source-preview" src={image.src} />
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={calibrate}
                    onChange={(e) => setCalibrate(e.target.checked)}
                  />{" "}
                  First frame is the standard starting position (learn this
                  piece style)
                </label>
                <select
                  aria-label="GIF orientation"
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value)}
                >
                  <option value="white">White at bottom</option>
                  <option value="black">Black at bottom</option>
                </select>
                <details>
                  <summary>Custom GIF start position & crop</summary>
                  <label>
                    Starting FEN
                    <input
                      aria-label="GIF starting FEN"
                      value={gifStart}
                      onChange={(e) => setGifStart(e.target.value)}
                    />
                  </label>
                  <p className="fine-print">
                    Set the exact starting position, including turn, castling
                    and en passant. Missing turns or skipped moves remain
                    unresolved.
                  </p>
                  <div className="crop-inputs">
                    {["left", "top", "size"].map((k) => (
                      <label key={k}>
                        {k}
                        <input
                          type="number"
                          aria-label={"GIF crop " + k}
                          value={crop?.[k] ?? ""}
                          onChange={(e) =>
                            setCrop((c) => ({
                              ...c,
                              [k]: Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <button onClick={() => setCrop(null)}>
                    Auto-detect board
                  </button>
                </details>
                <Button
                  className="primary full"
                  disabled={!!busy}
                  onClick={recognizeImage}
                >
                  Reconstruct GIF
                </Button>
                {gifResult && (
                  <div
                    className={gifResult.complete ? "success-box" : "error-box"}
                  >
                    <p>{gifResult.note}</p>
                    <p>
                      {gifResult.game.moves.length} legal half-moves recovered
                      from {gifResult.frames} frames.
                    </p>
                    {gifResult.issues.map((issue, i) => (
                      <div key={i}>
                        <strong>Frame {issue.frame + 1}</strong>
                        <p>{issue.message}</p>
                        {issue.preview && (
                          <img className="source-preview" src={issue.preview} />
                        )}
                      </div>
                    ))}
                    {gifResult.complete && (
                      <Button
                        className="primary"
                        onClick={() => onImport(gifResult.game)}
                      >
                        Open reconstructed game
                      </Button>
                    )}
                    {!gifResult.complete && gifResult.game.moves.length > 0 && (
                      <button
                        onClick={() =>
                          onImport({
                            ...gifResult.game,
                            title: "Partial GIF reconstruction",
                            partial: true,
                          })
                        }
                      >
                        Open confirmed portion (incomplete)
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <label>Or paste PGN</label>
                <textarea
                  aria-label="PGN text"
                  placeholder={
                    '[White "You"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6…'
                  }
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                />
                <div className="modal-actions">
                  <button onClick={onSample}>Try a sample game</button>
                  <Button
                    className="primary"
                    onClick={() => {
                      try {
                        const list = importPgn(text);
                        setGames(list);
                        if (list.length === 1) onImport(list[0]);
                      } catch (e) {
                        setErr("PGN could not be parsed: " + e.message);
                      }
                    }}
                  >
                    Import PGN <ArrowRight size={17} />
                  </Button>
                </div>
              </>
            )}
            {games.length > 1 && (
              <div className="game-picker">
                <h3>Choose a game</h3>
                {games.map((x) => (
                  <button key={x.id} onClick={() => onImport(x)}>
                    {x.title} · {x.moves.length} half-moves{" "}
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="eyebrow">FIND YOUR NEXT MOVE</div>
            <h2>Start with a position.</h2>
            <p className="muted">
              Upload a screenshot, paste moves, or set up a position.
            </p>
            <details className="paste-moves">
              <summary>Paste moves or PGN</summary>
              <label htmlFor="position-moves">Move list</label>
              <textarea
                id="position-moves"
                aria-label="Move list"
                rows={4}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="1. e4 e5 2. Nf3 Nc6"
              />
              <p>
                Use PGN, standard moves such as e4 e5 Nf3, or coordinates such
                as e2e4 e7e5 g1f3.
              </p>
              <Button
                className="primary"
                disabled={!text.trim()}
                onClick={() => {
                  try {
                    setErr("");
                    onImport(importMoveText(text));
                  } catch (error) {
                    setErr("Could not read moves: " + error.message);
                  }
                }}
              >
                Analyse moves
              </Button>
            </details>
            <div className="image-layout">
              <div>
                {image && (
                  <div className="source-image">
                    <img
                      className="source-preview"
                      src={image.src}
                      alt="Your uploaded screenshot"
                    />
                  </div>
                )}
                <div
                  className="drop-zone compact"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    file(e.dataTransfer.files[0]);
                  }}
                  onClick={() => input.current.click()}
                >
                  <Camera size={26} />
                  <strong>
                    {image
                      ? "Choose another screenshot"
                      : "Drop a screenshot here"}
                  </strong>
                  <span>PNG, JPEG, WebP · or paste from clipboard</span>
                </div>
                <button
                  className="sample-button"
                  onClick={async () => {
                    const blob = await fetch("/fixtures/sicilian.png").then(
                      (r) => r.blob(),
                    );
                    file(
                      new File([blob], "sicilian.png", { type: "image/png" }),
                    );
                    setTurn("b");
                  }}
                >
                  Try a sample screenshot <ArrowRight size={14} />
                </button>
                <input
                  ref={input}
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => file(e.target.files[0])}
                />
                <div className="input-row">
                  <label>
                    Board orientation
                    <select
                      aria-label="Image orientation"
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value)}
                    >
                      <option value="white">White at bottom</option>
                      <option value="black">Black at bottom</option>
                    </select>
                  </label>
                </div>
                {image && (
                  <>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={calibrate}
                        onChange={(e) => setCalibrate(e.target.checked)}
                      />{" "}
                      This is the complete standard starting position. Learn its
                      piece style.
                    </label>
                    <details>
                      <summary>Adjust board crop</summary>
                      <p className="fine-print">
                        Set the square board’s top-left corner and width, in
                        image pixels.
                      </p>
                      <div className="crop-inputs">
                        {["left", "top", "size"].map((k) => (
                          <label key={k}>
                            {k}
                            <input
                              type="number"
                              aria-label={"Crop " + k}
                              min="0"
                              value={crop?.[k] ?? ""}
                              onChange={(e) =>
                                setCrop((c) => ({ ...c, [k]: +e.target.value }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <button onClick={() => setCrop(null)}>
                        Auto-detect board
                      </button>
                    </details>
                    <Button
                      className="primary full"
                      icon={ScanLine}
                      disabled={!!busy}
                      onClick={recognizeImage}
                    >
                      Recognise board
                    </Button>
                  </>
                )}
                <hr />
                <label>
                  FEN
                  <input
                    aria-label="FEN"
                    value={fen}
                    onChange={(e) => {
                      setFen(e.target.value);
                      const fields = e.target.value.trim().split(/\s+/);
                      if (fields.length === 6) {
                        if (["w", "b"].includes(fields[1])) setTurn(fields[1]);
                        setRights(fields[2]);
                        setEp(fields[3]);
                      }
                      setEditor(true);
                      setResult(null);
                    }}
                  />
                </label>
                <div className="modal-actions">
                  <button
                    onClick={() => {
                      setEditor(true);
                      setFen("8/8/8/8/8/8/8/8 w - - 0 1");
                      setResult(null);
                    }}
                  >
                    Empty board
                  </button>
                  <button
                    onClick={() => {
                      setEditor(true);
                      setFen(DEFAULT_POSITION);
                      setResult(null);
                    }}
                  >
                    Starting position
                  </button>
                </div>
              </div>
              <div>
                {editor ? (
                  <>
                    <Board
                      fen={fen}
                      flipped={orientation === "black"}
                      editing
                      onEdit={edit}
                      uncertain={result?.uncertain.map((x) => x.square) || []}
                    />
                    <div className="piece-palette">
                      {["w", "b"].flatMap((c) =>
                        ["K", "Q", "R", "B", "N", "P"].map((p) => (
                          <button
                            key={c + p}
                            aria-label={"Place " + c + p}
                            className={piece === c + p ? "chosen" : ""}
                            onClick={() => setPiece(c + p)}
                          >
                            <Piece code={c + p} />
                          </button>
                        )),
                      )}
                      <button
                        aria-label="Remove piece"
                        className={piece === "erase" ? "chosen" : ""}
                        onClick={() => setPiece("erase")}
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                    <p className="fine-print">
                      Choose a piece, then click a square to correct it. Amber
                      borders mark uncertain squares.
                    </p>
                    {result && (
                      <div className="recognition-result">
                        <strong>
                          {result.uncertain.length
                            ? `${result.uncertain.length} uncertain squares — check them carefully`
                            : "Board recognised — confirm the pieces"}
                        </strong>
                        <p className="fine-print">{result.note}</p>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                          />{" "}
                          I checked the pieces and the side to move.
                        </label>
                      </div>
                    )}
                    <label>
                      Side to move
                      <select
                        aria-label="Side to move"
                        value={turn}
                        onChange={(e) => setTurn(e.target.value)}
                      >
                        <option value="w">White to move</option>
                        <option value="b">Black to move</option>
                      </select>
                    </label>
                    <details>
                      <summary>Advanced position metadata</summary>
                      <label>
                        Castling rights
                        <input
                          aria-label="Castling rights"
                          value={rights}
                          onChange={(e) => setRights(e.target.value)}
                          placeholder="KQkq or -"
                        />
                      </label>
                      <label>
                        En passant target
                        <input
                          aria-label="En passant target"
                          value={ep}
                          onChange={(e) => setEp(e.target.value)}
                          placeholder="e3 or -"
                        />
                      </label>
                      <p className="fine-print">
                        Rights default to none because a screenshot cannot prove
                        them. Historical legality and repetition cannot be
                        verified.
                      </p>
                    </details>
                    <Button
                      className="primary full"
                      icon={Search}
                      disabled={!!busy}
                      onClick={confirm}
                    >
                      Analyse position
                    </Button>
                  </>
                ) : (
                  <div className="position-placeholder">
                    <ScanLine size={54} />
                    <h3>A new perspective awaits.</h3>
                    <p>Your editable board preview appears here.</p>
                    <button onClick={() => setEditor(true)}>
                      Set up manually
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {busy && (
          <div className="processing" role="status">
            <span className="spinner" />
            {busy}
            <button
              onClick={() => {
                cancel.current?.abort();
                setBusy("");
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {err && (
          <div className="error-box" role="alert">
            {err}
          </div>
        )}
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
