import { Reader } from "protobufjs/light";
import type { ModelGraph } from "@wetron/core/ir";
import { ParseError } from "@wetron/core/ir";
import type { KerasModelConfig } from "@wetron/keras";
import { buildKerasGraph } from "@wetron/keras";

export function parseKerasMetadataPb(bytes: Uint8Array): ModelGraph {
  const reader = Reader.create(bytes);
  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    if (tag >>> 3 === 1) {
      // field 1 - Keras model config as JSON string
      const json = reader.string();
      let raw: unknown;
      try {
        raw = JSON.parse(json);
      } catch (e) {
        throw new ParseError(
          "savedmodel",
          `keras_metadata.pb: JSON parse failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return buildKerasGraph(raw as KerasModelConfig);
    }
    reader.skipType(tag & 0x7);
  }
  throw new ParseError("savedmodel", "keras_metadata.pb: field 1 (model config) not found");
}
