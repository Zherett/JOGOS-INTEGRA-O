import type { Point } from "@/lib/cart-questions";

interface Props {
  points: Point[];
  highlightLabel?: string | null;
  showLabels?: boolean;
}

const SIZE = 360; // svg viewbox
const RANGE = 8;
const STEP = SIZE / (RANGE * 2);
const ORIGIN = SIZE / 2;

const COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#ec4899"];

function toSvg(x: number, y: number) {
  return { cx: ORIGIN + x * STEP, cy: ORIGIN - y * STEP };
}

export function CartesianPlane({ points, highlightLabel, showLabels = true }: Props) {
  const ticks = [];
  for (let i = -RANGE; i <= RANGE; i++) {
    const p = toSvg(i, 0);
    ticks.push(i);
  }
  return (
    <div className="aspect-square w-full max-w-md mx-auto rounded-2xl bg-card border p-2 shadow-sm">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full">
        {/* grid */}
        {ticks.map((i) => (
          <g key={`g${i}`}>
            <line
              x1={toSvg(i, 0).cx} y1={0} x2={toSvg(i, 0).cx} y2={SIZE}
              stroke="currentColor" strokeOpacity={i === 0 ? 0 : 0.08}
            />
            <line
              x1={0} y1={toSvg(0, i).cy} x2={SIZE} y2={toSvg(0, i).cy}
              stroke="currentColor" strokeOpacity={i === 0 ? 0 : 0.08}
            />
          </g>
        ))}
        {/* axes */}
        <line x1={0} y1={ORIGIN} x2={SIZE} y2={ORIGIN} stroke="currentColor" strokeOpacity={0.55} strokeWidth={1.5} />
        <line x1={ORIGIN} y1={0} x2={ORIGIN} y2={SIZE} stroke="currentColor" strokeOpacity={0.55} strokeWidth={1.5} />
        {/* axis labels */}
        {[-8, -4, 4, 8].map((i) => (
          <g key={`ax${i}`}>
            <text x={toSvg(i, 0).cx} y={ORIGIN + 14} fontSize="10" textAnchor="middle" fill="currentColor" opacity={0.5}>{i}</text>
            <text x={ORIGIN - 8} y={toSvg(0, i).cy + 3} fontSize="10" textAnchor="end" fill="currentColor" opacity={0.5}>{i}</text>
          </g>
        ))}
        <text x={SIZE - 8} y={ORIGIN - 6} fontSize="11" textAnchor="end" fill="currentColor" opacity={0.6}>x</text>
        <text x={ORIGIN + 6} y={12} fontSize="11" fill="currentColor" opacity={0.6}>y</text>

        {/* points */}
        {points.map((p, i) => {
          const { cx, cy } = toSvg(p.x, p.y);
          const color = COLORS[i % COLORS.length];
          const isHi = highlightLabel === p.label;
          return (
            <g key={p.label}>
              {isHi && <circle cx={cx} cy={cy} r={18} fill={color} opacity={0.25} className="animate-pop-in" />}
              <circle cx={cx} cy={cy} r={isHi ? 12 : 10} fill={color} stroke="white" strokeWidth={2} />
              {showLabels && (
                <text
                  x={cx} y={cy + 4} fontSize="12" fontWeight="700"
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
