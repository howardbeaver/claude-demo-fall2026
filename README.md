# MyVideoPlayer

A single-page video portfolio: a hero player with a thumbnail gallery below it. Plain HTML, CSS and JavaScript, no build step.

## Structure

```
index.html
dev-server.py  local server with Range support (dev only)
css/style.css
js/main.js
images/    background.jpg
posters/   sue-vid1..3-thumb.png (gallery thumbnails)
video/     sue-vid1..3.mp4
```

## Run locally

```bash
python3 dev-server.py
```

Then open http://localhost:8000. Pass a port to use another one: `python3 dev-server.py 8080`.

Use `dev-server.py` rather than `python3 -m http.server`: the built-in server ignores HTTP Range requests, and Safari will not play `<video>` without them (the player stays black). The dev server also sends `Cache-Control: no-cache` so edits show up on a normal refresh.

## Deploy

Hosted on Vercel as a static site, deployed from the GitHub repo
[howardbeaver/claude-demo-fall2026](https://github.com/howardbeaver/claude-demo-fall2026).
There is no build step. `vercel.json` redirects `/admin` to `/admin/` (Vercel 404s the slashless form) and sets the security headers (Content-Security-Policy and friends); `dev-server.py` sends the same headers locally.

First-time setup:

1. On vercel.com choose **Add New… → Project**, then import `claude-demo-fall2026` from GitHub.
2. Set **Framework Preset** to **Other**. Leave Build Command and Output Directory empty.
3. Click **Deploy**.

After that, every push to `main` redeploys the live site, and pushes to other branches get their own preview URL.

`.vercelignore` keeps dev-only files (`dev-server.py`, `.claude/`, this README) off the live site. Vercel serves video with Range support, so Safari plays it without the dev server.
