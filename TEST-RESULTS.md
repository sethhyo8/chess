# Validation - 28 October 2026

Latest verification on Windows using system Chrome and the local Stockfish engine:

- Production build: passed.
- Core tests: 17 passed, 0 failed.
- Browser tests: 18 passed, 0 failed.
- Added coverage for persisted coach preferences in Settings, concise Why explanations, legal SAN/PGN/coordinate move input, and horizontal evaluation values without overflow at 375, 768 and 1440 pixels.
- Removed the What should I look for control; the coach panel keeps Hint, Why and threat actions.
- Source files and production output are saved to disk.

## Earlier validation record

# Validation — 27 October 2026

Validated on Linux x86_64, Node 24.19, npm 11.9, system Chromium, and the installed Stockfish 17.1 Lite WASM build.

| Command | Result |
| --- | --- |
| `npm ci --cache /tmp/chessgrove-npm-cache` | Passed; lockfile installation completed |
| `npm run build` | Passed; production UI generated |
| `npm test` | 14 passed, 0 failed, 0 skipped |
| `npm run test:e2e` | 11 passed, 0 failed; production server and real APIs |
| `GET /api/health` | `ready: true`, `Stockfish 17.1 Lite WASM` |
| Chromium desktop inspection | Board, analysis and coach layouts inspected; no runtime page errors in the manual check |
| Chromium mobile layout | Board above panel, no horizontal overflow at 390px |

The automated checks cover PGN preservation and malformed/multiple/custom-FEN imports; Black-first notation; FEN metadata; castling, en passant, underpromotion, mate, stalemate, repetition and fifty-move draws; White evaluation perspective and mate signs; quality/accuracy rules; engine option discovery, real legal lines, cancellation and startup failure; lower-tier selection distribution; grounded coaching, legal forks and pins; image recognition in both orientations, cropping, uncertainty and style learning; GIF duplicates, animation frames, transparent compositing/disposal, castling, promotion, en passant and unresolved gaps; navigation, replay, graph selection, branches, saving, reopening and bot resumption; silent bots, coach-only bubbles, progressive hints and settings; both player colours, click/drag moves, takeback, resignation, restart, delayed/stale responses, checkmate completion and timed-game expiry.

The final browser run passed after fixing Black-first move columns and preserving pasted-FEN turn/counters. The final unit run passed after adding legal fork/pin explanations and real transparent GIF disposal coverage. Tests invoke the production engine and recognition code, not mocked recommendation endpoints. The stale-response browser test delays a response fetched from the real engine.

Limits: the exact supplied Chess.com screenshots are not available as local fixtures and their recognition remains unverified. Tested images use licensed Cburnett pieces; other styles can be learned from a confirmed full starting-position image. Bot ratings are estimates without external calibration. The engine was installed from the integrity-locked npm package, not rebuilt from source. See README.md for recognition, clock, review and deployment limits.

The bot-layout update also verifies a dedicated play panel, absence of analysis/coach tabs and speech bubbles, captured-piece/material trays, an automatic checkmate result popup, and transition to the separate review section. The regression suite covers resignation from that popup and coaching through its own navigation section.

The app remains running on port 3000. Live processes will not survive a new environment. Environment draft saving was attempted but the configuration service returned that this chat's onboarding configuration is unavailable; no reusable cloud draft was saved. Setup and launch commands are preserved in README.md.
