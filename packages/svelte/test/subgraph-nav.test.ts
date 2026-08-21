import { afterEach, expect, test } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import NodeCard from '../src/nodes/node-card.svelte';

const mounted: Array<ReturnType<typeof mount>> = [];
afterEach(async () => {
  for (const m of mounted.splice(0)) await unmount(m);
  document.body.innerHTML = '';
});

function render(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  mounted.push(mount(NodeCard, { target, props: props as never }));
  return target;
}

test('the scope row invokes onOpenScope when clicked', async () => {
  let opened = 0;
  const target = render({
    nodeType: 'graphNode',
    pill: 'Functional',
    ariaLabel: 'Functional',
    cat: 'unknown',
    op: 'Functional',
    color: '#000',
    bg: '#fff',
    border: '#eee',
    muted: '#999',
    tintBase: '#fff',
    scopeName: 'inner_model',
    onOpenScope: () => opened++,
  });
  await tick();

  const row = target.querySelector<HTMLElement>('.scope-row');
  expect(row).not.toBeNull();
  row!.click();
  await tick();
  expect(opened).toBe(1);
});
