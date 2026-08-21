import type { TensorOrder } from '@wetron/common/ir';
import type { DecodedWeight, NumericWeight } from './weight-decoder.ts';
import type { WeightStats } from './weight-stats.ts';

export type WeightInspectionStatus = 'deferred' | 'external' | 'unavailable' | 'ready' | 'unsupported';

interface WeightInspectionBase {
  readonly tensor: {
    readonly name: string;
    readonly shape: readonly number[] | null;
    readonly dtype: string | null;
    /** Memory order of the payload. Absent means row-major. */
    readonly order?: TensorOrder;
  };
}

export type WeightInspectionData = WeightInspectionBase &
  (
    | {
        readonly status: 'deferred' | 'external' | 'unavailable';
        readonly bytes: null;
        readonly values: null;
        readonly stats: null;
      }
    | {
        readonly status: 'unsupported';
        readonly bytes: Uint8Array;
        readonly values: null;
        readonly stats: null;
      }
    | {
        readonly status: 'ready';
        readonly bytes: Uint8Array;
        readonly values: DecodedWeight;
        readonly numeric: NumericWeight;
        readonly stats: WeightStats;
      }
  );
