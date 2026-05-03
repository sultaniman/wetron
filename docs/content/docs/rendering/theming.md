---
title: "Theming"
description: "CSS custom properties for Wetron components — override node card, tooltip, and property panel tokens without rebuilding."
lead: "All visual tokens are CSS custom properties — override any of them without rebuilding."
weight: 30
---

`ModelGraphView` wraps its output in `<div data-theme="light|dark">`. Target that attribute in your stylesheet:

```css
[data-theme="light"] {
  --wetron-node-bg: #fafafa;
  --wetron-panel-bg: #f5f5f5;
}

[data-theme="dark"] {
  --wetron-node-bg: #111827;
  --wetron-node-border: #1f2937;
  --wetron-panel-bg: #111827;
}
```

## Node card tokens

| Variable                  | Default (light) | Default (dark) | Controls                             |
| ------------------------- | --------------- | -------------- | ------------------------------------ |
| `--wetron-node-bg`        | `#ffffff`       | `#1e1e2e`      | Card background                      |
| `--wetron-node-border`    | `#e0e0e0`       | `#333333`      | Card border                          |
| `--wetron-node-muted`     | `#999999`       | `#7a7a9a`      | Subtitle / weight text               |
| `--wetron-node-tint-base` | `white`         | `#1e1e2e`      | Base for category-tinted backgrounds |

## Tooltip tokens

| Variable                 | Default (light) | Default (dark) | Controls           |
| ------------------------ | --------------- | -------------- | ------------------ |
| `--wetron-tooltip-bg`    | `#1e1e2e`       | `#2a2a3a`      | Tooltip background |
| `--wetron-tooltip-color` | `#e8e8f0`       | `#e8e8f0`      | Tooltip text       |

## Property panel tokens

| Variable                        | Default (light) | Default (dark) | Controls                      |
| ------------------------------- | --------------- | -------------- | ----------------------------- |
| `--wetron-panel-bg`             | `#ffffff`       | `#1e1e2e`      | Panel background              |
| `--wetron-panel-border`         | `#e0e0e0`       | `#2a2a3a`      | Panel border                  |
| `--wetron-panel-text`           | `#222222`       | `#f0f0f0`      | Primary text                  |
| `--wetron-panel-label`          | `#555555`       | `#a0a0c0`      | Row labels / section headers  |
| `--wetron-panel-value`          | `#333333`       | `#e0e0f0`      | Row values                    |
| `--wetron-panel-subtitle`       | `#aaaaaa`       | `#6a6a8a`      | Node name subtitle            |
| `--wetron-panel-chip-bg`        | `#f0f0f0`       | `#262646`      | Default chip background       |
| `--wetron-panel-chip-color`     | `#888888`       | `#a0a0c0`      | Default chip text             |
| `--wetron-panel-header-border`  | `#eeeeee`       | `#2a2a3a`      | Header bottom border          |
| `--wetron-panel-section-border` | `#f0f0f0`       | `#282840`      | Section divider               |
| `--wetron-panel-close-hover`    | `#f0f0f0`       | `#2a2a3a`      | Close button hover background |

## Node category colours

Category accent colours come from `@wetron/tokens` and are applied as tinted backgrounds on node cards. They are not CSS custom properties — customise them by passing a modified `CATEGORY_THEME` map if you fork the theme layer.

| Category        | Colour (light) |
| --------------- | -------------- |
| `conv`          | indigo         |
| `activation`    | amber          |
| `normalization` | cyan           |
| `pooling`       | violet         |
| `reshape`       | slate          |
| `math`          | orange         |
| `reduction`     | teal           |
| `merge`         | rose           |
| `attention`     | purple         |
| `recurrent`     | emerald        |
| `quantization`  | yellow         |
| `constant`      | gray           |
| `logic`         | sky            |
| `unknown`       | zinc           |
