# Gull Drop

First-person seagull sandbox over a parody Atlantic City boardwalk. You fly, you dump, you run the family. Squirrel mafia on the rails. Cart vendors on the boards. Captive marks on Steel Pier.

## Play

WASD fly. Mouse look. Click to drop. F / right-click to swarm. Space climb, Shift dive. Q/E roll. Hold R to level out.

Music is separate from screams. Note icon mutes the radio. Speaker mutes effects.

## Run locally

```bash
npm install
npm run dev
```

Opens on port 8080.

## Stripe webhook configuration

Set `STRIPE_WEBHOOK_SECRET` in the production environment before accepting
payments. In Stripe Dashboard, open Developers → Webhooks, create an endpoint
for `https://gulldrop.replit.app/api/stripe/webhook`, and copy its signing
secret (the value beginning `whsec_`) into the Replit production Secret with
that exact name. Deployment readiness is reported by
`GET /api/stripe/webhook/status`; it must report `configured: true`. Never put
the signing secret in source control or client code.

## Stack

React, Three.js, TanStack Start, Zustand. Boardwalk radio uses YouTube embeds of [Russell Nomer](https://www.youtube.com/@russellnomermusic/releases) tracks.

## Repo

https://github.com/russellnomer/GullDropGame
