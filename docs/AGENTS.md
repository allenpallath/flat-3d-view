# Team brief (read fully before starting)

Project: walkable, **to-scale**, realistic 3D model of apartment Type C (2BHK) in the browser, used to plan furniture, plug points, switches and TV position. Reference drawing: `public/floorplan-c.webp` (1600×1200 px; plan cm → px: `px = 300 + x*1.12`, `py = 100 + z*1.12`).

Stack: Vite + TypeScript + React 19 + @react-three/fiber 9 + @react-three/drei 10 + @react-three/postprocessing 3 + three 0.180 + zustand 5. Already installed. Do not add dependencies without a strong reason (say so in your report if you do; `npm i` works, but the internet is otherwise blocked, so **no downloading textures/HDRIs/models** — generate textures procedurally with canvas / DataTexture, build furniture from primitives/ExtrudeGeometry/RoundedBox, use `RoomEnvironment` or drei `<Environment>` with `<Lightformer>`s, drei `<Sky>` for the sky).

## Conventions (non-negotiable)
- Plan data is in **cm**; scene units are **metres** (`toM()` in `src/data/schema.ts`). +x east, +z south, y up. Origin = NW interior corner of the hall.
- Yaw: degrees about +Y, 0 = looking north (-z), positive = turning left (counter-clockwise from above), i.e. three.js `rotation.y`.
- Source of truth for the building: `src/data/planC.ts` (rooms, walls with openings, fixed fixtures). Helpers: `src/data/geometry.ts` (`wallBoxes`, `staticColliders`, `roomAt`, `planBounds`, `openingRect`, `DOOR_KINDS`, `wrapDeg`, ...), `src/data/tv.ts` (TV sizes). Put geometry shared by two modules there instead of duplicating it.
- Shared state: `src/store.ts` (zustand). Dev / test hooks: `window.__store` (e.g. `__store.getState().requestTeleport(165, 300, -90)` / `set({mode:'dollhouse'})`), `window.__scene`, `window.__gizmoDragging`, and `window.__perf` with `?perf` (used by `tests/e2e/memory.mjs`).
- Materials: always use `getMaterials()[key]` from `src/materials/materials.ts` for surfaces it lists.
- Mesh tags: put `userData` from `MeshTag` (schema.ts) on raycastable meshes: walls `{kind:'wall', wallId}`, floors `{kind:'floor', roomId}`, furniture `{kind:'furniture', itemId}`, electrical points `{kind:'point', pointId}`.
- Clicks vs. drags: in every mode the user looks/orbits by dragging. Tools must treat an R3F click as a click only if `e.delta <= 5` (pixels moved). Call `e.stopPropagation()` when you consume a click.
- Walk mode look = left-drag on the canvas (no pointer lock by default; optional pointer lock toggled with the `L` key / HUD button). WASD/arrows move, Shift = run, `E` = toggle nearest door.
- `mode`: 'walk' (first-person, ceilings on), 'dollhouse' (orbit from above, ceilings hidden), 'plan' (top-down orthographic-ish, walls cut to 120 cm).
- DOM layout regions (avoid overlap): Toolbar = top centre (A6). Minimap = top-right ~220 px (A3). Tool side panel = left, 300 px wide, only when its tool is active: furniture (A4) / electrical (A5). HUD = bottom centre (A6). Touch joystick = bottom-left, touch look-pad = bottom-right (A3). Panels must be usable on a phone (collapse/scroll).
- UI style: dark translucent panels (`rgba(20,22,26,0.82)`, blur backdrop, 10 px radius, white text, 13 px system font, accent `#e0a64a`).

## File ownership — edit ONLY your own folder
(This split was used for the initial parallel build; when agents work in parallel again, the manager states the current split.)
| Agent | Owns |
|---|---|
| A1 Architecture | `src/architecture/**` |
| A2 Materials & Lighting | `src/materials/**` |
| A3 Navigation | `src/navigation/**` |
| A4 Furniture planner | `src/planner/**` |
| A5 Electrical planner | `src/electrical/**` |
| A6 UI & QA | `src/ui/**`, `tests/**` |
| Manager | `src/App.tsx`, `src/main.tsx`, `src/store.ts`, `src/data/**`, `package.json`, this file |

Keep each module's default export name/props as wired in `src/App.tsx`. Need a change to a shared file (store field, schema type, plan data)? **Don't edit it**: put the exact proposed diff in your final report and work around it locally meanwhile. Do **not** run `git commit`/`git push`; the manager integrates. Others are editing their folders at the same time, so if `tsc` errors come from someone else's folder, ignore them.

## Verify your work
- `npx tsc --noEmit` (your files clean) and `npx vitest run`.
- Screenshot: start a dev server on **your port** (A1 5181, A2 5182, A3 5183, A4 5184, A5 5185, A6 5186) with `npx vite --port <port> --strictPort &`, then `node tests/e2e/shot.mjs http://localhost:<port> <scratch>/x.png "<js to run first>"` and look at the PNG. It prints console errors. Kill your server when done (`pkill -f "port <port>"`).
- Final report: what you built, files, how to use it, any proposed shared-file diffs, known issues. Keep it under 300 words.
