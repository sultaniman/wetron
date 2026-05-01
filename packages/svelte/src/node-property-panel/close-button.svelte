<script lang="ts">
  import { X } from 'phosphor-svelte';

  let { onClose }: { onClose: () => void } = $props();
</script>

<button class="closeButton" onclick={onClose} aria-label="Close">
  <X size={13} />
</button>

<style>
  .closeButton {
    position: absolute;
    top: 9px;
    right: 9px;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--panel-subtitle);
    padding: 0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .closeButton:hover {
    background: var(--panel-close-hover);
    color: var(--panel-text);
  }
</style>
