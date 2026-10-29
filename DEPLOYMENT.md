# Publish the complete ChessGrove app

ChessGrove needs a Node web service for Stockfish, coaching, review and image
imports. GitHub stores the source; Render runs the application. The UI and API
are served from the same address. No API keys or database are needed.

## Deploy on Render

1. Review and merge the deployment pull request into `main` on GitHub.
2. Sign in at https://dashboard.render.com/ and connect your GitHub account.
3. Choose **New → Blueprint** and select `sethhyo8/chess`, branch `main`.
   Grant Render access to this repository if it does not appear.
4. Render reads the root `render.yaml`. Review the `chessgrove` web service and
   its Free plan, then create the Blueprint. This starts the initial deployment.
   If a deploy is not started, open the service and choose **Manual Deploy →
   Deploy latest commit**.
5. Wait for the build and deployment to finish. The logs should include
   `Engine ready: Stockfish 17.1 Lite WASM`. Open the HTTPS `onrender.com` URL
   shown on the service page; use that as the website address.
6. Open `/api/ready` on that URL. It should return HTTP 200 and `"ready": true`.
   Play a move against a bot, request a Coach hint, and try reviewing a game.

Automatic deploys are disabled in the configuration. After reviewing and merging
future PRs, use **Manual Deploy → Deploy latest commit** to publish them.

If you use **New → Web Service** instead, use these equivalent settings:

| Setting | Value |
| --- | --- |
| Repository / branch | `sethhyo8/chess` / `main` |
| Runtime | Node |
| Root directory | Leave empty |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/ready` |
| Environment | `NODE_ENV=production`, `NODE_VERSION=24.19.0` |
| Automatic deploy | Off |

Let Render supply `PORT`; the app already listens on `0.0.0.0` and that port.
Do not choose Static Site, and do not deploy just `dist/` as the complete app.

## Retire the broken GitHub Pages address

The old workflow is replaced with test/build validation so it stops uploading
unbuilt React source. This does not remove the already published Pages site.
After the Render URL works, open GitHub repository **Settings → Pages** and
**Unpublish site**. Set the repository's About website link to the Render URL.
The existing `sethhyo8.github.io/chess/` address will not automatically become
the Render address. A custom domain can be added separately later.

## Checks and troubleshooting

- A failed build: open the Render deploy logs and check `npm ci` and `vite build`.
- Failed health checks: look for `Engine unavailable` in the runtime logs.
  `/api/health` reports engine details even when startup failed; `/api/ready`
  returns 503 until the engine has initialized successfully.
- Use a current deployment's Render URL, not a GitHub source or Pages URL.
- Free services can sleep when idle and take time to wake up. Stockfish and GIF
  imports use server CPU and memory; choose more resources if your workload
  exceeds the plan. This configuration is a starting point for personal use,
  not a load-tested public service.
- Games remain in browser storage, per website address. Export important games
  as PGN before changing hosts; browser storage is not migrated by deployment.

The public service has the application's existing engine queue and upload
limits. It has no user accounts, authentication, or per-user usage quotas.
