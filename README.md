# flowers

A rotating bouquet rendered as a 3D model of glyphs. Procedural geometry is rasterized by [glyphcss](https://www.npmjs.com/package/glyphcss) into a single `<pre>`, and the legend and palette editor are drawn from the same character grid. No WebGL, no canvas, no image files. The palette was sampled from a reference photograph of a real bouquet, which is not redistributed here and never loaded at runtime.

## Requirements

- Node `^20.19.0` or `>=22.12.0` (the range `vite` declares)

## Commands

| Command                | What it does                                        |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Vite dev server with hot reloading                  |
| `npm run build`        | Type-check, then build the static site into `dist/` |
| `npm run preview`      | Serve the built site from `dist/`                   |
| `npm run typecheck`    | Run `tsc --noEmit`                                  |
| `npm test`             | Run the Vitest suite once                           |
| `npm run format`       | Format with Prettier                                |
| `npm run format:check` | Check formatting without writing files              |
| `npm run deploy`       | Build, then publish `dist/` to Firebase Hosting     |

## Hosting

The site deploys as a static bundle on Firebase Hosting, project `flowers-c7868`, served from <https://flowers.vlkn.io/>. `firebase.json` publishes `dist/` only, so `src/`, `node_modules/` and the Firebase config never reach the CDN; hashed bundles under `/assets/` are cached for a year, `index.html` is always revalidated, and the favicon in `public/` is copied through unchanged. Run `npm run deploy` with the Firebase CLI logged in - it builds first, so a failing type-check cannot ship.

## Palette

`src/palette.ts` is the single source of truth for color. `DEFAULT_PALETTE` maps each role - cream and lavender roses, lavender sprigs, eucalyptus, stems, ribbon, backdrop - to a hex value, and `PALETTE_ROLES` drives the legend labels and editor rows in that order, so adding a role means adding it to both.

The on-page editor writes the same roles to `localStorage` under `flowers.palette`; `[ RESET ]` clears that entry and restores the defaults. Stage ink lives in the same module and is chosen at runtime by contrast against the backdrop.

## Geometry

`src/bouquet.ts` assembles the bouquet from seeded random draws, so a given palette always produces identical geometry.

- Roses (`src/flowers/rose.ts`) - a dark core sphere, three rings of shingled petal sheets, and a furled cone closing the top of the head.
- Eucalyptus (`src/flowers/eucalyptus.ts`) - a thin curved stem carrying five to seven round leaves that shrink toward the tip.
- Lavender sprigs - a stem with a tapered spike of buds, built in `src/bouquet.ts`.
- Stems and ribbon (`src/flowers/body.ts`) - anchors arc down to a common tie point; two thin bands cross at tie height, cinched against `bundleRadius(y)`.
- Shading (`src/flowers/shade.ts`) - `shadeRamp` derives every tone from a palette color, so no geometry module invents a hex value.

Two constraints shape the model. Geometry is built Y-up and flipped into glyph space (Z-up). Glyph scenes render single-sided, so sheets are wound outward from the head axis and never mirrored - a mirrored sheet disappears when the camera faces it.

Recoloring rebuilds polygons in the same order and swaps them with `setPolygons(...)` followed by `rerender()`; vertices never change, which the tests assert. `POLYGON_BUDGET` bounds the polygon count, and `guardFrameBudget` drops the grid resolution once if the first frames miss the frame budget.

## Text-mode UI

Every surrounding surface is text, built by `src/ui/ascii.ts`.

- One monospace stack and one cell metric for the scene, legend, editor, and footer.
- Box widths are measured in character cells so `│` columns line up, and the chrome re-renders on resize and on palette change.
- No icons, images, rounded corners, shadows, or gradients. Color inputs are flat swatches, actions are bracketed text such as `[ RESET ]`, and focus is inverse video.

## Layout

```
index.html            page shell: scene host, panel hosts, keyboard hints
src/main.ts           scene setup, camera framing, spin, key light, frame budget
src/bouquet.ts        bouquet assembly, ribbon, lavender sprigs, inventory
src/flowers/          rose, eucalyptus, stem body, shade ramp, seeded RNG
src/palette.ts        palette roles, defaults, persistence, stage ink
src/legend.ts         boxed legend table with live swatches
src/controls.ts       boxed palette editor
src/ui/ascii.ts       text-mode chrome builders
src/style.css         text-mode layout, monospace metrics, focus states
```
