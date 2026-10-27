# Chessgrove

A local chess workspace for playing, learning, importing positions, and reviewing games. Built with React, Vite, Express, chess.js, Sharp, gifuct-js, and real Stockfish. The charcoal layout, green board, review panel and coach bubbles follow the supplied visual references. Branding and avatars are original. Ordinary bot opponents are silent.

## Start

Requires Node.js 22.12+ (tested with 24.19), npm, and a modern browser. No API keys, paid services, database, Docker, or native chess executable are required.

```sh
cd /workspace/projects
npm ci --cache /tmp/chessgrove-npm-cache
npm run dev
```

The server listens on port 3000. `PORT=4000 npm run dev` selects another port. For a production build:

```sh
npm run build
npm start
```

Both commands serve the UI and API from the same process. Restart `npm run dev` after backend changes; Vite reloads frontend changes. To check engine readiness, request `GET /api/health` and verify `ready: true`. All network downloads happen during installation; the running app uses local assets and computation.

## Interface

The interface uses a minimal charcoal and sage palette (dark background `#302E2B`) with a complete light theme, locally bundled Outfit headings and Work Sans interface text, consistent controls, visible keyboard focus, and reduced-motion support. The design follows UI/UX Pro Max guidance, adapted to the chess workspace and supplied references.

Appearance can be changed from the toolbar, sidebar, or Settings and is remembered on this device. The collapsed sidebar uses evenly spaced controls. Boards, piece selectors, player icons and captured trays use locally bundled 300-pixel Neo pieces matching the supplied reference. Official sidebar and move-classification images from the requested Chess.com brand resources are stored locally; generic controls retain their existing icons where the resource page has no matching asset.

Bot play has a compact opening header, move history, and icon-only controls: resign, takeback, hint, export, and settings. Hover titles and accessible names describe each control. The book icon saves the game; the compass flips the board. Finished bot games save to My library automatically with their result, and can be opened for review or deleted there. Finished games are cleared from the current workspace when navigating away; they open again only through Library or the end-of-game Game Review action. Review Game contains only Analysis and Review tabs. Coach practice and active bot games use separate workspaces. Restart is available in Settings. After a game, the three actions become review, new bot, and rematch. Left/right arrow keys navigate move history. The desktop sidebar can be minimised to an icon rail; the preference is remembered on this device. Move-quality badges use coloured circles with a star, thumbs-up, check, and punctuation, following the supplied reference; the engine grading thresholds are unchanged.

## Opening database

Open **Openings** from navigation, or select an opening name beside the board. The local database contains 3,865 validated opening lines spanning ECO A-E. Search by name, ECO code, or moves; filter by ECO family; preview each move on the board; then select **Analyse opening**. Recognition uses actual board positions, handles recognised transpositions, and retains the last known opening when play leaves the database. It respects custom starting positions. No fabricated game statistics or win rates are shown.

Data comes from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), under CC0. Original TSVs, licence and generated JSON are in `public/data/`. Rebuild with `npm run openings`.

## Try the workflows

- **Review Game:** the initial sample is a legal Italian Game. Click Review → Start Game Review. Every position is analysed with Stockfish. Click moves, graph points, or turning points. Play the engine alternative, or make a move on the board to create a separate line. Return to game preserves the original match. Left/right keys navigate; replay speed is adjustable.
- **Analyse Screenshot:** use the sample screenshot or upload/paste/drop PNG, JPEG or WebP. Recognise the board, correct uncertain squares, confirm the turn and placement, then analyse. The engine recommends a legal move, displays its arrow, three candidates, evaluation, depth, and an explanation. You can also edit FEN, place pieces manually, or select Paste moves or PGN to enter standard notation or coordinate moves. Pasted moves open at the final position with their full legal history preserved.
- **Review imports:** upload/paste PGN; multi-game files get a picker. Comments, headers, numeric annotation glyphs and recursive variations are retained on export. Imported alternatives can be opened below the move list. Upload a GIF, select orientation, and reconstruct it. A sample GIF is available in the import dialog. Custom starting FEN and board crop are in advanced settings.
- **Play with Bots:** pick an opponent, colour, and untimed or 5/10/15-minute game. The dedicated play screen shows the board, player details, captured pieces, material advantage and move history. Analysis, review and coaching panels are kept out of bot play. A result popup offers Game Review, New Bot and Rematch. Click or drag legal moves; promotions have a selector. Takeback is a practice aid and restart is confirmed. Pending engine requests are cancelled on restart, navigation or takeback.
- **Play With Coach:** Olive focuses on fundamentals; Theo on forcing moves; Iris on activity and planning. Three hints progress from a general idea, to a piece, to the engine move and arrow. Why and threat questions use the actual board and legal engine lines. Coaching needs no language-model API. Commentary, teaching level and mistake warnings live in Settings and persist on this device. Coach selection remains in the coach panel. Why answers give a short reason; detailed commentary adds only a three-move line. A custom position or an imported game can be used for practice. Coach feedback classifies human moves with matched depth-9 searches. A completed review shows an evaluation graph, accuracy estimates, and move quality counts. Select graph points or moves to inspect a position.
- **Save:** games, reviews, most recent analysis, and preferences use browser local storage. Current bot games resume on refresh. Saved games reopen from My library (the top-right profile button also opens it on mobile). Export important games as PGN. Library entries can be deleted. Browser storage is local to the device and origin, not a cloud account.

