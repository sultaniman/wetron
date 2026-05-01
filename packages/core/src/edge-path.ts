export type Point = { x: number; y: number };

// Catmull-Rom spline through an ordered list of points (d3 curveCardinal algorithm,
// ported from Netron's grapher.Edge.Curve). Requires at least 2 points.
function catmullRom(pts: readonly Point[]): string {
  const segs: string[] = [];
  let x0 = 0, y0 = 0, x1 = 0, y1 = 0, state = 0;

  const seg = (x: number, y: number) =>
    segs.push(`C ${(2*x0+x1)/3} ${(2*y0+y1)/3} ${(x0+2*x1)/3} ${(y0+2*y1)/3} ${(x0+4*x1+x)/6} ${(y0+4*y1+y)/6}`);

  for (let i = 0; i < pts.length; i++) {
    const { x, y } = pts[i];
    switch (state) {
      case 0: segs.push(`M ${x} ${y}`); state = 1; break;
      case 1: state = 2; break;
      case 2: state = 3; segs.push(`L ${(5*x0+x1)/6} ${(5*y0+y1)/6}`); seg(x, y); break;
      default: seg(x, y); break;
    }
    x0 = x1; y0 = y1; x1 = x; y1 = y;
    if (i === pts.length - 1) {
      if (state === 3) { seg(x1, y1); segs.push(`L ${x1} ${y1}`); }
      else if (state === 2) segs.push(`L ${x1} ${y1}`);
    }
  }
  return segs.join(' ');
}

// Smooth path from (sx,sy) through optional Dagre waypoints to (tx,ty).
// With no waypoints: symmetric S-curve with vertical tangents (same as 2-point catmull-rom
// but uses an explicit bezier so the curve is visually consistent with the spline).
export function waypointPath(
  sx: number, sy: number,
  pts: readonly Point[],
  tx: number, ty: number,
): string {
  if (pts.length === 0) {
    const mid = (sy + ty) / 2;
    return `M ${sx} ${sy} C ${sx} ${mid} ${tx} ${mid} ${tx} ${ty}`;
  }
  return catmullRom([{ x: sx, y: sy }, ...pts, { x: tx, y: ty }]);
}
