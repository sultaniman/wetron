<script lang="ts">
  import { MiniMap } from '@xyflow/svelte';
  import { useSvelteFlow } from '@xyflow/svelte';

  interface Props {
    style?: string;
    nodeColor?: string;
    maskColor?: string;
  }

  let { style, nodeColor, maskColor }: Props = $props();

  const { setCenter } = useSvelteFlow();

  function handleClick(_event: MouseEvent, pos: { x: number; y: number }) {
    setCenter(pos.x, pos.y, { duration: 300 });
  }
</script>

<MiniMap {style} {nodeColor} {maskColor} onclick={handleClick} />
