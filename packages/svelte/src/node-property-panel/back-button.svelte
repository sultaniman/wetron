<script lang="ts">
  import { ArrowLeftIcon } from 'phosphor-svelte';

  let { onBack }: { onBack: () => void } = $props();
</script>

<button class="backButton" onclick={onBack} aria-label="Back">
  <ArrowLeftIcon size={13} />
</button>

<style>
  .backButton {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: #aaa;
    display: flex;
    align-items: center;
    border-radius: 4px;
    flex-shrink: 0;
    margin-right: -4px;
  }
</style>
