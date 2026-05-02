<script lang="ts">
  import { MiniMap, useSvelteFlow } from '@xyflow/svelte';

  interface Props {
    style?: string;
    nodeColor?: string;
    maskColor?: string;
  }

  let { style, nodeColor, maskColor }: Props = $props();

  const { setCenter, screenToFlowPosition } = useSvelteFlow();

  function handleClick(event: MouseEvent) {
    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setCenter(pos.x, pos.y, { duration: 300 });
  }
</script>

<MiniMap {style} {nodeColor} {maskColor} onclick={handleClick} />
