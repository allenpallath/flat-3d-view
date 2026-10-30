# flat-3d-view

Walkable, to-scale 3D model of apartment **Type C (2BHK)**, built with Three.js / React Three Fiber.
Use it to walk through every room and plan furniture, plug points, switches and TV position.

```bash
npm install
npm run dev     # open the printed URL
npm test        # scale tests: every room matches its printed size
```

- Plan data (cm, source of truth): `src/data/planC.ts`
- Shared contracts: `src/data/schema.ts`, `src/store.ts`, `src/materials/materials.ts`
- Modules: `architecture/`, `materials/`, `navigation/`, `planner/`, `electrical/`, `ui/`
