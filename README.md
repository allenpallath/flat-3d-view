# flat-3d-view

A walkable, **to-scale** 3D model of apartment **Type C (2BHK)** that runs in the browser. Walk through every room, plan furniture, place plug points and switches, and pick the TV position and size before the builder starts the interiors.

Built with Three.js through React Three Fiber, drei, postprocessing and zustand, using Vite and TypeScript. It uses no downloaded assets: every texture and piece of furniture is generated in code.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL. On a phone on the same Wi-Fi, use the "Network" URL.

```bash
npm test
```

`npm test` runs the scale tests. Every room must match the size printed on the drawing.

```bash
npm run build
```

`npm run build` produces a static site in `dist/` that you can host anywhere (GitHub Pages, Netlify, etc.).

## Using it

| Mode | What it's for |
|---|---|
| **Walk** | First person at eye height (160 cm, adjustable). Drag to look, **WASD/arrows** to move, **Shift** to run, **E** to open or close the nearest door, **L** for mouse-lock look. **Zoom** for a wider or closer view: scroll the mouse wheel, pinch, press **−** / **+**, or use the − / + buttons above the room name (**0** or clicking the zoom value resets it). On phones, use the joystick and look pad. |
| **Dollhouse** | Orbit around the flat from above, with the ceilings removed. |
| **Plan** | Top-down view with walls cut at 120 cm. Turn on **Overlay** to see the original drawing on the floor as a scale check. |

- **Minimap** (top right): click a room to jump there.
- **Furniture tool:**
  - The catalog has 54 items at real Indian-market sizes, including TVs from 43" to 75".
  - Click an item to select it. Drag the gizmo to move it in 5 cm steps. **R** rotates it 90°, **G** switches the gizmo to rotate, **Alt+arrows** nudge it, **Del** deletes it.
  - A selected item shows its live distance to the nearest wall on each side.
  - "Load suggested layout" places the furniture from the drawing.
- **Electrical tool:**
  - Choose a point type (6A or 16A socket, switchboard, TV, LAN, AC, light, fan, USB) and click a wall. Points snap to standard heights; hold Shift to use the cursor height instead.
  - A selected point shows its height and its distance from the nearest corner.
  - A TV point also shows a TV-size outline and the ideal seating distance.
  - "Load suggested points" adds a starter set for every room.
  - **Export CSV** gives the electrician a schedule of points (room, wall, height, distance from corner).
- **Measure tool:** click two points to get the distance in cm and ft-in. Hold Shift to lock to an axis.
- **Save / Load** (toolbar): the whole plan (furniture and points) as a JSON file. It also autosaves in the browser.

## Scale and assumptions

All geometry comes from `src/data/planC.ts`, in cm, traced from the drawing at about 1.12 px/cm.
- Walls: 23 cm exterior and 12 cm interior.
- Clear ceiling height: 285 cm. Doors: 210 cm high.
- Window sills: 90 cm (105 cm in the kitchen).

All of these are editable in the data file. The Dress areas are about 6 cm narrower than printed (130 cm instead of 136 cm) so that the printed 114 cm balconies and 232 cm toilets fit. Every other room matches its printed size exactly, which the tests enforce.

Confirm the real wall thicknesses, door positions and ceiling height with the builder, then adjust `planC.ts`; everything else follows from it.

## Code layout

| Folder | Module |
|---|---|
| `src/data/` | Plan data, shared types, geometry helpers (walls, doors, colliders, angles), room visibility, TV sizing |
| `src/architecture/` | Walls, floors, doors/windows, ceilings, kitchen and toilet fittings |
| `src/materials/` | Procedural PBR textures, lighting, surroundings, post-processing |
| `src/navigation/` | Walking, collision, dollhouse and plan cameras, minimap, touch controls, room culling |
| `src/planner/` | Furniture catalog, models, placement, default layout |
| `src/electrical/` | Electrical points, suggested set, CSV/JSON export |
| `src/ui/` | Toolbar, HUD, measure tool, plan overlay, `?perf` overlay |

The conventions (units, axes, yaw, mesh tags, dev hooks) are in `docs/AGENTS.md`.
