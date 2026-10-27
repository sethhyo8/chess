# Chessgrove project handover

Prepared: 28 October 2026 (Australia/Sydney).

This document is for a new Codex Cloud agent continuing this exact project. It is based on the actual source, configuration, assets, tests, Git history, and the preceding development conversation. Application code was not changed while preparing it.

## 1. Start here: repository and continuation instructions

- **Project:** Chessgrove, a chess playing and study application.
- **Private GitHub repository:** <https://github.com/sethhyo8/chess>.
- **Branch:** `main`, tracking `origin/main`.
- **Application baseline commit:** `f222765505b9bcafbd1619bbbc77411139c40a05` — `Add complete Chessgrove app with themes, openings, coaching and tests`.
- The preceding commit is `657ca49` (`Initial commit`). The project upload preserved that history and added the complete application.
- The upload contained **96 project files**; every uploaded blob was checked against the local Git blob hash. Local Git was then connected to the remote and synchronized with `origin/main`.
- **Local Windows working directory:** `D:\Downloads\projects-main2\projects-main`. Do not assume this path exists in Codex Cloud.
- This handover is an additional local document created after that application commit. At creation it has **not been committed or pushed**. For a new Cloud conversation, commit/push it or attach its contents explicitly; cloning the application baseline alone will not include this document.

The most recent user request was to create this handover and **not modify existing application code**. There is no unfinished application change currently authorized by that request. Recommendations below are proposals for subsequent work, not features already built or a mandate to change them immediately.

### Suggested first actions in a new Cloud conversation

1. Open the private repository and verify the checked-out branch and commit.
2. Read this document, then `package.json`, `src/main.jsx`, `shared/chess.js`, and `server/index.js`.
3. Install dependencies and establish a working baseline using the commands below.
4. Ask the user which development objective to pursue next if none is supplied. The last requested UI changes are implemented and tested.
5. Preserve the explicit product requirements in section 5 when making changes.

## 2. Project overview

Chessgrove is a local-first chess workspace for playing silent computer opponents, exploring positions with deterministic coaching, analysing and reviewing games with real Stockfish, importing boards or game notation, and studying named openings.

The intended experience is **minimal, clean, simple, readable, and uncluttered**. The board is the focus. Bot play, review, and coaching have separate presentation and workspace state. The application uses its own Chessgrove branding and avatars, together with downloaded Chess.com interface assets and Neo piece images requested by the user.

Main navigation:

| Navigation label | Internal section | Purpose |
| --- | --- | --- |
| Play with Bots | `play` | Choose a bot and play a game |
| Play With Coach | `coach` | Explore positions with hints and explanations |
| Analyse Screenshot | `screenshot` | Open the position-import modal |
| Review Game | `review` | Analysis and completed-game review |
| Openings | `openings` | Search and preview the opening database |
| My library | `library` | Open, resume eligible saved games, or delete games |

Settings is accessed separately through settings buttons. On mobile the five main navigation items become a bottom navigation bar; Library is also accessible through the profile button.

**Important scope distinction:** the application is not an online multiplayer service. It has no accounts, remote game storage, social features, rated matchmaking, or deployed public hosting configuration. Stockfish runs on the Node server, not inside a browser worker. Local-first storage does not mean the UI can analyse games without its backend.

## 3. Current implementation: completed features and their actual scope

### 3.1 Frontend and interface

Implemented in React with Vite and plain CSS:

- Responsive board, player details, captured-piece trays, material advantage, move history, and navigation.
- Board moves by click or HTML drag/drop, legal-move indicators, last-move highlights, check highlights, board flipping, and a promotion selector including underpromotion.
- A piece-placement editor for manually constructing or correcting positions.
- Dark and light themes, persisted in local storage. The dark **page background is exactly `#302E2B`**; darker panel/sidebar surfaces remain intentional. Light page background is `#f5f3ed`.
- Local variable fonts: Outfit for headings and Work Sans for interface text.
- A collapsible desktop sidebar with remembered preference, expanded width 224 px and collapsed width 76 px. The collapsed rail has regular icon spacing.
- Downloaded official images for applicable navigation and move-quality icons. Generic controls keep Lucide icons where the supplied resource page has no matching asset.
- Twelve locally bundled **300 x 300 transparent Neo PNG piece images**. The same `Piece` component supplies board pieces, editor/promotion pieces, the player pawn image, and captured pieces.
- Captured-piece images render at 20 px with overlap and theme-specific treatment; material advantage is shown beside them.
- A widened **52 px evaluation bar**, with a horizontal score label rather than rotated/clipped numbers.
- Accessible names for icon buttons, visible focus styles, reduced-motion CSS, and several responsive layout checks. This is not a complete accessibility audit or a claim of full modal keyboard accessibility.

