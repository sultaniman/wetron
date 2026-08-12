<script lang="ts">
  import { getWeightInspection } from '../src/node-property-panel/weight-inspection-context.ts';

  const context = getWeightInspection();
  const inspection = $derived(context.current);
  let local = $state(0);
</script>

<output data-testid="inspection-probe">
  {inspection.status}|{inspection.tensor.name}|{inspection.tensor.dtype}|{inspection.tensor.shape?.join('x')}|{inspection.bytes?.byteLength ?? 'no-bytes'}|{inspection.values?.length ?? 'no-values'}|{inspection.stats?.count ?? 'no-stats'}|{context.isDark ? 'dark' : 'light'}
</output>
<button data-testid="local-state" onclick={() => local++}>{local}</button>