Clocks use elapsed wall time while a play session is active, rather than counting timer callbacks. They pause when leaving the play workspace and during browser shutdown; this is a local practice application. Takebacks do not refund time. Timeout handling includes lone-king and insufficient-material draws. This is not a rated or tournament clock.

## Recognition and GIF support

The implemented vision pipeline runs on the local Node server:

1. Validate formats, dimensions and size; detect eight alternating equal-width squares and verify the square grid in a larger image. The crop can be overridden in image pixels.
2. Extract 64 squares, remove their sampled backgrounds, and compare foreground masks, luminance and chroma against licensed piece templates.
3. Offer confidence flags and alternatives for correction. The default templates are Cburnett pieces, tested against the included images. For the Chess.com standard style or another shape set, provide a **complete standard starting-position screenshot** and explicitly enable learning its piece style. All twelve piece templates are learned from the image and stored on this device. Reuse those templates for later screenshots and GIFs with that style and scale.
4. For GIFs, decode and composite frames, honour transparency and disposal types, recognise positions, then match each changed stable position to **one unique legal move**. Duplicates and intermediate frames can be ignored if later stable frames resolve them. Captures, castling, en passant and underpromotions use the legal move generator. Missing plies are never filled in by guessing. A final unresolved transition yields an explicitly incomplete result, relevant frame previews and an option to open only the confirmed prefix.

This is template matching, not a universal trained vision model. Unsupported themes, severe compression, occlusions, multiple boards, atypical colours and tiny pieces can fail; the crop, correction and learning controls are deliberate fallbacks. The exact user-supplied Chess.com reference images were visible as visual references but were not available as local fixture files; automatic recognition against those exact screenshots has **not** been verified. Cburnett image fixtures and learned-template paths have been tested. A GIF beginning mid-game requires the correct starting FEN. If a GIF skips entire moves, ends on an animation frame, or cannot uniquely establish history, import PGN or correct the source instead.

Images never establish turn, castling, en passant, repetition or historical legality. Screenshots require confirmation, default to no castling/en passant, and validate both kings, pawn ranks, basic material limits and whether the non-moving side is illegally in check. A structurally valid FEN does not prove reachable history.

Limits: images 15 MB / 16 MP; GIFs 4 MP, 600 frames, 180 million cumulative frame pixels, 90 seconds, one reconstruction at a time. GIF processing streams frame progress and supports cancellation. Engine jobs are capped at two active plus twelve queued requests.

## Stockfish provenance and strength

The supplied macOS archive mentioned in the brief was not present in accessible attachments. The runtime is Linux x86_64. No macOS executable was run. The pinned `stockfish@17.1.0` package provides **Stockfish 17.1 Lite WASM**, run by Node as a separate UCI process for each job. The exact files are:

```
node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.js
node_modules/stockfish/src/stockfish-17.1-lite-single-03e3232.wasm
```

Npm's lockfile verifies package integrity. Upstream source: https://github.com/nmrugg/stockfish.js/tree/602fd7e1a571a2be71f242942db90483731f2a1f . The exact corresponding-source archive is in `public/engine-source/stockfishjs-17.1-source.tar.gz`. Upstream build instructions are in that archive's README/build script. Upstream engine: https://github.com/official-stockfish/Stockfish . Lite's advertised NNUE is `nn-9067e33176e8.nnue`, embedded in the WASM; no separate network download is needed at runtime. `EvalFileSmall` is empty. This is the lite engine, not the full-strength large NNUE build.

Startup sends `uci`, records the advertised options and engine identity, then waits for `readyok`. This build advertises `Threads` 1–1, `MultiPV` 1–256, `Skill Level` 0–20, and `UCI_Elo` **1320–3190**. Options are sent only when advertised. All jobs use one thread and 32 MB hash, have a 30-second timeout, and are killed on cancellation/completion. Separate processes isolate bot strength, review and coaching. Cache keys include starting FEN, complete move history, version, depth, MultiPV and strength; results are bounded to 5,000 entries. `STOCKFISH_JS` can select another compatible Node UCI entrypoint for troubleshooting; leave it unset for the verified production build.

