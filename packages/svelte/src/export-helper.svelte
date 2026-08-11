<script lang="ts">
  import { useSvelteFlow, getNodesBounds } from '@xyflow/svelte';
  import type { ExportHelpers } from './export-helper.ts';

  interface Props {
    ref?: ExportHelpers | null;
    root?: HTMLElement | null;
  }

  let { ref = $bindable<ExportHelpers | null>(null), root = null }: Props = $props();

  const { fitView, getViewport, setViewport, getNodes } = useSvelteFlow();

  $effect(() => {
    ref = {
      async fitAll() {
        fitView({ padding: 0.1, duration: 0 });
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      },
      getViewport() {
        return getViewport();
      },
      setViewport(vp) {
        setViewport(vp);
      },
      getNodesBounds() {
        return getNodesBounds(getNodes());
      },
      getViewportElement() {
        return root?.querySelector<HTMLElement>('.svelte-flow__viewport') ?? null;
      },
    };
    return () => { ref = null; };
  });
</script>
