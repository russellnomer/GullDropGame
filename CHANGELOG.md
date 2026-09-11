# Changelog

## 2026-09-11 — Readable Gull chase view and honest poop aiming

- Reframed Gull mode so the complete bird silhouette—head, wings, body, and tail—stays visible below the crosshair.
- Corrected the chase-model forward axis so the Gull faces the same direction it flies.
- Added a small non-graphic cloacal marker and a visible release animation from the bird toward the aiming line.
- Refined the release pose from photo references with broad bracing wings, a lifted tail, tucked feet, and an irregular trailing stream.
- Converted poop from a forward assisted projectile into a gravity-driven bomb that inherits the Gull's momentum, with a separate sight below the bird.
- Replaced the fixed drop-zone marker with a projected impact reticle calculated from current altitude, velocity, gravity, and surface height.
- Added a brief body-lift pose when dropping for clearer comic action.
- Made locked shots compensate for projectile gravity while unlocked shots follow the center reticle at a more usable speed.

## 2026-09-11 — Replit product analytics events

- Connected the existing anonymous game-event wrapper to Replit's injected Umami tracker for published builds.
- Added signup and shop-upgrade funnel events while retaining visit, activation, round completion, sharing, checkout, payment, and gameplay events.
- Kept local development safe when analytics is unavailable and excluded user IDs, names, emails, and free-form content.

## 2026-09-11 — Aerial Atlantic City skyline landmarks

- Used the supplied aerial reference to add the large dark casino dome and a layered historic mansard roofline.
- Positioned both forms on existing oceanfront buildings to strengthen navigation and skyline recognition during Gull flight.
- Kept existing collision footprints unchanged and reduced geometry detail on coarse-pointer devices.

## 2026-09-10 — Reference-led Atlantic City boardwalk details

- Used the supplied boardwalk photographs to add the dune edge, sand fencing, paired municipal bins, and denser promenade street furniture.
- Kept the details static and non-colliding so the visual upgrade does not affect flight, scoring, or pedestrian movement.
- Used instanced geometry for long repeated details to limit draw-call cost on mobile devices.

## 2026-09-10 — Standard change: restore Gull Drop publishing

- Fixed the merged courtship module and game engine using incompatible update interfaces, which caused the TypeScript production build to fail.
- Removed the invalid courtship cleanup call that produced browser warnings after hot reload.
- Requested by the project owner after publish build failure.
- Risk is low and limited to courtship animation options; rollback by reverting this change if courtship playback regresses.

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
