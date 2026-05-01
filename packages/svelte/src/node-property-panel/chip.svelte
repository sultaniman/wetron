<script lang="ts">
  let { label, color }: { label: string; color?: string } = $props();
</script>

{#if color}
  <span class="chip" style="background: {color}22; color: {color};">{label}</span>
{:else}
  <span class="chip" data-type={label}>{label}</span>
{/if}

<style>
  .chip {
    font-size: 8px;
    padding: 1px 5px;
    border-radius: 10px;
    white-space: nowrap;
    text-align: center;
    display: inline-block;
    background: var(--panel-chip-bg);
    color: var(--panel-chip-color);
  }

  /* Light mode type colors */
  .chip[data-type="str"],
  .chip[data-type="str[]"]   { background: #e8f5e9; color: #388e3c; }
  .chip[data-type="bool"]    { background: #fce4ec; color: #c2185b; }
  .chip[data-type="int"]     { background: #f3e5f5; color: #9c27b0; }
  .chip[data-type="float"]   { background: #e1f5fe; color: #0288d1; }
  .chip[data-type="int[]"],
  .chip[data-type="float[]"] { background: #fff3e0; color: #e8a000; }
  .chip[data-type="tensor"]  { background: #e6f4ea; color: #34a853; }
  .chip[data-type="optional"],
  .chip[data-type="[]"]      { background: #f5f5f5; color: #aaa; }

  /* Dark mode overrides */
  :global([data-theme="dark"]) .chip[data-type="str"],
  :global([data-theme="dark"]) .chip[data-type="str[]"]       { background: rgba(129,199,132,.13); color: #81c784; }
  :global([data-theme="dark"]) .chip[data-type="bool"]        { background: rgba(240,98,146,.13);  color: #f06292; }
  :global([data-theme="dark"]) .chip[data-type="int"]         { background: rgba(206,147,216,.13); color: #ce93d8; }
  :global([data-theme="dark"]) .chip[data-type="float"]       { background: rgba(100,181,246,.13); color: #64b5f6; }
  :global([data-theme="dark"]) .chip[data-type="int[]"],
  :global([data-theme="dark"]) .chip[data-type="float[]"]     { background: rgba(255,183,77,.13);  color: #ffb74d; }
  :global([data-theme="dark"]) .chip[data-type="tensor"]      { background: rgba(76,175,80,.13);   color: #4caf50; }
  :global([data-theme="dark"]) .chip[data-type="optional"],
  :global([data-theme="dark"]) .chip[data-type="[]"]          { background: rgba(158,158,158,.13); color: #9e9e9e; }
</style>
