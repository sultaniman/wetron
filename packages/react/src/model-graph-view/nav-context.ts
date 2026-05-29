import { createContext, useContext } from "react";
import type { ModelGraph } from "@wetron/common/ir";

type SubGraphNav = {
  depth: number;
  scopeName: string | null;
  navigateInto: (subGraph: ModelGraph) => void;
  navigateBack: () => void;
};

const noop = () => {};

export const SubGraphNavContext = createContext<SubGraphNav>({
  depth: 0,
  scopeName: null,
  navigateInto: noop,
  navigateBack: noop,
});

export const useSubGraphNav = () => useContext(SubGraphNavContext);
