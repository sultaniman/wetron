import type { ModelGraph } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import { parseKerasMetadataPb } from "./parse-keras-meta.ts";
import { parseTfGraph } from "./parse-tf-graph.ts";

export function parseSavedModel(bytes: Uint8Array): ModelGraph {
  if (bytes.length < 2) throw new ParseError("savedmodel", "file too short");
  // keras_metadata.pb: field 1, wire type 2 (length-delimited string)
  if (bytes[0] === 0x0a) return parseKerasMetadataPb(bytes);
  // saved_model.pb: field 1, wire type 0 (varint) — schema version
  if (bytes[0] === 0x08) return parseTfGraph(bytes);
  throw new ParseError("savedmodel", "unrecognized .pb content (expected 0x0a or 0x08 first byte)");
}