The user previously requested removal of the promotional “A little better, every game. Explore. Understand. Grow.” card and the review “Your next step”/turning-point lesson block, including its calculation footnote. These are removed; do not restore them casually.

### 3.2 Bot opponents and game lifecycle

Seven opponents are configured in `src/data.js`:

| ID/name | Displayed strength | Group |
| --- | --- | --- |
| `milo` / Milo | 350 | Beginner |
| `pip` / Pip | 600 | Beginner |
| `fern` / Fern | 850 | Novice |
| `jasper` / Jasper | 1200 | Intermediate |
| `sage` / Sage | 1600 | Advanced |
| `rowan` / Rowan | 2000 | Expert |
| `atlas` / Atlas | 2600 | Master |

Completed behavior:

- Opponent selection, White/Black/random pieces, and untimed or 5/10/15-minute clocks.
- Real legal engine replies. Black-side play, refresh while playing, and delayed-response cancellation have regression coverage.
- Silent ordinary bots: no coach bubbles or review/analysis tabs during bot play.
- Compact sidebar matching the supplied reference: opening header and moves, then icon-only **resign, takeback, hint** actions; export and settings below. The header book saves the game; the compass flips the board. The opening name opens the opening database.
- Restart is available through Settings and confirmed. Resignation is confirmed. Takeback is a practice aid and does not refund time.
- A result dialog for checkmate, draws, resignation, and timeout. Actions include Game Review, New Bot, and Rematch; the sidebar also changes to post-game actions.
- Finished bot games automatically save to Library with their result, completed flag, bot metadata, and clocks. Existing entries with the same game ID are replaced rather than duplicated.
- Library permits review and deletion, and resume for a saved unfinished bot session.
- Leaving a completed game retires it from the normal workspace. It should not appear just because the user opens Coach, Bots, or Review. Explicit Library review and the end-of-game Game Review action remain supported.
- Completed games are not written back as a resumable current game; `grove-current` is replaced with a fresh game and `grove-bot` is cleared.

Bot strengths are estimates, not calibrated Chess.com ratings. Clock behavior is local practice behavior: elapsed wall time while the play workspace is active, with pauses when leaving that workspace or closing the browser. It is not a tournament clock.

### 3.3 Analysis and review

- Interactive analysis calls `/api/analyse` with the starting FEN and complete move prefix. Default depth is 10, with 3 candidates. The UI shows score, candidate SAN continuations, depth, move history, and an evaluation bar.
- Positive scores favor White independently of board orientation. Mate is represented separately in labels and through a sentinel value for comparisons.
- Selecting a candidate or making a move outside a bot game creates an alternative `branch`. The original game is preserved and can be restored with Return to game.
- Move navigation works through buttons, Left/Right keys, autoplay, and replay speed controls.
- Review shows an evaluation graph, per-player accuracy estimates, six move-quality counts, and move badges. The graph navigates to positions.
- **Review Game shows only Analysis and Review tabs.** Coach is conditionally available in the Coach section, not the Review section.
- Review progress and cancellation are supported.

There are **two different review paths**, which must not be conflated:

1. The actual browser `review()` function in `src/main.jsx` loops over positions and calls **`/api/analyse` at depth 9**, receiving **3 PV candidates** for each position. It computes move qualities in the browser and stores `game.review`.
2. The backend also exposes **`POST /api/review`**, which loops at depth 9 with **1 PV** and returns evaluations and qualities. The current browser review implementation does **not** call it.

Move grading in `shared/chess.js`:

- Loss from the moving side's perspective: `max(0, (before - after) * colorSign)`.
- Best: loss < 12 centipawns.
- Excellent: < 35.
- Good: < 80.
- Inaccuracy: < 150.
- Mistake: < 300.
- Blunder: otherwise.
- Move accuracy: `round(100 * exp(-loss / 200))`. Player accuracy is the mean of that player's move accuracies.
- Mate scores use a magnitude near 100000; these are comparison sentinels, not literal material values.

Downloaded assets and the badge mapping include Brilliant, Great Move, Book, and Miss as well as the six current labels. **The classifier only generates the six labels above.** There is no implemented brilliant-sacrifice detector, special great-move grading, missed-win classifier, or opening-book grading. Do not claim otherwise just because an image exists.

### 3.4 Coaches: implemented guidance versus missing match mode

Configured coaches:

| ID | Name | Focus |
| --- | --- | --- |
| `fundamentals` | Olive | Development, central squares, king safety |
| `tactics` | Theo | Checks, captures, forcing moves, tactical facts |
| `planning` | Iris | Piece activity, central control, candidate moves |

