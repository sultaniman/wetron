import { afterEach, describe, expect, test } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import type { ModelGraph } from '@wetron/common/ir';
import Host from './weight-inspection-host.svelte';
import Probe from './weight-inspection-probe.svelte';

const target = { name: 'w', shape: [2] as const, dtype: 'float32' };
const mounted: Array<ReturnType<typeof mount>> = [];

type HostProps = {
  graph: ModelGraph;
  target: { name: string; shape: readonly number[] | null; dtype: string | null };
  isDark?: boolean;
  mode?: 'custom' | 'default' | 'panel';
};

afterEach(async () => {
  await Promise.all(mounted.splice(0).map((component) => unmount(component)));
  document.body.replaceChildren();
});

function graph({
  bytes,
  fileSizeBytes = 8,
  external = false,
}: {
  bytes?: Uint8Array;
  fileSizeBytes?: number;
  external?: boolean;
}): ModelGraph {
  return {
    name: 'weights',
    inputs: [],
    outputs: [],
    nodes: [],
    initializers: new Map([[target.name, { shape: target.shape, dtype: target.dtype }]]),
    tensorShapes: new Map([[target.name, { shape: target.shape, dtype: target.dtype }]]),
    fileSizeBytes,
    weights: bytes
      ? { kind: 'available', source: { totalBytes: bytes.byteLength, get: () => bytes } }
      : external
        ? { kind: 'external', format: 'savedmodel' }
        : undefined,
  };
}

function mountHost(props: HostProps) {
  const element = document.createElement('div');
  document.body.append(element);
  const component = mount(Host, { target: element, props });
  mounted.push(component);
  return { component, element };
}

test('throws a strict error outside WeightPanel', () => {
  const element = document.createElement('div');
  expect(() => mount(Probe, { target: element })).toThrow('useWeightInspection must be used inside WeightPanel');
});

describe('getter-backed inspection context', () => {
  test('exposes ready data, tensor metadata, and theme', async () => {
    const { element } = mountHost({
      graph: graph({ bytes: new Uint8Array(8) }),
      target,
      isDark: true,
    });
    await tick();
    expect(element.querySelector('[data-testid="inspection-probe"]')?.textContent?.trim()).toBe(
      'ready|w|float32|2|8|2|2|dark',
    );
  });

  test('reacts from deferred to ready without remounting the custom child', async () => {
    const { element } = mountHost({
      graph: graph({ bytes: new Uint8Array(8), fileSizeBytes: 21 * 1024 * 1024 }),
      target,
    });
    await tick();
    const probe = () => element.querySelector('[data-testid="inspection-probe"]')?.textContent ?? '';
    expect(probe()).toContain('deferred|w|float32|2|no-bytes|no-values|no-stats');
    (element.querySelector('[data-testid="show-weights-switch"]') as HTMLButtonElement).click();
    await tick();
    expect(probe()).toContain('ready|w|float32|2|8|2|2');
  });

  test('changing to a large-model tensor resets the loading gate', async () => {
    const bytes = new Uint8Array(8);
    const { component, element } = mountHost({ graph: graph({ bytes }), target });
    await tick();
    component.setGraph(graph({ bytes, fileSizeBytes: 21 * 1024 * 1024 }));
    component.setTarget({ name: 'w2', shape: [2], dtype: 'float32' });
    await tick();
    expect(element.querySelector('[data-testid="inspection-probe"]')?.textContent).toContain(
      'deferred|w2|float32|2|no-bytes|no-values|no-stats',
    );
  });

  test('reports external, unavailable, and unsupported data boundaries', async () => {
    const { component, element } = mountHost({ graph: graph({ external: true }), target });
    await tick();
    const probe = () => element.querySelector('[data-testid="inspection-probe"]')?.textContent ?? '';
    expect(probe()).toContain('external|w|float32|2|no-bytes|no-values|no-stats');
    component.setGraph(graph({}));
    await tick();
    expect(probe()).toContain('unavailable|w|float32|2|no-bytes|no-values|no-stats');
    component.setGraph(graph({ bytes: new Uint8Array(8) }));
    component.setTarget({ name: 'w', shape: [8], dtype: 'Q4_K' });
    await tick();
    expect(probe()).toContain('unsupported|w|Q4_K|8|8|no-values|no-stats');
  });

  test('keys custom inspector state and forwards the NodePropertyPanel snippet', async () => {
    const bytes = new Uint8Array(8);
    const { component, element } = mountHost({ graph: graph({ bytes }), target });
    await tick();
    const local = element.querySelector('[data-testid="local-state"]') as HTMLButtonElement;
    local.click();
    await tick();
    expect(local.textContent).toBe('1');
    component.setTarget({ name: 'w2', shape: [2], dtype: 'float32' });
    await tick();
    expect(element.querySelector('[data-testid="local-state"]')?.textContent).toBe('0');

    await unmount(component);
    mounted.pop();
    element.remove();
    const panel = mountHost({ graph: graph({ bytes }), target, mode: 'panel' });
    await tick();
    expect(panel.element.querySelector('[data-testid="inspection-probe"]')).not.toBeNull();
    expect(panel.element.querySelector('[data-testid="heatmap"]')).toBeNull();
  });

  test('preserves a supported active inspector across tensor changes', async () => {
    const { component, element } = mountHost({
      graph: graph({ bytes: new Uint8Array(8) }),
      target,
      mode: 'default',
    });
    await tick();
    const selector = element.querySelector('[aria-label="Weight inspector"]') as HTMLSelectElement;
    selector.value = 'values';
    selector.dispatchEvent(new Event('input', { bubbles: true }));
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(element.querySelector('[data-testid="values-inspector"]')).not.toBeNull();
    component.setTarget({ name: 'w2', shape: [1, 2], dtype: 'float32' });
    await tick();
    expect(element.querySelector('[data-testid="values-inspector"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="matrix-inspector"]')).toBeNull();
  });
});
