export function bypassPath(
  sx: number, sy: number,
  tx: number, ty: number,
  bx: number,
  r = 6,
): string {
  const exitY = sy + 20;
  const entryY = ty - 20;
  const d1 = bx > sx ? 1 : -1;
  const d2 = tx > bx ? 1 : -1;
  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${exitY - r}`,
    `Q ${sx} ${exitY} ${sx + d1 * r} ${exitY}`,
    `L ${bx - d1 * r} ${exitY}`,
    `Q ${bx} ${exitY} ${bx} ${exitY + r}`,
    `L ${bx} ${entryY - r}`,
    `Q ${bx} ${entryY} ${bx + d2 * r} ${entryY}`,
    `L ${tx - d2 * r} ${entryY}`,
    `Q ${tx} ${entryY} ${tx} ${entryY + r}`,
    `L ${tx} ${ty}`,
  ].join(' ');
}
