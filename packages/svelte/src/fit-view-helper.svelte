<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';

  let { nodes }: { nodes: { id: string; position: { x: number; y: number } }[] } = $props();

  const { fitView } = useSvelteFlow();

  $effect(() => {
    const TARGET = 12;
    if (nodes.length <= TARGET) {
      fitView({ maxZoom: 1, padding: 0.15 });
    } else {
      const topNodes = [...nodes]
        .sort((a, b) => a.position.y - b.position.y)
        .slice(0, TARGET)
        .map(n => ({ id: n.id }));
      fitView({ nodes: topNodes, maxZoom: 1, padding: 0.15 });
    }
  });
</script>
