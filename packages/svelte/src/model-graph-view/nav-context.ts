import { getContext, setContext } from "svelte";
import type { ModelGraph } from "@wetron/common/ir";

const KEY = Symbol("wetron-sub-graph-nav");

export type SubGraphNav = {
  readonly depth: number;
  readonly scopeName: string | null;
  navigateInto(subGraph: ModelGraph): void;
  navigateBack(): void;
};

const DEFAULT: SubGraphNav = {
  depth: 0,
  scopeName: null,
  navigateInto: () => {},
  navigateBack: () => {},
};

export function provideSubGraphNav(value: SubGraphNav) {
  setContext(KEY, value);
}

export function consumeSubGraphNav(): SubGraphNav {
  return getContext<SubGraphNav>(KEY) ?? DEFAULT;
}
