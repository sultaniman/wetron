import React from "react";
import { ArrowLeft, CaretRight, X } from "@phosphor-icons/react";
import type { AttributeValue } from "@wetron/core/ir";
import type { IconEntry } from "../theme.ts";
import css from "./node-property-panel.module.css";

export function attrChipLabel(value: AttributeValue): string {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (typeof value === "string") return "str";
  if (value.length === 0) return "[]";
  return typeof value[0] === "string"
    ? "str[]"
    : Number.isInteger(value[0] as number)
      ? "int[]"
      : "float[]";
}

export function formatAttr(value: AttributeValue): string {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return `[${value.join(", ")}]`;
}

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
      <span className={css.rowLabel}>{label}</span>
      {value && <span className={css.rowValue}>{value}</span>}
      <Chip label={chip} color={chipColor} />
      {onClick && (
        <span className={css.rowCaret}>
          <CaretRight size={9} />
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
      <ArrowLeft size={13} />
    </button>
  );
}

export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button className={css.closeButton} onClick={onClose} aria-label="Close">
      <X size={13} />
    </button>
  );
}
