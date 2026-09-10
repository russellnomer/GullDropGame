# Gull Drop

A first-person Three.js seagull sandbox game set over a parody Atlantic City boardwalk.

## Run & Operate

- `pnpm --filter @workspace/gull-drop-game run dev` — run the game through its managed workflow
- `pnpm --filter @workspace/gull-drop-game run typecheck` — check the game source
- `pnpm --filter @workspace/gull-drop-game run build` — create the static production bundle
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- No game-specific secrets or database are required.

## Stack

- pnpm workspace, TypeScript, React 19, Vite
- Three.js for the first-person 3D game
- Zustand for gameplay and UI state
- Tailwind CSS for overlays and menus
- Static production hosting

## Where things live

- `artifacts/gull-drop-game/src/game/` — game engine, world, input, NPC, audio, and progression systems
- `artifacts/gull-drop-game/src/components/` — canvas, HUD, menus, shop, and blotter UI
- `artifacts/gull-drop-game/public/game/` — game textures and media
- `artifacts/gull-drop-game/src/index.css` — visual tokens and global styles

## Architecture decisions

- The imported TanStack Start shell was reduced to a static Vite client because the playable game does not require SSR or authentication.
- Asset URLs are derived from Vite's base URL so previews and published builds resolve textures correctly.
- Optional shop and blotter services degrade safely in the standalone build rather than blocking gameplay.

## Product

- Fly freely over the boardwalk using mouse, keyboard, or touch controls.
- Drop on targets, build combos, raise wanted levels, complete contracts, and command the gull flock.
- Control effects and boardwalk radio independently.
- Review instructions, scores, and optional shop content from the game menu.

## User preferences

- Preserve the imported game's identity and gameplay while making it hostable and publishable.

## Gotchas

- The game requires WebGL in the browser; headless screenshot environments may not create a WebGL context.
- Run the game through its managed workflow so `PORT` and `BASE_PATH` are supplied.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
