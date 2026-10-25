# MyVideoPlayer

Single-page video portfolio: a hero `<video>`, a title/description panel, and a strip of thumbnails below it. Clicking a thumbnail plays that video in the hero. The video list comes from Supabase. Plain HTML, CSS and JavaScript (ES modules), with no build step, framework or npm dependencies.

- Live: https://claude-demo-fall2026.vercel.app
- Repo: https://github.com/howardbeaver/claude-demo-fall2026 (public; every push to `main` redeploys on Vercel)

## Files

```
index.html       page shell (header, hero, info panel, empty gallery, footer)
css/style.css    all styles; design tokens on :root
js/main.js       loads videos from Supabase, builds the gallery, hero switching, phone menu
js/supabase-config.js  Supabase project URL + publishable key (public by design), mediaUrl()
admin/           /admin page: index.html, admin.css, admin.js (sign-in + video list)
supabase/setup.sql     tables, RLS policies, storage bucket, seed rows (run in the SQL Editor)
dev-server.py    local server with HTTP Range support (dev only)
images/          background.jpg, favicon.svg
posters/, video/  the original 3 videos: used only as the fallback when Supabase is unreachable
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

- The layout was measured from the 1200x800 mockup, so keep desktop pixel-faithful to it. Header and footer are 68px bars of `rgba(255,255,255,0.62)`. The hero is 656px wide with an 8px `#131c55` border. Below it, the title/description panel (glass, same width) and the gallery strip (`#143055`, also 656px wide, 14px gaps, 8px/16px padding) hold fixed 143x105 thumbnails, about 4 per row, wrapping and centered. The logo is bold Courier New at 30px, and the nav is Helvetica at 18px.
- Colors live in `:root` (`--navy`, `--navy-strip`, `--ink`, `--sky`, `--glass`). Reuse them rather than adding new hex values.
- **Breakpoint at 600px.** At that width and below, the nav collapses behind a hamburger dropdown, and the thumbnails stack in one column at their native 143px so they stay sharp.
- The background image sits on a fixed `body::before` layer, because iOS Safari ignores `background-attachment: fixed`.
- There's no Sign in link (deliberately left out for now). About, Events, Contact and the footer text are placeholders (`href="#"`).

## Player behavior (js/main.js)

- On load, `fetchVideos()` calls the Supabase REST API directly with `fetch` and the publishable key (no supabase-js on the public page). It gets published rows ordered by `position`, with a 4-second timeout. Media URLs come from `mediaUrl(path)`.
- If the fetch fails, it falls back to `BUNDLED_VIDEOS` (the repo's 3 files) and logs a console warning. An empty list shows "No videos yet" instead.
- The gallery and info panel are built from that list with `createElement`/`textContent`. Never use `innerHTML` with database text.
- **Call `hero.play()` synchronously inside the click handler.** Safari only allows playback started directly by a user action.
- Clicking the active thumbnail restarts its video instead of reloading it.
- The playing thumbnail gets `aria-current="true"`, which also draws its light-blue outline. A visually hidden `#now-playing` live region announces the change to screen readers.
- The hero is `muted playsinline`, and the first video starts with a muted `play()` once the list loads. When reduced motion is requested, it doesn't autoplay. The videos have no audio tracks.
- Poster frames are preloaded after `load`, so switching never shows a blank player.

## Adding a video

No code change is needed: videos live in Supabase. Until the admin upload page exists (M10), add one by hand:

1. Encode it with `ffmpeg -movflags +faststart` so the moov atom comes before mdat. This avoids stalls in production.
2. In the dashboard, upload to the `media` bucket: `videos/<name>.mp4`, `thumbs/<name>.png` (143x105) and `posters/<name>.jpg` (same aspect ratio as the video; the current ones are 1472x1080).
3. Insert a `videos` row with those paths, a title, a description, and the next `position`.

## Supabase (admin back end, M7+)

Project `eweximsjuwzvtrynscdg` (East US) holds the video list, uploaded files and the admin login.

- **`videos` table:** title, description, `video_path`/`thumb_path`/`poster_path` (paths inside the `media` bucket), `position` (gallery order, lowest first), `published`.
- **`media` storage bucket:** public, so files are readable by URL with Range support. Folders are `videos/`, `thumbs/` and `posters/`. The limit is 50 MB per file, and only mp4/png/jpeg/webp are allowed.
- **Security comes from RLS, not from hiding pages.** Anyone can read published rows. Writes and uploads require `public.is_admin()`, which is true only for users in `public.admins`. Public sign-up is off, and the user is the only account.
- `supabase/setup.sql` is idempotent. Re-run it in the SQL Editor after changing it, and keep it as the source of truth for the schema.
- Use only the publishable key in code. Never ask for, or commit, the secret / `service_role` key or the database password. Claude doesn't create accounts or enter passwords. The user does those in the dashboard.
- Plan: M8 public page reads from the DB · M9 `/admin` sign-in · M10 uploads · M11 reorder/edit/delete · M12 security review + deploy.

## Admin page (admin/)

- Served at `/admin` and `/admin/`, so `admin/index.html` uses root-absolute paths (`/css/style.css`, `/admin/admin.js`). Module imports inside `admin.js` stay relative.
- Uses supabase-js **2.117.3**, pinned and loaded as ESM from jsDelivr (no npm). The public page doesn't load it.
- **Flow:** remembered session (localStorage) or `signInWithPassword` → `rpc('is_admin')` → dashboard. A non-admin is signed straight out. There's no sign-up or password-reset link.
- If the user loses the password, delete the user in Authentication → Users, add a new one, and re-run `supabase/setup.sql`. The admins row cascades on delete, and the script re-adds the only user.
- The page carries `noindex`, and the public site doesn't link to it. Neither is a security measure; RLS is.
- **Testing:** Claude can't type the user's password, so the user signs in for signed-in tests. Signing out clears the session, and they'll need to sign in again.

## Deploy

Vercel serves the repo root as a static site (Framework Preset: Other, no build command). `vercel.json` only redirects `/admin` → `/admin/`, because Vercel returns 404 for the slashless directory URL. Asset paths must stay relative and match the filenames' case exactly, because Vercel's filesystem is case-sensitive and macOS isn't.

## Working agreements

- Build in milestones, and commit at the end of each one with a message starting with its ID (`M1: …`, `M2: …`).
- When something needs clarifying, ask the user one question at a time.
- Verify changes in the browser preview at 1200x800 (desktop) and 375px (phone) before committing.
- This project was started from scratch. Don't copy code from the user's older video player project.
