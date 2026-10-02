import { path } from "d3";

export function getAirRoutePath(points: readonly number[][]): string {
  const curve = path();
  if (points.length < 2) return "";
  curve.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1];
    const [nextX, nextY] = points[i];
    const dx = nextX - x;
    const dy = nextY - y;
    const length = Math.hypot(dx, dy);
    const bend = Math.min(40, length * 0.12);
    curve.quadraticCurveTo(
      (x + nextX) / 2 - (dy / (length || 1)) * bend,
      (y + nextY) / 2 + (dx / (length || 1)) * bend,
      nextX,
      nextY
    );
  }
  return curve.toString();
}