Implemented:

- Coach selection and commentary derived deterministically from legal moves and Stockfish lines. No LLM service or API key is involved.
- Three progressive hints: general idea, source piece/square, recommended move with arrow.
- Why? and What is the threat? actions. The “What should I look for?” button has been removed as requested.
- **Why answers are now short:** one concrete reason if available (capture, check, mate, development, central move, castling), otherwise a short preferred-move statement. Detailed commentary adds at most **3 SAN plies** of continuation, not three full move pairs. Why no longer appends the old long depth/evaluation explanation.
- Teaching level, commentary detail, commentary enabled, and serious-mistake warnings are in **Settings**, not below the coach buttons. Changes save immediately and persist. Coach choice remains in the Coach panel.
- Legal fork/pin fact helpers and threat descriptions exist in `shared/chess.js`. Threat detection reports attacked pieces, not a verified winning tactical sequence.

**Partially implemented product behavior:** despite the label **Play With Coach**, this section currently behaves as guided board exploration. `isPlay` is true only in the `play` section with a bot session; the autonomous bot-reply effect is gated on `isPlay`. Entering Coach restores or creates its own board, and moves there create a branch. There is no separate playable coach opponent/session flow.

Related code exists for move-quality feedback and pre-move mistake warnings, but it is gated on `coachOn && isPlay`. The normal Bots flow explicitly disables coaching, and the normal Coach flow is not `isPlay`. Those capabilities should therefore be treated as **partially wired/internal paths**, not fully working standard Coach gameplay. Existing tests verify hints, preferences, legal explanations, and workspace separation, not a complete autonomous coach match.

### 3.5 Imports, screenshots, FEN, and GIFs

Completed notation imports:

- Full PGN import with multiple-game picker in the main import dialog.
- Preservation of headers, comments, numeric annotation glyphs, recursive variations, and custom starting FEN. Untouched PGN trees are preserved on export.
- Import/export of PGN and access to imported variations.
- The screenshot/position modal has a **Paste moves or PGN** section. It accepts numbered PGN, bare SAN such as `e4 e5 Nf3`, or coordinate moves such as `e2e4 e7e5 g1f3`.
- Pasted move text is validated and opens at the **final position with full move history**, not an isolated final FEN. Invalid moves remain in the dialog with an error. This route accepts one game at a time.
- Coordinate moves start at the standard initial position; PGN can supply its own starting FEN.

Completed position/image import:

- Upload, drop, or clipboard image paste for PNG/JPEG/WebP; sample fixture available.
- Local Sharp-based board detection, crop override, piece-template comparison, confidence flags, and editable board preview.
- FEN entry and explicit side-to-move/castling/en-passant controls. Position validation includes kings, pawn ranks, basic material limits, and checking that the nonmoving king is not illegally attacked.
- User confirmation for recognized boards. Screenshots alone cannot recover side to move, castling rights, en passant, repetition history, or prove reachability.
- Optional calibration from a complete standard starting-position screenshot, with learned templates stored locally.

Completed GIF support:

- Local GIF decoding, frame compositing including disposal behavior and transparent deltas, duplicate/intermediate-frame handling, and legal-move reconstruction.
- Progress streamed as NDJSON, cancellation, unresolved-frame reporting, and explicit use of a confirmed prefix rather than guessing missing moves.
- Mid-game GIFs need a correct starting FEN.

Recognition limitations are material: default templates still use the original **Cburnett SVGs**, while the display now uses **Neo PNGs**. Neo rendering was tested; general recognition of Neo or the user's original screenshot examples was not established by those rendering tests. Another style may need calibration. This is template matching, not universal OCR or a trained vision model.

### 3.6 Opening database

- A bundled local JSON database with **3,865 opening lines**, not necessarily 3,865 unique names. Several names have multiple move orders/ECO entries.
- Source: <https://github.com/lichess-org/chess-openings>, CC0. Original `a.tsv` through `e.tsv` and `COPYING.txt` are retained.
- Build script replays each PGN with chess.js and emits `{ eco, name, pgn, moves, fen }` entries.
- Search by words in opening name, ECO code, or PGN; filter by ECO family A–E.
- Results show the first 100 matches with a prompt to narrow the search. This is intentional limiting, not pagination across the full database.
- Board preview, move-by-move selection, and Analyse opening to load the line into Review.
- Recognition uses board position keys from the first four FEN fields, recognizes indexed transpositions, and retains the latest known named position when play leaves the book. It uses the actual starting FEN and does not assume every custom position starts from standard chess.
- The module fetches `/data/openings.json` once, builds an in-memory position index, and caches lookup results. It has a retry path for failed loading.
- **No game-frequency, popularity, win-rate, or master-game statistics database exists.**

