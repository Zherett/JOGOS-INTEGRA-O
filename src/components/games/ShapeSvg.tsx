import { COLOR_HEX, type ColorName, type Shape, type SizeIdx, SIZE_PX } from "@/lib/shapes-content";

interface Props {
  shape: Shape;
  color?: ColorName;
  size: SizeIdx;
  outline?: boolean;
  className?: string;
  /** Visual scale factor (used to fit many pieces on screen). */
  scale?: number;
}

export function ShapeSvg({ shape, color = "azul", size, outline = false, className, scale = 1 }: Props) {
  const px = Math.round(SIZE_PX[size] * scale);
  const fill = outline ? "transparent" : COLOR_HEX[color];
  const stroke = outline ? "#94a3b8" : "rgba(0,0,0,0.25)";
  const strokeWidth = outline ? 3 : 2;
  const strokeDasharray = outline ? "6 5" : undefined;
  const commonProps = {
    fill,
    stroke,
    strokeWidth,
    strokeDasharray,
    strokeLinejoin: "round" as const,
  };
  const style = outline
    ? undefined
    : { filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.25))" };

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      aria-hidden
    >
      {shape === "square" && <rect x="8" y="8" width="84" height="84" rx="10" {...commonProps} />}
      {shape === "circle" && <circle cx="50" cy="50" r="42" {...commonProps} />}
      {shape === "oval" && <ellipse cx="50" cy="50" rx="45" ry="30" {...commonProps} />}
      {shape === "triangle" && <polygon points="50,8 92,88 8,88" {...commonProps} />}
      {shape === "rectH" && <rect x="4" y="28" width="92" height="44" rx="8" {...commonProps} />}
      {shape === "rectV" && <rect x="28" y="4" width="44" height="92" rx="8" {...commonProps} />}
      {shape === "star" && (
        <polygon
          points="50,6 61,38 95,38 67,58 78,92 50,72 22,92 33,58 5,38 39,38"
          {...commonProps}
        />
      )}
      {shape === "heart" && (
        <path
          d="M50 88 C 10 62, 10 22, 32 22 C 44 22, 50 32, 50 42 C 50 32, 56 22, 68 22 C 90 22, 90 62, 50 88 Z"
          {...commonProps}
        />
      )}
    </svg>
  );
}
