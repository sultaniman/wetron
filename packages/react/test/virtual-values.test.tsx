// @happy-dom
import { test, expect, describe, afterEach, beforeEach } from "bun:test";
import { render, screen, cleanup, act } from "@testing-library/react";
import React from "react";
import { VirtualValues } from "../src/node-property-panel/virtual-values/virtual-values.tsx";

// happy-dom returns 0 for offsetHeight; stub it so the virtualizer sees a
// non-zero container and renders rows.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return 320;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return 260;
    },
  });
});

afterEach(cleanup);

describe("VirtualValues", () => {
  test("renders the first row of values when at scroll-top", async () => {
    const values = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);
    render(
      React.createElement(VirtualValues, {
        values,
        format: (v: number) => v.toFixed(0),
      }),
    );
    await act(async () => {});
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("4")).toBeDefined();
  });

  test("renders integer-like cells for BigInt64Array values", async () => {
    const values = new BigInt64Array([10n, 20n, 30n, 40n]);
    render(
      React.createElement(VirtualValues, {
        values,
        format: (v: number) => v.toFixed(0),
      }),
    );
    await act(async () => {});
    expect(screen.getByText("10")).toBeDefined();
    expect(screen.getByText("40")).toBeDefined();
  });

  test("forwards data-testid to the scroll viewport", async () => {
    const values = new Float64Array([1, 2]);
    render(
      React.createElement(VirtualValues, {
        values,
        format: (v: number) => v.toFixed(0),
        "data-testid": "values-grid",
      } as Parameters<typeof VirtualValues>[0]),
    );
    await act(async () => {});
    expect(screen.queryByTestId("values-grid")).not.toBeNull();
  });
});