## 4. Architecture and development setup

### 4.1 Technology and dependencies

The package is ESM (`"type": "module"`), with JavaScript/JSX and no TypeScript, React Router, Tailwind, database ORM, Redux, or external UI component framework.

| Dependency | Version in package.json | Role |
| --- | --- | --- |
| React / react-dom | 19.1.1 | Browser UI |
| Vite | 7.1.7 | Development middleware and production frontend build |
| Express | 5.1.0 | Same-origin APIs and frontend serving |
| chess.js | 1.4.0 | Legal positions/moves, history, PGN, terminal states |
| @mliebelt/pgn-parser | 1.4.19 | PGN trees, annotations, variations |
| stockfish | 17.1.0 | Stockfish 17.1 Lite single-thread WASM build run through Node |
| sharp | 0.34.4 | Image processing and fixture generation |
| gifuct-js | 2.1.2 | GIF decoding |
| lucide-react | 0.468.0 | Generic UI icons |
| @playwright/test | 1.56.1 | Browser regression tests |
| gifenc | 1.0.3 | Development GIF fixture creation |
| prettier | ^3.6.2 | Formatting |

Use `package-lock.json` with `npm ci`; do not casually upgrade dependencies while reestablishing the baseline.

### 4.2 Important paths

```text
package.json / package-lock.json   Commands and locked dependencies
index.html                       Root element, initial theme script, entry module
README.md                        Setup/product/reference documentation; some older claims need care
TEST-RESULTS.md                   Latest test record followed by older environment records
PROJECT_HANDOVER.md              This handover
src/
  main.jsx                       App state, navigation, lifecycle, API calls, Library,
                                 bot sidebar, coach UI, review summary, import/Settings modal
  Board.jsx                      Board interaction, editor, promotion, arrows, Piece image
  style.css                      Original styles plus later overrides, themes, responsive UI
  data.js                        Sample game, seven bots, three coaches, opening label helper
  Icons.jsx                      Wrappers for applicable downloaded Chess.com assets
  openings.js                    Fetch/index/cache and position-based opening lookup
  OpeningExplorer.jsx            Opening search, filters, results and board preview
shared/
  chess.js                       Position validation, import/export, move grading,
                                 clock/result helpers, tactical facts, coach text
server/
  index.js                       Express APIs, upload limits, GIF streaming, serving/bootstrap
  engine.js                      UCI process adapter, cache, job queue, strength policies
  vision.js                      Board detection, features/templates, GIF reconstruction
scripts/
  fixtures.js                    Build image/GIF/notation fixtures
  build-openings.js              Validate source TSV PGNs and generate openings.json
tests/
  core.test.js                   10 chess/engine/notation/coaching tests
  openings.test.js               2 opening lookup tests
  vision.test.js                 5 image/GIF tests
  e2e/
    app.spec.js                  10 broad workflow tests
    bot-layout.spec.js           1 bot layout/result test
    workspaces.spec.js           2 lifecycle/sidebar tests
    themes-openings.spec.js      3 theme/opening/image tests
    coach-input.spec.js          2 Settings/pasted-move/evaluation-bar tests
public/
  pieces/neo/                    12 Neo PNGs and source/ownership note
  pieces/*.svg                   12 original Cburnett pieces used by recognition/fixtures
  brand/chesscom/                17 downloaded PNGs, source manifest and attribution
  fonts/                        Local variable fonts and SIL licences
  data/openings.json             Generated database
  data/opening-source/           Five TSV volumes and CC0 dedication
  fixtures/                     Legal sample images, GIF, PGN and expected results
  engine-source/                Corresponding upstream Stockfish source archive and notes
  licences/                     Engine and Cburnett licence/attribution files
playwright.config.js             Browser discovery and automatically started test server
.gitignore                      Excludes dependencies/build/test output and .runtime
```

`src/main.jsx` is approximately 3,200 lines and `src/style.css` approximately 4,000 lines at this baseline. Most application state remains in one component; CSS has repeated selectors and later override blocks. Read the final applicable rules before changing dimensions or colors. There is no checked-in `AGENTS.md` in the project as inspected.

### 4.3 Runtime and commands

Vite 7 requires a suitable modern Node version; use Node 22.12+ or a current compatible 24.x. The local executable read during handover preparation was **Node 24.18.1 / npm 11.16.0**. Older README/test sections refer to previous Linux environments and other Node versions.

In Codex Cloud/Linux:

