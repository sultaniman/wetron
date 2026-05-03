# Git History Reorganization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Squash 103 fine-grained commits into ~20 logical group commits, organized by purpose/context.

**Architecture:** Use `git rebase -i --root` to reorder and squash all commits into cohesive stages. Each stage becomes one commit with a clean, meaningful message. A backup tag is created first so no work is lost.

**Tech Stack:** git, bun test (for verification after rebase)

---

## Proposed New History (20 commits, oldest → newest)

| #   | New commit message                                                         | Source commits (squashed)                                                                                                                     |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `scaffold repo, add initial docs, upgrade deps`                            | `02ce065`, `aaea276`, `08866bf`, `283c426`, `cb7ed46`, `8b9ea38`                                                                              |
| 2   | `add IR types, ParseError, dtype utilities`                                | `a313f6b`, `e946332`, `6430708`, `2fb47ea`                                                                                                    |
| 3   | `add ONNX parser with protobufjs`                                          | `c3c3296`, `b9dddb6`, `797c9e5`, `ac75077`                                                                                                    |
| 4   | `add TFLite FlatBuffers parser`                                            | `e56e7cd`, `66142de`, `472895d`                                                                                                               |
| 5   | `add format detection, dagre layout, parseModel entry`                     | `52fc4f1`, `6f7c44d`, `0fc660c`                                                                                                               |
| 6   | `add React ModelGraphView with custom nodes`                               | `5f00b7e`, `961311e`                                                                                                                          |
| 7   | `add Svelte ModelGraphView with custom nodes`                              | `119888b`                                                                                                                                     |
| 8   | `add React demo app, fix type errors, wire parsers`                        | `e680717`, `fd78b54`, `cac72ae`                                                                                                               |
| 9   | `add NodePropertyPanel with Phosphor icons`                                | `6945d4a`, `abddcd2`, `0b573fb`, `c13ce1a`, `f2b5163`, `469b248`, `54fe3fb`, `045d04f`, `bb8bd34`, `6f4941b`                                  |
| 10  | `add op categories, B·3 layout, color mode`                                | `6daefbd`, `ff29c31`, `c590451`, `c1607ae`, `947bbdc`, `0db6429`, `d256b1b`, `dfcd731`, `53779d0`, `46413f2`, `6c69224`, `124e521`, `1e52ff4` |
| 11  | `add edge data, smoothstep edges, edge click`                              | `554696e`, `b876f5d`, `5872c95`, `b8c2fc9`                                                                                                    |
| 12  | `move to CSS modules, shared NodeCard, kebab-case`                         | `7404c57`, `e913744`                                                                                                                          |
| 13  | `add EdgePanel, TensorPanel, UX polish, hybrid icons`                      | `5bbacaf`, `d20e03a`, `3518107`, `8cf0991`, `f806996`, `98d1198`                                                                              |
| 14  | `add Keras parser — ZIP, Sequential, Functional models`                    | `9d8d1dc`, `a4f9ef8`, `5f3dcd0`, `375bffd`, `98c59dd`, `85c05e2`                                                                              |
| 15  | `add initializers, opInputLabels, weightInputs, wire Keras`                | `31c8894`, `1f158e7`, `f082bd6`, `f5e076a`, `35ad4b1`, `6e9c1c4`                                                                              |
| 16  | `add edge panel, weight shapes, panel facelift`                            | `e3d56d9`, `c991952`, `c0b317b`, `7ecba8c`, `5ca4893`, `7f0b805`, `716970d`                                                                   |
| 17  | `fix Keras tensor names, inbound_nodes, op icons, add MobileNetV2 tests`   | `258dd13`, `58f7dfa`, `b59ce69`, `ce53620`, `68030b8`                                                                                         |
| 18  | `bring Svelte to parity with React — styles, icons, reactivity`            | `be01fcb`, `ca8fa89`, `a41091f`, `e3ea256`, `dd3f77b`, `9ce2ed5`, `4de9d33`, `d710c01`, `4131da1`, `901504f`                                  |
| 19  | `add Svelte demo, FlowNode dimensions, React node subtitle, clean up docs` | `13a89d4`, `24507e9`, `6b2152c`, `78f74ec`                                                                                                    |
| 20  | `add styling drift prevention spec and plan, format code`                  | `ced7da9`, `c7c85a6`, `badfc03`, `2d985f0`                                                                                                    |

