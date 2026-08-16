import { InfoIcon } from '@phosphor-icons/react';
import { Tooltip } from '../../tooltip.tsx';
import css from './inspectors.module.css';

/** Explains a control or value. The tooltip is the whole behavior; clicking does nothing. */
export function Hint({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <button type="button" className={css.hint} data-testid="hint" aria-label={text}>
        <InfoIcon size={12} weight="fill" />
      </button>
    </Tooltip>
  );
}