```bash
npm ci
npm run dev
```

Open port 3000. Express serves both APIs and the Vite development UI; do not start a separate frontend server. Backend edits need a server restart; Vite handles frontend changes.

Production:

```bash
npm run build
npm start
```

The `start` script is `NODE_ENV=production node server/index.js`, which works in a POSIX shell. It is **not a portable native Windows npm command**. In PowerShell use:

```powershell
$env:NODE_ENV = 'production'
node server/index.js
```

Clear/change `NODE_ENV` before expecting development middleware again. `PORT` changes the HTTP port. `STOCKFISH_JS` optionally overrides the engine's Node UCI entrypoint. No API keys or `.env` file are required for normal local use.

Useful commands:

```bash
npm test                 # Core/engine/opening/vision tests
npm run test:e2e         # Browser tests; starts/reuses localhost:3000
npm run build           # Production frontend build
npm run openings        # Rebuild from retained TSV files, not a remote download
npm run fixtures        # Regenerate fixtures; intentionally writes fixture files
```

For a Cloud environment without a browser, install Playwright Chromium as appropriate (`npx playwright install --with-deps chromium` if permitted by that environment). The config checks `/usr/bin/chromium`, Windows Chrome, and Windows Edge, or uses `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Without a detected/overridden system path it uses the Playwright browser installation.

`GET http://127.0.0.1:3000/api/health` returns engine discovery status. The server binds `0.0.0.0`. A simple static host is insufficient because analysis, bots, and recognition need the Node backend.

### 4.4 Backend API and engine contracts

| Endpoint | Current behavior |
| --- | --- |
| GET `/api/health` | Engine name, advertised UCI options, discovery readiness |
| POST `/api/analyse` | `{fen, moves?, depth?}`; defaults depth 10, clamps 6–14, 3 PVs |
| POST `/api/bot` | `{fen, moves?, elo}`; integer Elo 250–3000; returns legal SAN move and policy |
| POST `/api/review` | Starting FEN/history, at most 400 plies, depth-9/1-PV evaluations and qualities |
| POST `/api/recognize` | Base64 image with crop/orientation/calibration options |
| POST `/api/gif` | Base64 GIF/options; NDJSON progress/result/error stream |

Requests use a **starting FEN plus SAN move history**, not just the current board. Retaining history matters for repetition and engine search context. HTTP disconnects cancel analysis/bot/review requests; GIF has its own abort flow. Recognition itself is not the same abortable engine path.

Engine details:

- Node spawns the npm package's `stockfish-17.1-lite-single-03e3232.js` as a separate UCI child per search, using the corresponding bundled WASM.
- It is the **Lite single-thread build**, not a full-strength large NNUE/native engine. The network is embedded; no additional runtime download is needed.
- Startup discovers UCI identity/options. Actual searches use `isready`, then a position and `go depth`.
- Requested Hash 32 MB and Threads 1, set only if advertised. Per-job timeout is 30 seconds.
- At most 2 active engine jobs and 12 queued. A bounded cache uses starting FEN, history, depth, MultiPV, strength and engine-version marker.
- Below the advertised native Elo minimum (normally 1320), depth 7 searches up to 24 candidates and samples by weighted centipawn loss. Temperatures are 240/150/85/45 across the configured low-strength tiers, with an extra 1.5 weight for the best move.
- Native-strength bots use depth 12, one PV, `UCI_LimitStrength`, and `UCI_Elo`; the adapter plays the actual `bestmove`, not merely PV1.

Limits: JSON bodies 22 MB; uploaded decoded image at most 15 MB; image processing up to 16 MP; GIF at most 4 MP, 600 frames, 180 million cumulative frame pixels, and 90 seconds. Only one GIF reconstruction runs at a time. These limits do not make the server a hardened public multi-user service.

### 4.5 State, persistence, and cancellation

Core game shape from `makeGame()`/`importPgn()`:

```text
id, start, moves[], fens[], headers, title, created
optional: source, tree, raw, lastAnalysis, review,
          completed, ended, bot, clocks
```

- `moves` contains SAN plies; `fens[0]` is the starting board and `fens[i]` is the board after `i` plies.
- `idx` selects a position in the original game. `branch` is a separate alternative game with its own start/moves/fens.
- `botSession` includes bot ID, user color, time preset, coach flag, and ended status. Persisted bot state also carries clocks and a save timestamp.
- `invalidate()` increments a generation token, aborts pending bot/analysis/review requests, and clears transient state. Keep this protection during refactors; it prevents stale replies applying after restart/navigation/takeback.
- `workspaces.current` is an **in-memory ref**, storing separate review/coach/play snapshots. Completed games are deliberately not retained there.
- `archivedGames.current` prevents repeated auto-archiving within the mounted app. Library updates are keyed by game ID.

