import type { Node, NodeProps } from '@xyflow/react';
import type { IoFlowNode } from '@wetron/core/transform';
import { CATEGORY_ICON } from '../theme.ts';
import { NodeCard } from './node-card/node-card.tsx';

export function IoNodeComponent({ data, selected }: NodeProps<Node<IoFlowNode['data'], 'ioNode'>>) {
  const isInput = data.opType === 'Input';
  const cat = isInput ? ('input' as const) : ('output' as const);
  const color = `var(--wetron-category-${cat})`;
  const meta = [data.shape ? `[${data.shape.join(' × ')}]` : null, data.dtype].filter(Boolean).join(' ');
  const ariaLabel = `${isInput ? 'Input' : 'Output'}: ${data.name}${meta ? `, ${meta}` : ''}`;
  return (
    <NodeCard
      nodeType="ioNode"
      topHandle={!isInput}
      bottomHandle={isInput}
      pill={data.name}
      ariaLabel={ariaLabel}
      cat={cat}
      iconEntry={CATEGORY_ICON[cat]}
      tinted
      selected={selected}
      colors={{ color }}
    >
      {meta || null}
    </NodeCard>
  );
}
