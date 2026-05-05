---
title: "Installation"
description: "How to install Wetron packages for React or Svelte — a single install covers all parsers since @wetron/core lists them as dependencies."
lead: "A single install covers everything — parsers are dependencies of @wetron/core."
weight: 20
---

## React

```bash
bun add @wetron/react
```

`@wetron/react` → `@wetron/core` → all parser packages. One command installs the renderer, core, and all five format parsers.

Peer dependencies you must install separately:

```bash
bun add react react-dom @xyflow/react @phosphor-icons/react @base-ui/react
```

Import the stylesheet once in your entry point:

```ts
import "@wetron/react/styles.css";
```

## Svelte

```bash
bun add @wetron/svelte
```

Peer dependencies:

```bash
bun add svelte @xyflow/svelte phosphor-svelte
```

## Core only (no renderer)

If you only need parsing — custom rendering, server-side analysis, or testing:

```bash
bun add @wetron/core
```

This pulls in all parser packages as transitive dependencies.

## Version constraints

| Peer                  | Minimum |
| --------------------- | ------- |
| react                 | 18      |
| @xyflow/react         | 12      |
| @phosphor-icons/react | 2       |
| @base-ui/react        | 1       |
| svelte                | 5       |
| @xyflow/svelte        | 1.5     |
| phosphor-svelte       | 3       |