Local-storage keys:

| Key | Data |
| --- | --- |
| `grove-current` | Current noncompleted game; fresh game for completed views |
| `grove-bot` | Current resumable bot session or null |
| `grove-library` | Saved game array |
| `grove-theme` | `dark` or `light` |
| `grove-sidebar-collapsed` | Sidebar preference |
| `grove-coach` | Selected coach object |
| `grove-commentary` | Preferred coach commentary enabled state |
| `grove-detail` | `minimal`, `balanced`, `detailed` |
| `grove-level` | `beginner`, `intermediate`, `advanced` |
| `grove-warning` | Serious-mistake warning preference |
| `grove-flipped` | Board orientation preference |
| `grove-speed` | Autoplay interval in milliseconds |
| `grove-analysis` | Analysis enabled preference |
| `grove-templates` | Learned piece-recognition templates |

`coachEnabled` is the persistent preference; `coachOn` is current active UI/session behavior. Do not collapse these into a single switch without checking bot silence and navigation tests.

Storage is browser/device/origin-specific, including the port. It is not saved in the Git repository, exported by this handover, or automatically present in a new Cloud preview. `write()` currently catches quota errors and logs a console warning rather than surfacing a reliable failed-save state.

## 5. Previous conversation decisions and user preferences

Preserve these as product requirements unless the user changes them:

1. **Minimal, clean, simple UI.** Improve fonts, wording, contrast and spacing; avoid clutter and long coach prose.
2. Use **UI/UX Pro Max** guidance for interface work. A public upstream copy was read from <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill>; its local checkout was temporary under the previous Windows user's temp directory, not committed into this repository. Do not assume the skill is installed in Cloud; use an available installation or retrieve it when applicable.
3. Remove the two unwanted promotional/review lesson sections described in section 3.1.
4. Bot play should resemble the supplied compact reference: moves and opening name, icon-only actions, no visible coach commentary or analysis tab strip. Accessible names/tooltips remain appropriate.
5. Review Game must show **only Analysis and Review**, never Coach.
6. Automatically save finished games to Library; allow deletion there. A finished game must not leak into other workspaces; only explicit end-of-game review or Library should reopen it.
7. Exact full labels: **Play with Bots** and **Play With Coach**. Short mobile labels are intentional.
8. Sidebar must minimize/expand and remember the preference; collapsed spacing was subsequently refined.
9. Use applicable official assets from <https://www.chess.com/article/view/chess-com-brand-resources#Sidebar>, including move-classification icons. Download assets locally rather than relying on runtime hotlinks.
10. Dark page background must be **`#302E2B`**; support a remembered light mode.
11. Use high-quality pieces resembling the supplied Neo reference, and refined images in captured-piece trays. The current solution uses original 300 px Neo PNGs.
12. Provide an opening database. The delivered solution is a local named-line database and explorer, not a fabricated statistical explorer.
13. Remove **What should I look for?**; move explanations/commentary preferences and warnings into Settings.
14. Add pasted moves to the screenshot/position dialog and keep their game history.
15. Shorten **Why?** responses. Enlarging the evaluation bar must make scores readable without rotated/clipped text.
16. Save and test completed work. The final application change passed the build and test suites before upload.
17. The user requested the whole project be uploaded to their private GitHub chess repository; this was completed on `main` using the GitHub connector and verified by file hashes. Dependencies, build output, temporary scripts and test artifacts were excluded.

There was also a **one-off operational request** to close VS Code and shut down the Windows computer after saving/testing. A delayed local PowerShell helper requested graceful closure and shutdown; it lives only in ignored `.runtime`. This is not an application feature, startup behavior, or standing instruction for the next agent. Do not run any old shutdown helper or repeat shutdown during normal development.

The user prefers action and complete implementation over repeated permission questions. Still distinguish requested changes from proposals; do not silently add major new product scope.

## 6. Current development status and evidence

### Working with regression coverage

- Legal board interaction, notation import/export, promotions and terminal chess conditions.
- Real engine analysis and opponent replies; strength policy sampling and cancellation.
- Bot color selection, refresh while playing, takeback, restart, resignation, mate and timeout.
- Auto-save to Library, deletion, explicit completed-game review and same-page workspace isolation.
- Review analysis/graph/accuracy/quality UI and candidate alternatives.
- Coach hints, deterministic concise Why text, settings location and preference persistence.
- Screenshot recognition on included/learned fixtures; GIF reconstruction cases described above.
- Theme persistence, exact dark background, Neo image loading, sidebar preference, and tested responsive layouts.
- Opening search/filter/preview/import, specific variation recognition and indexed transpositions.
- Pasted SAN/PGN/coordinate histories and readable evaluation labels at tested viewport sizes.

