import React, { useEffect, useRef, useState } from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import css from "./tooltip.module.css";

export function Tooltip({
  text,
  onlyIfOverflow = false,
  children,
}: {
  text: string;
  onlyIfOverflow?: boolean;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}) {
  const triggerRef = useRef<HTMLElement>(null);
  const [disabled, setDisabled] = useState(onlyIfOverflow);

  useEffect(() => {
    if (!onlyIfOverflow) return;
    const el = triggerRef.current;
    if (!el) return;
    const check = () => setDisabled(el.scrollWidth <= el.offsetWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onlyIfOverflow]);

  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger ref={triggerRef} disabled={disabled} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={8} className={css.positioner}>
          <BaseTooltip.Popup className={css.popup}>{text}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
