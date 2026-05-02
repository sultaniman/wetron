import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

type Pos = { x: number; y: number };

const MAX_W = 280;
const OFFSET = 14;
const MARGIN = 8;

export function Tooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const ref = useRef<HTMLElement>(null);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const el = ref.current;
      if (el && el.scrollWidth <= el.clientWidth) return;
      setPos({ x: e.clientX, y: e.clientY });
      children.props.onMouseEnter?.(e);
    },
    [children.props],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (pos) setPos({ x: e.clientX, y: e.clientY });
      children.props.onMouseMove?.(e);
    },
    [pos, children.props],
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      setPos(null);
      children.props.onMouseLeave?.(e);
    },
    [children.props],
  );

  return (
    <>
      {React.cloneElement(children, {
        ref,
        onMouseEnter: handleMouseEnter,
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
      })}
      {pos && createPortal(<TooltipBox text={text} pos={pos} />, document.body)}
    </>
  );
}

function TooltipBox({ text, pos }: { text: string; pos: Pos }) {
  const wouldOverflow = pos.x + OFFSET + MAX_W > window.innerWidth - MARGIN;
  const left = wouldOverflow ? Math.max(MARGIN, pos.x - MAX_W - 6) : pos.x + OFFSET;
  const top = Math.min(pos.y - 10, window.innerHeight - 32);

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        maxWidth: MAX_W,
        background: "#1e1e2e",
        color: "#e8e8f0",
        padding: "4px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontFamily: "monospace",
        pointerEvents: "none",
        zIndex: 9999,
        wordBreak: "break-word",
        lineHeight: 1.5,
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
      }}
    >
      {text}
    </div>
  );
}
