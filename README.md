# FitCheck AI — Backend (Cloudflare Pages Functions)

Serverless backend for the FitCheck AI MVP. No traditional server, no database, no
auth — see `BRIEF.md` for full product context. This repo owns `functions/` (the API);
a frontend engineer owns `public/` (the static site) in parallel.

## Endpoints

- `POST /api/tryon` — accepts a base64-encoded person photo + garment photo, calls
  Gemini (`gemini-2.5-flash-image`) to composite the garment onto the person, and
  returns the resulting image.
- `POST /api/feedback` — captures the "does this look like you / would it affect a
  purchase" signal. Logged as a structured JSON line (no KV/DB in this build), readable
  via `wrangler pages deployment tail`.

## Local development

1. Install dependencies:
   ```
   npm install
   ```
2. Copy the example vars file and fill in your key:
   ```
   cp .dev.vars.example .dev.vars
   ```
   Then edit `.dev.vars` and set `GEMINI_API_KEY=<your key>`. `.dev.vars` is
   gitignored and must never be committed.
3. Run the dev server (serves `public/` + `functions/` together):
   ```
   npm run dev
   ```
4. Type-check the Functions code at any time:
   ```
   npm run typecheck
   ```

If `GEMINI_API_KEY` is not set, `/api/tryon` correctly responds `503
{ "status": "not_configured" }` instead of attempting a call or faking a result.

## Deploying to Cloudflare Pages

1. In the Cloudflare dashboard, create a new Pages project connected to the GitHub
   repo `jeet9909/fitcheckai`.
2. Build settings:
   - Build command: (none)
   - Build output directory: `public`
3. In the Pages project's **Settings → Environment variables**, add `GEMINI_API_KEY`
   as an **encrypted** environment variable (Production and Preview as needed). Do not
   put it in any committed file.
4. Deploy. Every push to the connected branch triggers a new deployment.

Until `GEMINI_API_KEY` is set in the Pages dashboard, the live site will correctly show
the "not configured" state on `/api/tryon` rather than a fake or broken result.

## Manual deploy (optional)

```
npm run deploy
```

This runs `wrangler pages deploy public` directly, using your local `wrangler` auth
instead of the GitHub integration.
