import type { Point } from "@/lib/cart-questions";

interface Props {
  points: Point[];
  range?: number;
  highlightLabel?: string | null;
  showLabels?: boolean;
}

const COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#ec4899"];

export function CartesianPlane({ points, range = 8, highlightLabel, showLabels = true }: Props) {
  const PADDING = 24;
  const INNER = 360;
  const SIZE = INNER + PADDING * 2;
  const STEP = INNER / (range * 2);
  const ORIGIN = PADDING + INNER / 2;

  const toSvg = (x: number, y: number) => ({
    cx: ORIGIN + x * STEP,
    cy: ORIGIN - y * STEP,
  });

  const ticks: number[] = [];
  for (let i = -range; i <= range; i++) ticks.push(i);

  // pick sensible axis labels (avoid overcrowding for large ranges)
  const step = range <= 8 ? 2 : range <= 10 ? 2 : 3;
  const axisLabels = ticks.filter((i) => i !== 0 && i % step === 0);

  return (
    <div className="aspect-square w-full max-w-md mx-auto rounded-2xl bg-card border p-2 shadow-sm">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
        {ticks.map((i) => (
          <g key={`g${i}`}>
            <line
              x1={toSvg(i, 0).cx} y1={PADDING} x2={toSvg(i, 0).cx} y2={SIZE - PADDING}
              stroke="currentColor" strokeOpacity={i === 0 ? 0 : 0.08}
            />
            <line
              x1={PADDING} y1={toSvg(0, i).cy} x2={SIZE - PADDING} y2={toSvg(0, i).cy}
              stroke="currentColor" strokeOpacity={i === 0 ? 0 : 0.08}
            />
          </g>
        ))}
        <line x1={PADDING} y1={ORIGIN} x2={SIZE - PADDING} y2={ORIGIN} stroke="currentColor" strokeOpacity={0.55} strokeWidth={1.5} />
        <line x1={ORIGIN} y1={PADDING} x2={ORIGIN} y2={SIZE - PADDING} stroke="currentColor" strokeOpacity={0.55} strokeWidth={1.5} />
        {axisLabels.map((i) => (
          <g key={`ax${i}`}>
            <text x={toSvg(i, 0).cx} y={ORIGIN + 14} fontSize="10" textAnchor="middle" fill="currentColor" opacity={0.5}>{i}</text>
            <text x={ORIGIN - 8} y={toSvg(0, i).cy + 3} fontSize="10" textAnchor="end" fill="currentColor" opacity={0.5}>{i}</text>
          </g>
        ))}
        <text x={SIZE - PADDING} y={ORIGIN - 6} fontSize="11" textAnchor="end" fill="currentColor" opacity={0.6}>x</text>
        <text x={ORIGIN + 6} y={PADDING - 4} fontSize="11" fill="currentColor" opacity={0.6}>y</text>

        {points.map((p, i) => {
          const { cx, cy } = toSvg(p.x, p.y);
          const color = COLORS[i % COLORS.length];
          const isHi = highlightLabel === p.label;
          const r = range <= 8 ? 12 : range <= 10 ? 11 : 9;
          return (
            <g key={p.label}>
              {isHi && <circle cx={cx} cy={cy} r={r + 8} fill={color} opacity={0.25} className="animate-pop-in" />}
              <circle cx={cx} cy={cy} r={isHi ? r + 2 : r} fill={color} stroke="white" strokeWidth={2} />
              {showLabels && (
                <text
                  x={cx} y={cy + 4} fontSize={r} fontWeight="700"
                  textAnchor="middle" fill="white"
                >{p.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
