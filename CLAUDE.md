# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

SUDONPO is a static, multi-page marketing site for a fictional/role-play "host lounge" themed around a Titan-server location. There is no build step and no package manager:

- [index.html](index.html) — the main floor (about, team, weekly VIP, 微醺瞬拍 gallery, guestbook).
- [chapel.html](chapel.html) — the "B1 dark chapel" sub-page, linked from the main nav.
- [menu.html](menu.html) — the menu, split out of `index.html`.
- [dress.html](dress.html) — the 禮服 page.
- [admin.html](admin.html) — self-contained admin console (inline `<style>` + `<script>`); see [docs/admin-setup.md](docs/admin-setup.md).

All copy is Traditional Chinese (繁體中文). There is no framework, bundler, or test suite — files are served as-is.

## Running & deploying

- **Local preview:** open `index.html` directly in a browser, or serve the folder (e.g. `python3 -m http.server`) so relative paths and the Supabase CDN script resolve.
- **Deploy:** GitHub Pages publishes the repo root directly from the `develop` branch ("Deploy from a branch"). Pushing to `develop` *is* releasing — there is no build, no workflow, and **no `main` branch** (it was deleted; `develop` is the only branch).

## Architecture

### Styling
Stylesheets are per-page and independent — each defines its own copy of shared classes (e.g. `.image-slot`), so changing one does not affect the others:

| Page | Stylesheet(s) |
| --- | --- |
| `index.html` | [css/style.css](css/style.css) |
| `chapel.html` | [css/chapel.css](css/chapel.css) |
| `menu.html` | [css/menu.css](css/menu.css) |
| `dress.html` | [css/style.css](css/style.css) + [css/dress.css](css/dress.css) |
| `admin.html` | inline `<style>` |

### Where images come from
**Photos live in Supabase Storage, not in the repo.** At runtime the JS mints a signed URL and assigns it to `element.style.backgroundImage`; `.image-slot` only supplies placeholder styling (crimson fill + centering) and no longer points at any file.

The only committed images in [assets/images/](assets/images/) are `logo-horizontal.png` (used via real `<img>` tags) and `floor1-hero.png` (currently referenced by nothing).

Stale leftovers to be aware of — these are **not** working image references:
- `index.html` (hero diamonds) and `chapel.html` still carry old `.image-<name>` classes (`.image-floor1-hero`, `.image-chapel-*`), but no CSS rule defines them any more, so those slots render as bare placeholders.
- `dress.html` and `css/dress.css` hard-code `assets/images/dress-1.jpg` / `dress-banner.jpg`, which do not exist; [js/dress.js](js/dress.js) overwrites them from Storage at runtime.
- [assets/images/README.md](assets/images/README.md) still documents the retired file-based system.

### JavaScript
All pages use plain `<script>` tags — deliberately **not** ES modules, so the files can be opened straight from `file://`. Load order matters: Supabase CDN bundle → [js/supabase.js](js/supabase.js) (creates the global `supabaseClient`) → the page's own scripts.

- **index.html** → [js/supabase.js](js/supabase.js), [js/gallery.js](js/gallery.js) (team carousels, weekly VIP, 微醺瞬拍), [js/guestbook.js](js/guestbook.js), plus an inline `<script>` for nav scroll state, glitter/sparkle particles, and IntersectionObserver `.reveal` animations.
- **chapel.html** → [js/chapel.js](js/chapel.js) only (hamburger menu, menu tab switching, navbar scroll shadow). No Supabase.
- **dress.html** → [js/supabase.js](js/supabase.js), [js/dress.js](js/dress.js).
- **menu.html** → no JS.
- **admin.html** → inline `<script>`.

### Supabase
The URL and publishable (anon) key are hard-coded in [js/supabase.js](js/supabase.js) and shared by every page.

**Tables**
- `comments` (`user_name`, `message`, `created_at`) — the guestbook ("客之聲") in `index.html`. The latest 50 are fetched and rendered as scrolling **danmaku** (bullet-comment) tracks; the form inserts a row then re-renders. Name is clamped to 5 chars, message to 20, control characters stripped (`clampText` in [js/guestbook.js](js/guestbook.js)).
- `team_members` (`prefix`, `name`, `tag`, `description`, `priority`) — [js/gallery.js](js/gallery.js) renders one card per row ordered by `priority`. The founder card stays hard-coded in `index.html`. `description` is injected as trusted HTML; the other fields are escaped.

