# Specs Index

One-line summary + status for every design spec in this directory. New specs
follow the no-date filename convention (e.g. `<topic>-design.md`).

## Active

- [docs-sweep-design.md](docs-sweep-design.md) — Capability sweep across published docs and `docs/specs` / `docs/plans` reorg into a single tree with this index. Status: in-progress.
- [model-diff-design.md](model-diff-design.md) — Visual diff between two model checkpoints (added/removed/changed nodes). Status: proposed.
- [subgraph-collapse-design.md](subgraph-collapse-design.md) — Fold repetitive node groups (transformer blocks, residual units) into summary nodes that expand on click. Status: proposed.

## Reference

- [wetron-design.md](wetron-design.md) — Top-level architecture: monorepo layout, package responsibilities, IR contract.
- [format-graph-structures.md](format-graph-structures.md) — How each format encodes its graph and what wetron folds, filters, or punts.
- [funding-positioning.md](funding-positioning.md) — Comparison of NGI Zero / NLnet vs Prototype Fund applications: layers, asks, eligibility.

## Implemented (kept for design rationale)

- [css-isolation-node-color-theming-design.md](css-isolation-node-color-theming-design.md) — Defensive CSS to survive consumer resets; CSS-custom-property hooks for category colours. See also `node-color-theme-design.md` (the colour palette) and `styling-drift-design.md` (token plumbing).
- [graph-ux-polish-design.md](graph-ux-polish-design.md) — Fan-out connections, edge highlighting, panel close button, weight shapes on cards.
- [interactive-properties-edge-routing-design.md](interactive-properties-edge-routing-design.md) — Smoothstep edges, edge-click panel, tensor drill-down.
- [minimap-click-navigation-design.md](minimap-click-navigation-design.md) — Click-to-pan on minimap with eased animation.
- [node-color-theme-design.md](node-color-theme-design.md) — 14 op categories, B·3 node layout (pill + icon + name), straight edges.
- [node-property-panel-design.md](node-property-panel-design.md) — `NodePropertyPanel` component for op + IO nodes with type chips.
- [styling-drift-design.md](styling-drift-design.md) — `@wetron/tokens` as single source of truth for shared colours and CSS variables across React + Svelte.
- [weights-property-panel-design.md](weights-property-panel-design.md) — `WeightPanel` showing stats, histogram/heatmap toggle, dense numeric grid, gated by 20 MB threshold.
- [weights-property-panel-ux-design.md](weights-property-panel-ux-design.md) — UX polish: virtualised value grid, dtype-aware formatting, fixed width, height containment. Builds on `weights-property-panel-design.md`.
