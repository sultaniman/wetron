import React from "react";
import { ArrowLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import type { IconEntry } from "../theme.ts";
import { Tooltip } from "../tooltip.tsx";
import css from "./node-property-panel.module.css";
export { attrChipLabel, formatAttr } from "@wetron/core/panel-utils";

export function renderIconEntry(entry: IconEntry): React.ReactNode {
  if (entry.kind === "glyph") {
    return <span className={css.glyphIcon}>{entry.char}</span>;
  }
  return <entry.Component size={15} />;
}

export function Chip({ label, color }: { label: string; color?: string }) {
  if (color) {
    return (
      <span className={css.chip} style={{ background: color + "22", color }}>
        {label}
      </span>
    );
  }
  return (
    <span className={css.chip} data-type={label}>
      {label}
    </span>
  );
}

export function Row({
  label,
  value,
  chip,
  chipColor,
  onClick,
}: {
  label: string;
  value?: string;
  chip: string;
  chipColor?: string;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      className={`${css.row}${onClick ? ` ${css.rowClickable}` : ""}`}
      onClick={onClick}
    >
      <Tooltip text={label} onlyIfOverflow>
        <span className={css.rowLabel}>{label}</span>
      </Tooltip>
      {value && <span className={css.rowValue}>{value}</span>}
      <Chip label={chip} color={chipColor} />
      {onClick && (
        <span className={css.rowCaret}>
          <CaretRightIcon size={9} />
        </span>
      )}
    </div>
  );
}

export function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className={css.sectionLabel}>
      {icon}
      {title}
    </div>
  );
}

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button className={css.backButton} onClick={onBack} aria-label="Back">
      <ArrowLeftIcon size={13} />
    </button>
  );
}

export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button className={css.closeButton} onClick={onClose} aria-label="Close">
      <XIcon size={13} />
    </button>
  );
}