For estimates below native Elo bounds, search depth 7 with up to 24 legal MultiPV candidates. Sample weights are `exp(-max(0, bestScore - candidateScore) / T)`, with the best candidate's weight multiplied by 1.5. `T` is 240 at ≤400, 150 at ≤700, 85 at ≤1000, and 45 above that but below the native minimum. Scores are from the moving side's perspective. This favours sensible moves, retains tactical mistakes, and does not select uniformly random legal moves. At supported native strengths use depth 12, `UCI_LimitStrength=true`, and the advertised `UCI_Elo`; play the engine's actual `bestmove`, which can differ from PV1 under strength limiting. Displayed Elo values are uncalibrated estimates, with no claimed equivalence to any chess platform. Distribution tests establish differences in the lower-tier policy; no external rating calibration or exhaustive self-play tournament was performed.

## Review calculations

Interactive analysis uses depth 10 / 3 candidates. Review compares adjacent positions using **depth 9 / 3 candidates / 1 thread / 32 MB** throughout. Positive scores always favour White, independent of orientation. Moving-side centipawn loss is `max(0, (before - after) × colourSign)`. Mate scores use a signed sentinel `100000 - mateDistance`; checkmate is ±100000 and terminal draws are zero. This makes losing a forced mate a severe loss; the sentinel is not a literal material evaluation.

Labels by centipawn loss: Best <12; Excellent <35; Good <80; Inaccuracy <150; Mistake <300; otherwise Blunder. Per-move accuracy is `100 × exp(-loss / 200)`, rounded; player accuracy is its arithmetic mean. The UI labels these as Chessgrove estimates. There are no fabricated brilliant moves, platform ratings, skill points or proprietary metrics. Finite depth can change assessments; these are reproducible settings, not an assertion of perfect chess. The full opening database is matched by named board positions, with ECO code and opening name displayed when recognised.

## Test

```sh
npm test
npm run build
npm run test:e2e
```

Unit/integration tests use the actual installed Stockfish and production recognition functions. Tests cover legality, PGN round-tripping, orientation/crop/uncertainty, GIF duplicate/intermediate frames, castling, promotion, en passant, unresolved gaps, mate/evaluation signs, accuracy, lower-tier selection distribution, cancellation and coach grounding. Browser tests exercise actual APIs for screenshots, GIFs, reviews, both player colours, click and drag play, takeback, refresh, resignation, hints, settings, restart with a delayed real engine response, checkmate, clocks, saving, and mobile layout.

Playwright detects system Chromium, Chrome, or Edge, and otherwise uses its bundled browser. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to override the browser path. The test server starts automatically if one is not already on port 3000. To check the production UI, run `npm run build && npm start` before the browser tests. Regenerate fixtures with `npm run fixtures`; expected positions and move lists are in `public/fixtures/expected.json`.

## Source and licences

- Outfit and Work Sans variable fonts: SIL Open Font License 1.1. Font files and their licences are bundled in `public/fonts/`.


- Chess.com sidebar and move-classification images: downloaded from the user-requested [brand resources](https://www.chess.com/article/view/chess-com-brand-resources). Source URLs are recorded in `public/brand/chesscom/sources.json`. Neo piece images come from the Chess.com theme CDN; attribution is in `public/pieces/neo/README.md`. These image assets retain their separate ownership and are not included under the application code licence.
- Application source and original avatars: GPLv3; see `LICENSE`.
- Stockfish.js: © 2025 Chess.com, LLC and Stockfish contributors, GPLv3. Licence in `public/licences/stockfish-GPL3.txt`; exact corresponding-source archive above. Preserve source availability when redistributing an installed engine.
- Cburnett SVG chess pieces: Colin M. Burnett, originally GPLv2 or later, distributed here under the GPLv3 option. Original source: https://github.com/lichess-org/lila/tree/master/public/piece/cburnett . Attribution catalogue retained in `public/licences/lila-COPYING.md`; applicable GPL text in `public/licences/cburnett-GPL3.txt`. The Cburnett set is retained for the original screenshot-recognition templates and fixtures.
- chess.js: BSD-2-Clause; pgn-parser: MIT; React: MIT; Express: MIT; Vite: MIT; Sharp: Apache-2.0; gifuct-js/gifenc: MIT; Lucide: ISC. Their package licences remain in `node_modules`.

Inspected https://github.com/ChessCom/Chess-Game at commit `71b5b0b6226fef1f9205c8daf57e848c4336d7cd`: README, composer manifest, `src/Chess/Game/ChessGame.php`, tests and PHP-3.01 licence. It is a PHP game-state/rules library based on PEAR Games_Chess. Its FEN, move, check/draw and promotion interfaces were useful references for choosing legality boundaries. No PHP code was copied or translated; chess.js supplies the corresponding functionality in this JavaScript stack. That repository contains neither the Chess.com website nor its proprietary review/coaching systems. The requested GitHub plugin was unavailable in this session, so inspection used the authenticated Git HTTPS route.

This app is intended as a local study workspace. It has no remote accounts, multiplayer, cloud sync, external vision model or language-model service. The server has no authentication; use a trusted development environment rather than exposing it as a public multi-user service.
