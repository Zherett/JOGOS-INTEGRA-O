interface Props {
  parts: number;
  selected: boolean[];
  onToggle?: (index: number) => void;
  /** Fraction label shown above the pizza. */
  label?: string;
  state?: "idle" | "ok" | "bad";
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

/** Interactive pizza divided in equal slices (5 or 10). */
export function FractionPizza({ parts, selected, onToggle, label, state = "idle", size = 200 }: Props) {
  const cx = 50, cy = 50, r = 46;
  const step = 360 / parts;
  const ring =
    state === "ok" ? "stroke-success" : state === "bad" ? "stroke-destructive" : "stroke-foreground/60";

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <div className="rounded-xl bg-primary/10 px-3 py-0.5 font-display text-xl font-extrabold leading-tight text-primary">
          {label}
        </div>
      )}
      <svg
        viewBox="0 0 100 100"
        style={{ width: size, height: size }}
        className="max-w-[42vw] drop-shadow-md"
        role="img"
        aria-label={`Pizza com ${parts} partes`}
      >
        <circle cx={cx} cy={cy} r={r + 2.5} className={`fill-[hsl(35_60%_82%)] ${ring}`} strokeWidth={2.5} />
        {Array.from({ length: parts }, (_, i) => {
          const on = selected[i];
          return (
            <path
              key={i}
              d={slicePath(cx, cy, r, i * step, (i + 1) * step)}
              className={`transition-all duration-200 ${
                on ? "fill-accent" : "fill-muted"
              } stroke-background ${onToggle ? "cursor-pointer hover:opacity-80" : ""}`}
              strokeWidth={1.5}
              onClick={onToggle ? () => onToggle(i) : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}
