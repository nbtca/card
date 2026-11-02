# NBTCA Cards

Member ID cards and event passes for the Computer Association of NingboTech University, served from `card.nbtca.space`.

The card effects build on ideas from Jhey Tompkins: the layered parallax and progressive blur of [osaka-card](https://github.com/jh3y/osaka-card), and the video-through-type of the [knockout video card](https://www.jhey.dev/prototypes/2026/knockout-video-card/). The holographic foil follows [pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css).

The bundled fonts, [Bebas Neue](https://github.com/dharmatype/Bebas-Neue) and [Archivo](https://github.com/Omnibus-Type/Archivo), are licensed under the [SIL Open Font License 1.1](https://openfontlicense.org).

## Cards

Both cards live in `src/cards/` and share `tilt.ts`, which follows the pointer on desktop and device orientation on phones. iOS asks for orientation access on the first tap.

- **Member card** (`MemberCard.astro`): a background, a large word, and a transparent portrait stack so the word sits behind the person and the layers drift apart as the card tilts. Five `backdrop-filter` layers blur the bottom edge under the name. Clicking the full-size card flips it to the back.
- **Event pass** (`passes/default.astro`): the template every event uses unless it has its own design. Video plays at the bottom. Above it, a white sheet and a black word blend with `mix-blend-mode: screen`, so the footage shows only through the letters. The holder, details and QR code print on top. An SVG mask cuts the lanyard slot and stub notches.

## Designing a pass

Each `.astro` file in `src/cards/passes/` is a pass design, named after the file, and appears in the design menu on `/admin`. A design receives `PassProps` from `src/cards/pass.ts`, and `ticket()` there gives it the dates, serial number, check-in state and QR code path, so a new design only decides how they look. Events whose design file is missing fall back to `default`.

## Access

Everyone signs in through Logto. On each sign-in the Worker calls Saturday's `GET /member` with the user's Logto access token. Saturday answers only for accounts bound to a member, and the Worker copies that member's name, alias, section, role, avatar and GitHub ID into D1.

| Who | Can do |
| --- | --- |
| Anyone | See open events |
| Signed-in users | Claim one pass per event |
| Members | See every member card, customise their own, check in passes at `/scan` |
| Members with the Saturday `admin` role | Create and edit events at `/admin`, see who claimed and entered |

Member cards appear in the directory after the member's first sign-in. Portraits and backgrounds are re-encoded in the browser to WebP (PNG on Safari, which cannot encode WebP) and served only to signed-in members. Event videos are public.

## Check-in

Each pass carries a QR code for `https://card.nbtca.space/scan#<pass id>`. Staff can scan it on `/scan`, which uses `BarcodeDetector` where available and jsQR elsewhere, or with their phone's camera app, which opens the same page and checks the pass in. A pass checks in once; scanning it again shows when it was used. Passes can also be checked in by event and number.

## Setup

1. In Logto, create a Traditional Web application with the redirect URI `https://card.nbtca.space/callback` and the post sign-out redirect URI `https://card.nbtca.space`. Put its app ID in `LOGTO_APP_ID` in `wrangler.jsonc`.
2. Create the resources and copy the D1 ID into `wrangler.jsonc`:

   ```sh
   wrangler d1 create card
   wrangler r2 bucket create card
   wrangler secret put LOGTO_APP_SECRET
   wrangler secret put SESSION_SECRET   # any random string of 32+ bytes
   ```

3. `pnpm run deploy` builds, applies D1 migrations and deploys. Plain `pnpm deploy` is a different, built-in pnpm command.

Every push to `main` runs type checks and a build in GitHub Actions, then deploys. Pull requests run the checks only. The `production` environment needs a `CLOUDFLARE_API_TOKEN` secret with Workers Scripts Edit, D1 Edit and Workers R2 Storage Edit on the account, and Workers Routes Edit on the `nbtca.space` zone. Migrations run before the new code, so write each one to work with the previous release too.

## Development

```sh
pnpm install
cp .dev.vars.example .dev.vars
pnpm preview      # production build on local workerd with local D1 and R2
pnpm typecheck
```

`wrangler dev` serves the app as `card.nbtca.space` because of the custom domain route, so Logto sign-in does not complete locally. Test signed-in pages with a `card_session` cookie signed with the local `SESSION_SECRET`; `src/lib/session.ts` shows the format.
