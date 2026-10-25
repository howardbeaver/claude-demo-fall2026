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

Hosted on Vercel as a static site (M6).
