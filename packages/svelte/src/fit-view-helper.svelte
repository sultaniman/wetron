<script lang="ts">
  import { untrack } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';

  let { nodes }: { nodes: { id: string; position: { x: number; y: number } }[] } = $props();

  const { fitView } = useSvelteFlow();

  $effect(() => {
    // Depend only on the nodes reference (new graph loaded), not on position values.
    // untrack prevents SvelteFlow's internal position mutations from re-triggering this effect.
    void nodes;
    untrack(() => {
      const topNodes = [...nodes]
        .sort((a, b) => a.position.y - b.position.y)
        .slice(0, 6)
        .map(n => ({ id: n.id }));
      fitView({ nodes: topNodes, maxZoom: 1, padding: 0.15 });
    });
  });
</script>
