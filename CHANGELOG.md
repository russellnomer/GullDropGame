# Changelog

## 2026-09-10 — Non-explicit animal courtship comedy

- Added distinct background courtship scenes for Gull and Squirrel modes with mutual approaches, species-specific displays, gifts, approval, opaque privacy props, and slapstick aftermaths.
- Kept both animals completely hidden during the offscreen punchline; no explicit anatomy, silhouettes, or sexual motion are shown.
- Added deterministic cooldowns and animation, predator/player interruption, reduced-motion simplification, fixed effect pools, exact round reset, and GPU resource cleanup.
- Kept courtship isolated from scoring, targeting, challenges, purchases, progression, and leaderboard systems.
- Added focused regression checks for state progression, privacy safety, mode isolation, interruption, reset, and prohibited state or asset names.

## 2026-09-10 — Mafia Squirrel controls and skills

- Corrected Mafia Squirrel movement facing and acorn-gun muzzle direction.
- Added contextual jump, climb, pounce, scratch, bite, nest-building, and human tribute actions.
- Added narrow-screen touch controls and updated Mafia instructions for the new skill set.
- Raised the boardwalk visually with structural pilings, added wooden beach gates and nest pockets, and added an ocean-facing pier with under-deck habitat.
- Added earn-or-buy-early Mafia weapon progression, separated Armed scores from Classic Gull rankings, and made touch controls adapt to phone/tablet input with safe-area support.
- Added the fictional Fizz Bomb, a wide-area foaming weapon that grounds nearby AI gulls without using real medication branding.

## 2026-09-10 — Durable Gull Drop fulfillment

- Added signed Stripe webhooks, replay-safe event ledger, PostgreSQL purchases,
  revocation, and device entitlements.
- Added durable entitlement synchronization and opaque device identifiers.

## 2026-09-08 — Squirrel Visual Anatomy Redesign

- Redesigned playable and NPC mafia squirrels from simple geometric blobs to believable adult squirrel anatomy with realistic posture and fur colors.
- Replaced the previous cylindrical tail with a sweeping, segmented curved tail plume offset to avoid blocking the crosshair.
- Added subtle, deterministic tail sway animation based on simulation time and walk cycle.
- Polished anatomical grouping and preserved hitboxes, gameplay origins, and weapon functionality.

## 2026-09-08 — Dog Walkers & Shark Threats

- Added procedural dog walkers to boardwalk and beach areas with physics-free leashes and custom walk cycles.
- Added separated hit zones for dogs and walkers with distinct slapstick reactions, point values, and UI callouts.
- Added tracking and explicit UI counters for dog walkers and dogs hit at the end of round screen.
- Added submerged procedural sharks patrolling the ocean bounds in Gull mode.
- Sharks telegraph with an exposed fin before executing a dramatic breach attack when the player flies low over water.
- A shark bite produces a non-graphic splash, camera trauma, a clear HUD warning, and routes through standard damage and grounding recovery.
- Added privacy-safe analytics events for `dog_walker_hit`, `dog_hit`, `shark_breach`, and `shark_attack`.

## 2026-09-08 — Boardwalk War Expansion (Mafia Mode & Cats)

- Added a fully playable "Mafia" game mode alongside the original "Gull" mode.
- Play as the Don (squirrel) with WASD/touch third-person movement and acorn-shooting capabilities.
- Added Tribute nodes to extort respect from boardwalk businesses and vendors.
- Added Stray Cats system: procedural cats that groom, stalk, chase, and steal unbanked tribute.
- Added AI enemy gulls to Mafia mode for high-value mid-air shootdowns.
- Implemented mode-aware analytics, health tracking, chain combo UI, and dynamic results screen.

## 2026-09-08 — Squirrel Rig Redesign

- Full visual overhaul of the Mafia Squirrel rig, replacing the balloon-animal/log-tail look with believable adult gray squirrel anatomy.
- Added forward tapered torso, cream belly/throat, articulated forearms, and powerful digitigrade hind legs.
- Replaced the simple log tail with a broad, curved, fanned, and tapered plume tail built from segmented hierarchy.
- Refitted the fedora naturally to the head, maintained existing collision and hitboxes, and added a subtle tail flick driven deterministically by the walk cycle.

## 2026-09-08 — Atlantic City cinematic realism expansion

- Expanded flight inland through casino rooftops, Pacific Avenue, residential blocks, and the Atlantic Expressway.
- Added rooftop pools, slots, tables, a craps pit, targetable VIPs, and an 8,000-point craps pit boss.
- Added moving, poopable buses and cars using a fixed performance-conscious vehicle pool.
- Rebuilt gull, human, and squirrel anatomy with rounded/tapered forms; mafia squirrels now have dimensional outfits, animated limbs, and acorn guns.
- Added weathered façades, rooftop HVAC equipment, sidewalks, curbs, utility poles, dumpsters, road grime, and grounded golden-hour atmosphere.
- Added varied procedural victim reactions with distinct authority, VIP, and pit-boss casino-jackpot audio.
- Corrected chase-gull visibility, layer lighting, and terrain/rooftop-aware wing-shadow contact.

## 2026-09-08 — Direct Stripe environment credentials

- Removed Gull Drop checkout's runtime dependency on the Replit Stripe connector.
- Production Stripe requests now use `STRIPE_SECRET_KEY`; development requests use `STRIPE_SANDBOX_SECRET_KEY`.
- Kept all pricing, fulfillment, device-binding, and paid-status validation on the server.

## 2026-09-08

### Gull Drop viral challenge and commerce loop
- Added moderated, expiring challenge links with shared run seeds, target scores, attribution, challenge entry, and rematches.
- Added a branded wrap-sheet result card with native sharing, copy, and downloadable PNG output.
- Added three one-time cosmetic offers and removed all paid score, cooldown, and flock-size advantages.
- Added Stripe Checkout creation and server-side payment verification before local entitlement fulfillment.
- Added anonymous funnel analytics for challenge, play, share, return, checkout, payment, and attribution events.