---

## Files

- No files created or modified — this is a pure git history rewrite.

---

## Task 1: Create backup

- [ ] **Step 1: Tag current HEAD as backup**

```bash
git tag backup/pre-reorg HEAD
```

Expected: tag created silently.

- [ ] **Step 2: Verify tag**

```bash
git tag | grep backup
```

Expected: `backup/pre-reorg`

---

## Task 2: Open interactive rebase from root

- [ ] **Step 1: Start rebase**

```bash
GIT_SEQUENCE_EDITOR="code --wait" git rebase -i --root
```

Or if using a different editor:

```bash
GIT_SEQUENCE_EDITOR="vim" git rebase -i --root
```

This opens 103 lines — one per commit — in oldest-to-newest order.

- [ ] **Step 2: Apply the rebase instructions below**

Rewrite the file so it matches the 20-group squash plan. Each group uses `pick` on the first commit and `squash` (or `s`) on all subsequent commits within that group. The order of lines must match the table above (groups 1–20, oldest first).

Complete rebase TODO (paste this verbatim, replacing the editor contents):

```
# Group 1: scaffold + docs + deps
pick 02ce065 docs: add wetron design spec
s aaea276 docs: add wetron implementation plan
s 08866bf chore: ignore .worktrees directory
s 283c426 chore: move docs to docs/specs and docs/plans
s cb7ed46 chore: repo scaffold — packages, tsconfigs, test models
s 8b9ea38 chore: upgrade all dependencies to latest versions

# Group 2: core IR + dtypes
pick a313f6b feat(@wetron/core): add IR types and ParseError
s e946332 fix(@wetron/core): make AttributeValue array arms readonly, add captureStackTrace
s 6430708 feat(@wetron/core): add dtype utilities
s 2fb47ea fix(@wetron/core): remove any casts in readFloat16, add float8/Tier-3 tests

# Group 3: ONNX parser
pick c3c3296 chore(@wetron/onnx): add ONNX proto and compiled descriptor
s b9dddb6 feat(@wetron/onnx): add ONNX parser with protobufjs
s 797c9e5 fix(@wetron/onnx): import bigIntToNumber from @wetron/core/dtypes instead of inlining
s ac75077 fix(@wetron/onnx): fix readFileSync→Bun.file, pin node count, fix docString fallback, module-level TextDecoder

# Group 4: TFLite parser
pick e56e7cd feat(@wetron/tflite): add builtin op names and tensor type map
s 66142de feat(@wetron/tflite): add TFLite FlatBuffers parser
s 472895d fix(@wetron/tflite): add index.ts, fix __string cast, skip -1 optional inputs

# Group 5: core layout + entry
pick 52fc4f1 feat(@wetron/core): add dagre layout transform
s 6f7c44d feat(@wetron/core): add format detection
s 0fc660c feat(@wetron/core): add unified parseModel entry point

# Group 6: React renderer
pick 5f00b7e feat(@wetron/react): add ModelGraphView with custom nodes
s 961311e fix(@wetron/react): add shape/dtype to IO nodes, remove duplicate fitView prop

# Group 7: Svelte renderer
pick 119888b feat(@wetron/svelte): add ModelGraphView with custom nodes

# Group 8: demo app
pick e680717 feat: add demo React app in apps/demo
s fd78b54 chore: fix type errors and test env for tsc + bun test
s cac72ae feat: implement wetron — ONNX + TFLite parsers, React/Svelte renderers, demo app

# Group 9: NodePropertyPanel
pick 6945d4a docs: add node property panel design spec
s abddcd2 docs: add node property panel implementation plan
s 0b573fb docs: add node color theme design spec
s c13ce1a feat(@wetron/core): add graphValue to GraphNodeData for IO nodes
s f2b5163 feat(@wetron/react): add NodePropertyPanel with Phosphor icons and type chips
s 469b248 fix(@wetron/react): add afterEach cleanup to NodePropertyPanel tests
s 54fe3fb feat(@wetron/react): replace onNodeClick with onTargetClick for both node types
s 045d04f chore(@wetron/react): export NodePropertyPanel and add phosphor peer dep
s bb8bd34 feat(demo): wire NodePropertyPanel alongside graph view
s 6f4941b feat: add NodePropertyPanel with Phosphor icons and IO node click support

# Group 10: op categories + B·3 layout + color mode
pick 6daefbd feat(core): add opCategory() with 14-category op mapping
s ff29c31 feat(core): export opCategory and OpCategory from index
s c590451 feat(react): add CATEGORY_THEME with 14 op categories
s c1607ae feat(react): add ColorModeContext and resolveColorMode helper
s 947bbdc feat(react): update GraphNode to B·3 layout with category theming
s 0db6429 feat(react): update IoNode to B·3 layout with category theming
s d256b1b feat(react): export ColorMode type from index
s dfcd731 feat(react): add colorMode prop to ModelGraphView with context provider
s 53779d0 feat(svelte): add CATEGORY_THEME with 14 op categories
s 46413f2 feat(svelte): add ColorModeContext helpers
s 6c69224 feat(svelte): update GraphNode to B·3 layout with category theming
s 124e521 feat(svelte): update IoNode to B·3 layout with category theming
s 1e52ff4 feat(svelte): add colorMode prop to ModelGraphView with context

# Group 11: edge data + smoothstep + edge click
pick 554696e feat(core): add edge data (tensorName, opTypes) and smoothstep type
s b876f5d fix(core): narrow FlowEdge.type to literal, add readonly to data fields
s 5872c95 feat(react): smoothstep edges, arrowheads, pan-on-scroll, meta+scroll zoom, edge click handler
s b8c2fc9 fix(core): use default (bezier) edge type instead of smoothstep for smooth curves

# Group 12: CSS modules + NodeCard refactor
pick 7404c57 refactor(@wetron/react): CSS modules, shared NodeCard, kebab-case filenames, fix node width
s e913744 refactor: move CSS module type declarations to shared types/, update bun.lock

# Group 13: EdgePanel + TensorPanel + UX polish
pick 5bbacaf docs: graph ux polish design spec (fan-out, edge highlight, weight shapes, close button)
s d20e03a feat: phosphor/glyph hybrid icons, floating panel, tflite op categories, back navigation
s 3518107 feat(react): add EdgePanel, TensorPanel, and onTensorClick to NodePropertyPanel
s 8cf0991 test(react): add output row click test for onTensorClick
s f806996 feat(demo): wire onTensorClick with graph boundary lookup
s 98d1198 docs(demo): clarify intermediate tensor null shape/dtype in handleTensorClick

# Group 14: Keras parser
pick 9d8d1dc feat(@wetron/keras): scaffold package with stub parseKeras
s a4f9ef8 feat(@wetron/keras): ZIP extraction and config.json parsing
s 5f3dcd0 feat(@wetron/keras): Sequential model → ModelGraph IR
s 375bffd feat(@wetron/keras): Functional model IR with merge layer support
s 98c59dd feat(@wetron/core): add Keras layer category mappings
s 85c05e2 feat(onnx): add initializers tests

# Group 15: initializers + opInputLabels + weightInputs
pick 31c8894 feat(@wetron/core): add ModelGraph.initializers field and opInputLabels helper
s 1f158e7 feat(tflite): populate ModelGraph.initializers from constant tensor buffer presence
s f082bd6 feat: populate ModelGraph.initializers in keras and onnx parsers
s f5e076a feat: wire @wetron/keras into parseModel dispatch and demo file input
s 35ad4b1 fix(@wetron/core): remove duplicate keys from CATEGORY_MAP, fix import order
s 6e9c1c4 feat(@wetron/core): add weightInputs, sourceNodeName/targetNodeName to flow data

# Group 16: edge panel + weight shapes + panel facelift
pick e3d56d9 feat(demo): wire selectedEdgeTensorName, handleClose, fix handleBack nested setState
s c991952 feat(react): show weight shapes on node cards, remove full path name from cards
s c0b317b feat(react): edge highlighting via selectedEdgeTensorName, fan-out handleEdgeClick, remove ReactFlow watermark
s 7ecba8c feat(react): fan-out EdgePanel, onClose button, filter empty op inputs
s 5ca4893 feat(react): panel facelift, canvas/controls theming, attr expand
s 7f0b805 feat: add tensorShapes to ModelGraph IR and wire into edge panel
s 716970d fix(react): fix curved edges by using fixed node width matching NODE_W

# Group 17: Keras fixes + MobileNetV2 tests
pick 258dd13 fix(@wetron/keras): remove /output suffix from tensor names to fix IO edge wiring
s 58f7dfa fix(@wetron/keras,@wetron/core): add opInputLabels/detect tests, guard layer name
s b59ce69 fix(@wetron/keras): handle Keras 3 __keras_tensor__ wrapper in inbound_nodes
s ce53620 test(@wetron/keras): add MobileNetV2 fixture tests for real-world parsing
s 68030b8 fix: correct misleading op icons and fix hover jump in property panel

# Group 18: Svelte parity
pick be01fcb feat(@wetron/svelte): bring Svelte integration to parity with React
s ca8fa89 chore: kebab-case svelte filenames, add test model fixtures
s a41091f refactor(@wetron/svelte): rename files to kebab-case to match React package
s e3ea256 fix(@wetron/svelte): match React canvas/controls/handle/edge styles exactly
s dd3f77b feat(@wetron/svelte): match React styles and icons
s 9ce2ed5 fix: reduce dark mode minimap opacity from 0.92 to 0.55
s 4de9d33 fix: move tensor name to header subtitle with ellipsis truncation
s d710c01 fix: add title tooltip to truncated tensor/edge names in panel headers
s 4131da1 fix(demo): ignore workspace package sources in Vite watch to prevent HMR state reset
s 901504f fix(@wetron/svelte): use $state.raw for nodes to prevent deep-reactivity loop

# Group 19: Svelte demo + FlowNode dimensions + React polish + docs cleanup
pick 13a89d4 docs: consolidate docs, remove date prefixes, mark Keras as shipped
s 24507e9 feat(apps): add demo-svelte app, fix demo vite watch, update .gitignore
s 6b2152c feat(@wetron/core): add initialWidth/initialHeight to FlowNode, drop dagre align
s 78f74ec feat(@wetron/react): add node subtitle, useNodesState, selection style fix

# Group 20: styling drift spec + format
pick ced7da9 docs: add styling drift prevention design spec
s c7c85a6 docs: rename spec to drop date from filename
s badfc03 docs: add styling drift implementation plan
s 2d985f0 format code
```

