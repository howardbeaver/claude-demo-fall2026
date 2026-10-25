# MyVideoPlayer

Single-page video portfolio: a hero `<video>` with a strip of three thumbnails below it. Clicking a thumbnail plays that video in the hero. Plain HTML, CSS and JavaScript, with no build step, framework or dependencies.

- Live: https://claude-demo-fall2026.vercel.app
- Repo: https://github.com/howardbeaver/claude-demo-fall2026 (public; every push to `main` redeploys on Vercel)

## Files

```
index.html       all markup (header, hero video, gallery, footer)
css/style.css    all styles; design tokens on :root
js/main.js       thumbnail switching + phone hamburger menu
js/supabase-config.js  Supabase project URL + publishable key (public by design)
supabase/setup.sql     tables, RLS policies, storage bucket, seed rows (run in the SQL Editor)
dev-server.py    local server with HTTP Range support (dev only)
images/          background.jpg, favicon.svg
posters/         sue-vidN-thumb.png (143x105 thumbnails), sue-vidN-frame.jpg (1200x880 hero posters)
video/           sue-vid1..3.mp4
.vercelignore    keeps dev-only files off the live site
```

`cursor-demo.jpg` (the design mockup) and `Claude prompts 2.rtf` are local reference files. They are intentionally untracked, so don't commit them.

## Run locally

```bash
python3 dev-server.py
```

Serves http://localhost:8000. Gotchas:

- **Don't use `python3 -m http.server`.** It ignores Range requests, and Safari won't play `<video>` without them, so the player stays black.
- **Start the server in a Terminal-panel tab, not with `preview_start`.** macOS privacy blocks the app's preview runner from reading `~/Desktop`. `.claude/launch.json` only attaches the preview to the already-running server on port 8000.
- **Editing `index.html` makes the app open a `file://` preview tab.** That tab shows the page unstyled with a black video. Close it and use the `localhost:8000` tab.

## Design

- The layout was measured from the 1200x800 mockup, so keep desktop pixel-faithful to it. Header and footer are 68px bars of `rgba(255,255,255,0.62)`. The hero is 656px wide with an 8px `#131c55` border. The gallery strip is `#143055`, with 14px gaps and 8px/16px padding. The logo is bold Courier New at 30px, and the nav is Helvetica at 18px.
- Colors live in `:root` (`--navy`, `--navy-strip`, `--ink`, `--sky`, `--glass`). Reuse them rather than adding new hex values.
- **Breakpoint at 600px.** At that width and below, the nav collapses behind a hamburger dropdown, and the thumbnails stack in one column at their native 143px so they stay sharp.
- The background image sits on a fixed `body::before` layer, because iOS Safari ignores `background-attachment: fixed`.
- There's no Sign in link (deliberately left out for now). About, Events, Contact and the footer text are placeholders (`href="#"`).

## Player behavior (js/main.js)

- Each thumbnail is a `<button class="thumb">` with these attributes: `data-video`, `data-poster`, `data-title` and `aria-label`.
- **Call `hero.play()` synchronously inside the click handler.** Safari only allows playback started directly by a user action.
- Clicking the active thumbnail restarts its video instead of reloading it.
- The playing thumbnail gets `aria-current="true"`, which also draws its light-blue outline. A visually hidden `#now-playing` live region announces the change to screen readers.
- The hero has `autoplay muted playsinline`. When reduced motion is requested, it doesn't autoplay. The videos have no audio tracks.
- Poster frames are preloaded after `load`, so switching never shows a blank player.

## Adding a video

1. Encode it with `ffmpeg -movflags +faststart` so the moov atom comes before mdat. This avoids stalls in production.
2. Add `video/sue-vidN.mp4`, `posters/sue-vidN-thumb.png` (143x105) and `posters/sue-vidN-frame.jpg` (same aspect ratio as the video; the current ones are 1472x1080).
3. Copy a `<li>` in the gallery and update its `data-*` attributes and `aria-label`.
4. At desktop width the strip is sized for three thumbnails (489px), so a fourth needs a design decision.

## Supabase (admin back end, M7+)

Project `eweximsjuwzvtrynscdg` (East US) holds the video list, uploaded files and the admin login.

- **`videos` table:** title, description, `video_path`/`thumb_path`/`poster_path` (paths inside the `media` bucket), `position` (gallery order, lowest first), `published`.
- **`media` storage bucket:** public, so files are readable by URL with Range support. Folders are `videos/`, `thumbs/` and `posters/`. The limit is 50 MB per file, and only mp4/png/jpeg/webp are allowed.
- **Security comes from RLS, not from hiding pages.** Anyone can read published rows. Writes and uploads require `public.is_admin()`, which is true only for users in `public.admins`. Public sign-up is off, and the user is the only account.
- `supabase/setup.sql` is idempotent. Re-run it in the SQL Editor after changing it, and keep it as the source of truth for the schema.
- Use only the publishable key in code. Never ask for, or commit, the secret / `service_role` key or the database password. Claude doesn't create accounts or enter passwords. The user does those in the dashboard.
- Plan: M8 public page reads from the DB · M9 `/admin` sign-in · M10 uploads · M11 reorder/edit/delete · M12 security review + deploy.

## Deploy

Vercel serves the repo root as a static site (Framework Preset: Other, no build command, no `vercel.json`). Asset paths must stay relative and match the filenames' case exactly, because Vercel's filesystem is case-sensitive and macOS isn't.

## Working agreements

- Build in milestones, and commit at the end of each one with a message starting with its ID (`M1: …`, `M2: …`).
- When something needs clarifying, ask the user one question at a time.
- Verify changes in the browser preview at 1200x800 (desktop) and 375px (phone) before committing.
- This project was started from scratch. Don't copy code from the user's older video player project.
