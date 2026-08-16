<script lang="ts">
  import { consumeSubGraphNav } from './nav-context.ts';

  const nav = consumeSubGraphNav();
</script>

{#if nav.depth > 0}
  <div class="wetron-scope-chrome">
    <button
      type="button"
      class="wetron-scope-back"
      onclick={() => nav.navigateBack()}
      aria-label="Back to parent graph"
    >
      ← Back
    </button>
    {#if nav.scopeName}
      <span class="wetron-scope-name">{nav.scopeName}</span>
    {/if}
  </div>
{/if}

<style>
  .wetron-scope-chrome {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px 4px 4px;
    border-radius: 4px;
    background: color-mix(in oklch, var(--wetron-node-bg, #fff) 92%, transparent);
    border: 1px solid var(--wetron-node-border, #e0e0e0);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    font-family: system-ui, sans-serif;
    font-size: 12px;
    line-height: 1.2;
    color: var(--wetron-panel-text, inherit);
  }

  .wetron-scope-back {
    background: none;
    border: none;
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 3px;
    font: inherit;
    color: inherit;
  }

  .wetron-scope-back:hover {
    background: color-mix(in oklch, var(--wetron-node-border, #e0e0e0) 60%, transparent);
  }

  .wetron-scope-name {
    font-weight: 600;
  }
</style>