### Latest test record

The last application verification in this conversation was on 28 October 2026, before its GitHub upload:

| Check | Last recorded result |
| --- | --- |
| `npm run build` | Passed |
| `npm test` | **17 passed**, 0 failed |
| `npx playwright test` / `npm run test:e2e` | **18 passed**, 0 failed |
| Additional browser inspection | Dark/light screenshots and width checks; no horizontal overflow in checked views |

The suites call real engine/recognition code; the stale-response browser test delays an actual engine response rather than substituting a fake move. The core count includes 10 tests in `core.test.js`, 2 opening tests and 5 vision tests; browser files are listed in section 4.2.

**During handover preparation:** files, Git state and environment versions were inspected. Tests were not rerun, generated application files were not rebuilt, and no existing application code was edited. Treat the table as the last recorded successful run, not a new Cloud-environment verification.

### Partial, missing, or limited

- **Coach match mode:** guided exploration works, autonomous coach matches and their standard warning/feedback wiring are not delivered.
- **Paused workspace durability:** snapshots survive navigation within the mounted app, not arbitrary reloads. Going from an unfinished bot game to Coach changes persisted `grove-current`/`grove-bot`, while the old bot snapshot remains only in memory. Do not promise cross-workspace refresh durability without fixing/testing it.
- **Review persistence:** auto-save stores the finished game at completion; a later review updates the current game object. Updating the Library entry with that review still relies on the explicit Save path; there is no general automatic Library synchronization for every subsequent analysis edit.
- **Recognition:** unknown themes, small/occluded boards and the exact original user images are not universally supported/verified. Default recognition templates differ from the displayed Neo set.
- **Move classifications:** six actual grades only; extra downloaded icon categories are not implemented engine classifications.
- **Opening statistics:** no game results/frequencies, master-game collection, or statistical engine opening book.
- **Persistence:** no backend database, accounts, multi-device sync or backup service. Local storage failure handling is rudimentary.
- **Accessibility:** labels/focus/reduced motion exist, but full dialog focus trapping/Escape handling and broader keyboard/screen-reader auditing are not established by the current suite.
- **Deployment:** no Dockerfile, hosted service configuration, CI workflow, authentication, per-user quotas, or full public-service hardening. Node engine processes must be supported by any future host.
- **Architecture:** large central component and layered CSS need careful maintenance. Navigation is React state, not URL routing/deep links.

No currently failing application test was left outstanding in the last run. The gaps above are explicit implementation limitations or code-inspection findings, not claims that every item has been reproduced as a failing browser test.

## 7. Technical challenges, resolved bugs, and documentation cautions

### Previously encountered and resolved

- Hint arrows could be cleared when enabling analysis because an analysis effect reset arrow state. Position-change resets were separated from analysis enabling; toggling a bot hint is covered.
- Delayed engine replies could otherwise mutate restarted/navigated games. AbortControllers plus generation checks protect the current game; maintain those guards.
- Finished games carried into unrelated sections. In-memory workspace separation, completed-game retirement, and explicit reopening routes were added.
- Duplicate opening list keys left stale results visible after filtering. Keys now include ECO, name **and PGN**, because repeated opening names and multiple move orders are legitimate data.
- A PowerShell-to-Python text pipeline once replaced the ECO separator with `?`; source was corrected to the intended middle dot. Preserve UTF-8 when writing files. Some PowerShell display output can itself appear garbled; inspect file bytes before assuming every displayed accent is corrupted.
- Windows browser tests initially used a Linux-only browser path. The checked-in Playwright config now detects supported system paths or permits an override.
- The narrow, rotated evaluation value was replaced with a wider horizontal label and responsive checks.
- Tests that assumed a finished match stayed in `grove-current` were updated to inspect its Library archive, matching the requested lifecycle.

### Documentation discrepancies: prefer actual code

`README.md` and the older portion of `TEST-RESULTS.md` contain historical material. In particular:

- Older prose says “runtime is Linux x86_64”; recent development/testing was on Windows, and the WASM package is invoked with Node. Cloud must verify its own environment.
- Older prose says the GitHub plugin was unavailable. It was available for the final project upload; the repository now exists and is synchronized at the baseline commit above.
- Older test tables show 14 core / 11 browser tests. The latest totals are 17 / 18.
- The older record says the app remains running on port 3000. That is not a guarantee of a live process in a new session; start the server.
- General README coaching descriptions overstate the ordinary UI accessibility of match warnings/feedback. Consult the `isPlay` gates described above.
- Review MultiPV settings differ between the browser path and `/api/review`. Do not merge their behavior in documentation or tests.
- The next agent should not restore removed turning-point lesson UI merely because older README workflow prose mentions it.

