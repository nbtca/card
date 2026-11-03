# NBTCA Cards

Member ID cards and event passes for the Computer Association of NingboTech University, served from `card.nbtca.space`.

The card effects build on ideas from Jhey Tompkins: the layered parallax and progressive blur of [osaka-card](https://github.com/jh3y/osaka-card), and the video-through-type of the [knockout video card](https://www.jhey.dev/prototypes/2026/knockout-video-card/). The holographic foil follows [pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css).

The bundled fonts, [Bebas Neue](https://github.com/dharmatype/Bebas-Neue) and [Archivo](https://github.com/Omnibus-Type/Archivo), are licensed under the [SIL Open Font License 1.1](https://openfontlicense.org).

## Cards

Both cards live in `src/cards/` and share `tilt.ts`, which follows the pointer on desktop and device orientation on phones. iOS asks for orientation access on the first tap.

- **Member card** (`MemberCard.astro`): a background, a large word, and a transparent portrait stack so the word sits behind the person and the layers drift apart as the card tilts. Five `backdrop-filter` layers blur the bottom edge under the name. Clicking the full-size card flips it to the back.
- **Event pass** (`passes/default.astro`): the template every event uses unless it has its own design. Video plays at the bottom. Above it, a white sheet and a black word blend with `mix-blend-mode: screen`, so the footage shows only through the letters. The holder, details and QR code print on top. An SVG mask cuts the lanyard slot and stub notches.

On an event's page the pass hangs from `Lanyard.astro`: a damped spring the visitor can grab and throw, drawn as an SVG strap, which sleeps once the pass comes to rest. On a valid pass the stub is covered by a sticker. From an hour before the event it peels off (`peel.ts`) to show the entry code; earlier it lifts a little and stops, and the page does not contain the code at all, so a screenshot taken in advance carries nothing. Once staff scan the code, the pass page notices within a few seconds (`ticket.ts` polls `/api/pass`) and tears the stub off along the perforation, leaving a torn edge and an entry stamp. Passes without their own footage play `public/footage/nbtca.mp4`, a 6-second loop rendered on a canvas and encoded with ffmpeg. Sounds are synthesised in `src/lib/sound.ts`, play only after the visitor has interacted, and can be turned off in the footer.

The page around the cards follows the system light or dark setting, and the footer switches between system, light and dark. The cards keep their own colours in both. On the home page, the anatomy view opens as the visitor scrolls, or at the click of its button.

## Designing a pass

Each `.astro` file in `src/cards/passes/` is a pass design, named after the file, and appears in the design menu of the event editor. A design receives `PassProps` from `src/cards/pass.ts`, and `ticket()` there gives it the dates, serial number, check-in state and QR code path, so a new design only decides how they look. Mark elements with `data-bind` to have the editor update them live. Events whose design file is missing fall back to `default`.

## Access

[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/) signs people in through Logto, the same identity provider `photo.nbtca.space` uses. The Worker verifies the Access token, then reads the visitor's Logto name, username and roles from the Access identity endpoint. A request that bypasses Access carries no identity.

Access guards only the paths that need a signed-in visitor. Event pages stay public, and the Worker reads the same `CF_Authorization` cookie there to show a signed-in visitor their pass.

| Who | Can do |
| --- | --- |
| Anyone | See events |
| Anyone who signs in | Claim one pass per event |
| Logto roles in `MEMBER_ROLES` | See every member card, customise their own, start events and edit them, check in passes at `/scan` |
| Logto roles in `ADMIN_ROLES` | Everything members can do, and edit any event |

A member's card appears after their first visit. Its name and alias follow their Logto account; the rest is theirs to set at `/me`. Portraits and backgrounds are re-encoded in the browser to WebP (PNG on Safari, which cannot encode WebP) and served only to members. Event videos are public.

## Check-in

Whoever starts an event gives it a claim window and a start and end time, and sees who claimed and entered on its edit page. Passes can be claimed only inside the window, and checked in from an hour before the event starts until it ends. A scan outside those hours says so and leaves the pass unused.

Each pass carries a QR code for `https://card.nbtca.space/scan#<pass id>`. Staff can scan it on `/scan`, which uses `BarcodeDetector` where available and jsQR elsewhere, or with their phone's camera app, which opens the same page and checks the pass in. A pass checks in once; scanning it again shows when it was used. Passes can also be checked in by event and number.

## Setup

1. In Zero Trust, add a self-hosted application with Logto as the only identity provider and instant authentication on. The reusable policy `Anyone signed in with Logto` admits everyone who signs in with it. Give it these paths on `card.nbtca.space`: `/login`, `/members`, `/me`, `/scan`, `/api` and `/media/members`. The Logto identity provider in Zero Trust must pass the `roles`, `name`, `username` and `picture` OIDC claims; Access hands the Worker only the claims listed there. Put its Application Audience (AUD) tag in `ACCESS_AUD` in `wrangler.jsonc`. Until it is set, nobody can sign in.
2. Create the database and bucket, and copy the D1 ID into `wrangler.jsonc`:

   ```sh
   wrangler d1 create card
   wrangler r2 bucket create card
   ```

3. `pnpm run deploy` builds, applies D1 migrations and deploys. Plain `pnpm deploy` is a different, built-in pnpm command.

Every push to `main` runs type checks and a build in GitHub Actions, then deploys. Pull requests run the checks only. The `production` environment needs a `CLOUDFLARE_API_TOKEN` secret with Workers Scripts Edit, D1 Edit and Workers R2 Storage Edit on the account, and Workers Routes Edit on the `nbtca.space` zone. Migrations run before the new code, so write each one to work with the previous release too.

## Development

```sh
pnpm install
pnpm preview      # production build on local workerd with local D1 and R2
pnpm typecheck
```

Access does not run locally. To test signed-in pages, serve a JWKS from a local issuer, start `wrangler dev` with `--var ACCESS_TEAM_DOMAIN:<issuer> --var ACCESS_AUD:<aud>`, and send RS256 tokens it signed in the `CF_Authorization` cookie.
