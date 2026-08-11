interface Props {
  parts: number;
  filled: number;
  /** When set, slices become clickable (build mode). */
  onToggle?: (index: number) => void;
  selected?: boolean[];
  size?: number;
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number) {
  const a1 = (start - 90) * (Math.PI / 180);
  const a2 = (end - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

/** Circular diagram split into equal slices. */
export function PieDiagram({ parts, filled, onToggle, selected, size = 260 }: Props) {
  const cx = 50, cy = 50, r = 46;
  const step = 360 / parts;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="max-w-[70vw] drop-shadow-md"
      role="img"
      aria-label={`Diagrama com ${parts} partes`}
    >
      <circle cx={cx} cy={cy} r={r + 2} className="fill-background stroke-foreground/70" strokeWidth={2} />
      {Array.from({ length: parts }, (_, i) => {
        const on = selected ? selected[i] : i < filled;
        return (
          <path
            key={i}
            d={slicePath(cx, cy, r, i * step, (i + 1) * step)}
            className={`transition-all duration-200 ${
              on ? "fill-primary" : "fill-muted"
            } stroke-background ${onToggle ? "cursor-pointer hover:opacity-80" : ""}`}
            strokeWidth={1.5}
            onClick={onToggle ? () => onToggle(i) : undefined}
          />
        );
      })}
    </svg>
  );
}
