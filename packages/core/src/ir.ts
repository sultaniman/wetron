export type AttributeValue = string | number | boolean | readonly number[] | readonly string[];

export interface GraphValue {
  readonly name: string;
  readonly shape: readonly number[] | null;
  readonly dtype: string | null;
}

export interface GraphNode {
  readonly name: string;
  readonly opType: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly attributes: Readonly<Record<string, AttributeValue>>;
}

export interface ModelGraph {
  readonly name: string;
  readonly inputs: readonly GraphValue[];
  readonly outputs: readonly GraphValue[];
  readonly nodes: readonly GraphNode[];
  readonly initializers: ReadonlyMap<
    string,
    {
      readonly shape: readonly number[];
      readonly dtype: string;
    }
  >;
  /** Shape + dtype for every named tensor in the model, including intermediate activations. */
  readonly tensorShapes: ReadonlyMap<
    string,
    {
      readonly shape: readonly number[] | null;
      readonly dtype: string | null;
    }
  >;
}

export class ParseError extends Error {
  constructor(
    public readonly format: string,
    public readonly context: string,
  ) {
    super(`[${format}] ${context}`);
    this.name = "ParseError";
    if ("captureStackTrace" in Error)
      (Error as unknown as { captureStackTrace(t: object, c: unknown): void }).captureStackTrace(
        this,
        ParseError,
      );
  }
}
