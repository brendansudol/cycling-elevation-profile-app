# Refactor / Cleanup Ideas

Notes for future extraction and cleanup within `src/components/ProfileChart.tsx`. These are non-functional refactors intended to improve readability and maintainability.

- Extract `PlatformShelf` component

  - Renders shelf slab and start wall.
  - Props: `P`, `addShelf`, `W`, `zNear`, `zFar`, `platform`.

- Extract `GridLines` component

  - Wraps distance and elevation grids within the clip.
  - Props: `P`, `addShelf`, `W`, `H`, `distStepWorldKm`, `stepYkm`.

- Extract `RoofRibbon` component

  - Renders roof tiles and dashed midline.
  - Props: `nearPts2D`, `farPts2D`, `midPts`, `segments`, `slopeColors`, `roadStyle`.

- Extract `Axes` components

  - `DistanceAxis`: axis line, ticks/labels, segment grade labels overlay.
    - Props: `baseAxisL`, `baseAxisR`, `nVec`, `distStepLabel`, `distStepWorldKm`, `segments`, `worldPts`, `P`, `shelfVec`, `gradeLabelFontSize`.
  - `ElevationAxis`: axis line and tick labels (supports absolute start elevation).
    - Props: `P`, `addShelf`, `W`, `H`, `stepYkm`, `stepYLabel`, `elevMin`, `units`, `startElevM`.

- Add `formatters` helpers

  - Functions: `formatDistance`, `formatElevation`, `formatPercent` to centralize label rules.

- Prop strategy decision

  - Either pass the whole `model` object into sub-components for convenience, or pass explicit props for clarity. Document pros/cons and choose one for consistency.

- Component file organization

  - Consider moving `GradeLegend` and `TitleAndStats` into their own files once stable.

- Unit constants centralization

  - Unit constants are currently hoisted in `ProfileChart.tsx`. Consider moving to a small shared util if reused elsewhere.

- Testing
  - Add unit tests for `deriveModel` and any new `formatters` to lock in behavior.
