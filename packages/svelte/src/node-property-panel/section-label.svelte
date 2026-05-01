<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, icon }: { title: string; icon?: Snippet } = $props();
</script>

<div class="sectionLabel">
  {#if icon}{@render icon()}{/if}
  {title}
</div>

<style>
  .sectionLabel {
    font-size: 10px;
    font-weight: 500;
    color: var(--panel-label);
    margin-bottom: 5px;
    display: flex;
    align-items: center;
    gap: 4px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
</style>
