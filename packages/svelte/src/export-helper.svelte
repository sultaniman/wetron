<script lang="ts">
  import { useSvelteFlow, getNodesBounds } from '@xyflow/svelte';

  export type ExportHelpers = {
    fitAll: () => Promise<void>;
    getViewport: () => { x: number; y: number; zoom: number };
    setViewport: (vp: { x: number; y: number; zoom: number }) => void;
    getNodesBounds: () => { x: number; y: number; width: number; height: number };
    getViewportElement: () => HTMLElement | null;
  };

  interface Props {
    ref?: ExportHelpers | null;
  }

  let { ref = $bindable<ExportHelpers | null>(null) }: Props = $props();

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
        return document.querySelector<HTMLElement>('.svelte-flow__viewport');
      },
    };
    return () => { ref = null; };
  });
</script>