- [ ] **Step 3: For each squash, the editor will prompt for a combined message. Use these:**
  - Group 1 → `scaffold repo, add initial docs, upgrade deps`
  - Group 2 → `add IR types, ParseError, dtype utilities`
  - Group 3 → `add ONNX parser with protobufjs`
  - Group 4 → `add TFLite FlatBuffers parser`
  - Group 5 → `add format detection, dagre layout, parseModel entry`
  - Group 6 → `add React ModelGraphView with custom nodes`
  - Group 7 → `add Svelte ModelGraphView with custom nodes`
  - Group 8 → `add React demo app, fix type errors, wire parsers`
  - Group 9 → `add NodePropertyPanel with Phosphor icons`
  - Group 10 → `add op categories, B·3 layout, color mode`
  - Group 11 → `add edge data, smoothstep edges, edge click`
  - Group 12 → `move to CSS modules, shared NodeCard, kebab-case`
  - Group 13 → `add EdgePanel, TensorPanel, UX polish, hybrid icons`
  - Group 14 → `add Keras parser — ZIP, Sequential, Functional models`
  - Group 15 → `add initializers, opInputLabels, weightInputs, wire Keras`
  - Group 16 → `add edge panel, weight shapes, panel facelift`
  - Group 17 → `fix Keras tensor names, inbound_nodes, op icons, add MobileNetV2 tests`
  - Group 18 → `bring Svelte to parity with React — styles, icons, reactivity`
  - Group 19 → `add Svelte demo, FlowNode dimensions, React node subtitle, clean up docs`
  - Group 20 → `add styling drift prevention spec and plan, format code`

---

## Task 3: Verify the result

- [ ] **Step 1: Check the new log**

```bash
git log --oneline
```

Expected: exactly 20 lines, matching the table above in order (newest first).

- [ ] **Step 2: Run all tests**

```bash
bun test
```

Expected: all tests pass. If any fail, the rebase introduced a conflict or ordering issue — compare against the backup tag to diagnose:

```bash
git diff backup/pre-reorg HEAD -- packages/
```

- [ ] **Step 3: Confirm backup tag still exists**

```bash
git tag | grep backup
```

Expected: `backup/pre-reorg`

---

## Recovery

If anything goes wrong during the rebase:

```bash
git rebase --abort          # while rebase is in progress
# or
git reset --hard backup/pre-reorg   # after rebase completed but result is wrong
```
