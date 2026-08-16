<script lang="ts">
  import { InfoIcon } from 'phosphor-svelte';
  import Tooltip from '../tooltip.svelte';
  import './inspectors.css';

  let { text }: { text: string } = $props();
</script>

<Tooltip {text}>
  <button type="button" class="inspector-hint" data-testid="hint" aria-label={text}>
    <InfoIcon size={12} weight="fill" />
  </button>
</Tooltip>