**Storage buckets** (all private — JS mints 1-hour signed URLs on each page load)
- `Team` — flat; files are matched by the `<prefix>-` name prefix against each card's `data-prefix`, then sorted numerically. The extension is **not** part of the match, and the bucket currently mixes `.png` and `.jpg` (e.g. `snow-1.png`, `susupo-1.jpg`) — don't assume one.
- `VIP` — a single `vip.png` for the Weekly VIP frame.
- `Voices` — `voices-<n>.png` for 微醺瞬拍, newest-first by `updated_at`, capped at the number of `.photo-cell` slots in the HTML.
- `Dress` — expects `dress-banner.jpg` plus `dress-<n>.jpg`; both `list` and `createSignedUrl` currently come back empty / `not_found`, so `dress.html` shows placeholders. Note the policy in [docs/admin-setup.md](docs/admin-setup.md) only covers `('Team','VIP','Voices')` — `Dress` is missing from it, so "no files uploaded" and "no SELECT policy" are indistinguishable here (see the RLS gotcha below).

Each bucket needs a SELECT policy that the caller's role satisfies.

### Two gotchas that make images silently vanish

**1. RLS denial masquerades as a missing file.** When a Storage SELECT policy doesn't match the caller, the row is filtered out and the API answers `404 / not_found / "Object not found"` — byte-for-byte identical to genuinely asking for a file that doesn't exist. A `not_found` therefore proves nothing about whether the file is there. If the policy is scoped `to anon`, then **being logged in breaks the front end**: [admin.html](admin.html) signs in via `signInWithOAuth`, supabase-js persists that session in `localStorage` per origin, and every later `supabaseClient` call from `index.html` on that same origin sends the user's JWT (role `authenticated`) instead of the anon key — which the `to anon` policy rejects. A logged-out incognito window is the control test. Write read policies with **no `to` clause** so they apply to every role.

**2. Failed photos produce no console error.** Every photo is a CSS background image, so a load failure is silent — an empty slot with a clean console usually means the JS never ran, the signed URL request failed, or the browser is showing a cached older page. Check the Network tab, not the Console. `gallery.js` / `dress.js` log progress under `[Team]` / `[VIP]` / `[Voices]` / `[Dress]` (toggle via `TEAM_DEBUG` / `DRESS_DEBUG`).

## Commits

Follow [git-commit-template](git-commit-template): subject prefixed with one of `[FEATURE]` / `[ENHANCEMENT]` / `[BUGFIX]` / `[DOCS]`, followed by `Description` / `Root Cause` / `Note` fields. Commit messages and responses are written in Traditional Chinese (the `git-commit-convention` skill enforces this).

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs.
In frontend design, this creates what users call the "AI slop"
aesthetic. Avoid this: make creative, distinctive frontends that
surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting.
Avoid generic fonts like Arial and Inter; opt instead for distinctive
choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for
consistency. Dominant colors with sharp accents outperform timid,
evenly-distributed palettes.

Motion: Use animations for effects and micro-interactions.
Focus on high-impact moments: one well-orchestrated page load
with staggered reveals creates more delight than scattered
micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting
to solid colors. Layer CSS gradients, use geometric patterns,
or add contextual effects.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel
genuinely designed for the context.
</frontend_aesthetics>


<use_interesting_fonts>
Typography instantly signals quality. Avoid boring, generic fonts.

Never use: Inter, Roboto, Open Sans, Lato, default system fonts

Impact choices:
- Code aesthetic: JetBrains Mono, Fira Code, Space Grotesk
- Editorial: Playfair Display, Crimson Pro, Fraunces
- Startup: Clash Display, Satoshi, Cabinet Grotesk
- Technical: IBM Plex family, Source Sans 3
- Distinctive: Bricolage Grotesque, Obviously, Newsreader

Pairing principle: High contrast = interesting.
Display + monospace, serif + geometric sans.

Use extremes: 100/200 weight vs 800/900, not 400 vs 600.
Size jumps of 3x+, not 1.5x.
</use_interesting_fonts>
