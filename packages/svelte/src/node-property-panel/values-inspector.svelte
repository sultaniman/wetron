<script lang="ts">
  import { formatVal, isIntegerDtype } from '@wetron/core/format-val';
  import { getWeightInspection } from './weight-inspection-context.ts';
  import VirtualValues from './virtual-values.svelte';
  import './inspectors.css';
  const context = getWeightInspection();
  const ready = $derived(context.current.status === 'ready' ? context.current : null);
  const dtype = $derived(ready?.tensor.dtype ?? 'float32');
</script>

{#if ready}<div class="inspector" data-testid="values-inspector">
    <div class="inspector-note">{ready.values.length.toLocaleString()} flattened values</div>
    <VirtualValues
      values={ready.values}
      format={(value: number | bigint) => (typeof value === 'bigint' ? value.toString() : formatVal(value, dtype))}
      align={isIntegerDtype(dtype) ? 'center' : 'right'}
    />
  </div>{/if}