### Assets and source ownership

- Application code/original avatars: GPLv3 (`LICENSE`).
- Engine: Stockfish.js GPLv3. Its corresponding source archive and provenance are retained under `public/engine-source/` with the supplied SHA-256 in its README. This workspace tested the npm build; it did not reproduce the engine build from source.
- Cburnett SVGs: retained with original attribution and licence files; used by existing recognition fixtures/templates.
- Neo images and Chess.com interface assets: downloaded at the user's explicit request, with their original ownership recorded separately. Do not assert that the application's GPL licence grants rights to every third-party image. Sources are recorded in `public/brand/chesscom/sources.json` and the relevant READMEs.
- Fonts: SIL Open Font Licence files are bundled.
- Opening dataset: CC0 dedication and original data retained.

## 8. Outstanding tasks and recommended development roadmap

### What was happening most recently

The latest application request is **complete**: remove the redundant coach action, relocate coach preferences into Settings, shorten Why text, add pasted move input, enlarge the evaluation bar, save and test. The complete application was subsequently uploaded to GitHub. The current task is this documentation-only handover.

There is **no unfinished implementation patch or failing test** from that request waiting to be completed. This handover itself still needs to be committed/pushed or attached for use in Cloud.

### Recommended order for future work (not yet implemented)

1. **Make the handover available and reproduce the baseline in Cloud.** Verify repository access, install the locked dependencies/browser, run core tests, build and browser tests, and confirm engine readiness. Preserve the current behavior before touching architecture.
2. **Select the next user objective.** Clarify whether Play With Coach should become an actual autonomous coaching match or remain guided study. Do not present the rename as evidence that the match mode already exists.
3. **Strengthen session/persistence boundaries if continuing lifecycle work.** Persist separate unfinished play/review/coach workspaces if desired, define reload and deletion behavior explicitly, and add tests for navigating away from an unfinished match then refreshing. Preserve completed-game isolation and once-per-ID archival.
4. **If requested, implement a real coach session model.** Deliberately wire opponent replies, commentary, preferences, move feedback and pre-move warnings to that mode. Keep regular bots silent, review free of Coach tabs, and completed matches subject to the same archive rules. Keep Why concise and fact-grounded.
5. **Consolidate architecture without changing visible behavior.** Extract Settings/import/Library/review components and focused state hooks; separate engine requests, game/session lifecycle and persistence. Consolidate CSS/theme rules incrementally. Run the relevant regression suite after each meaningful step.
6. **Improve reliability and coverage.** Add saved-data schema/version migration and visible storage failure handling; decide whether later reviews should automatically update Library. Audit dialog focus/keyboard behavior, Black-side clocks/player presentation, extreme evaluation labels, and theme contrast in less-common modal states.
7. **Improve image support only with real fixtures and defined goals.** Add Neo/user-style fixtures and calibrated recognition tests before claiming broader recognition. Preserve explicit uncertainty and avoid guessing hidden move history.
8. **Expand opening features only if wanted.** Possible subsequent work includes pagination/virtualization, curated study lines or actual statistical datasets. Preserve distinct move orders and genuine position matching. Do not fabricate popularity or win-rate values.
9. **Plan deployment as a separate task.** Choose a host that supports the Node server and WASM child processes, then add appropriate resource limits, authentication/abuse controls, persistence if wanted, production launch configuration and CI. A Vite static deployment alone will not provide the chess engine APIs.

Suggested regression priorities whenever future changes touch these areas:

- Review has exactly Analysis and Review.
- Ordinary bot play has the compact, icon-only sidebar and no coach bubbles.
- Finished games archive once, can be deleted, and do not leak across navigation.
- Pending engine requests cannot apply after invalidation.
- Coach settings persist and remain in Settings; Why stays short.
- Notation imports keep legal history, starting FEN and turn.
- Themes keep the exact dark background and legible scores; mobile has no horizontal overflow.
- Opening filtering does not reuse duplicate keys, and recognition respects custom starting positions.

### Handover completion check

Only `PROJECT_HANDOVER.md` should be newly added by this documentation task. Check `git status` before making any later commits. Do not include `node_modules/`, `dist/`, `test-results/`, `playwright-report/`, or `.runtime/` in source uploads. In particular, do not copy temporary upload payloads or operational shutdown scripts into the application repository.
