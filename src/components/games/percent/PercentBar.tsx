import type { BarVariant } from "@/lib/percent-content";

interface Props {
  variant: BarVariant;
  parts: number;
  filled: number;
}

const LABELS: Record<BarVariant, string> = {
  bateria: "Bateria",
  carregamento: "Carregando",
  tanque: "Tanque",
  medidor: "Medidor",
  barra: "Barra",
};

/**
 * Visual percentage representation split into equal segments (no numbers).
 * Segments have a FIXED size so 4-part and 10-part bars never look squeezed,
 * and empty segments keep a visible outline (silhouette).
 */
export function PercentBar({ variant, parts, filled }: Props) {
  const vertical = variant === "tanque";
  const segments = Array.from({ length: parts }, (_, i) => i < filled);

  const fillClass =
    variant === "bateria"
      ? "bg-emerald-500"
      : variant === "tanque"
        ? "bg-sky-500"
        : variant === "medidor"
          ? "bg-accent"
          : "bg-primary";

  const emptyClass = "bg-muted/50 border-2 border-dashed border-foreground/35";

  // Fixed geometry keeps every bar visually consistent.
  const SEG = 34; // px per segment (horizontal width / vertical height)
  const GAP = 6;
  const trackLength = parts * SEG + (parts - 1) * GAP;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {LABELS[variant]}
      </div>

      {vertical ? (
        <div
          className="flex w-28 flex-col-reverse rounded-2xl border-4 border-foreground/70 bg-background p-2 shadow-inner"
          style={{ height: trackLength + 16, gap: GAP }}
        >
          {segments.map((on, i) => (
            <div
              key={i}
              style={{ height: SEG }}
              className={`shrink-0 rounded-md transition-all duration-300 ${on ? fillClass : emptyClass}`}
            />
          ))}
        </div>
      ) : (
        <div className="flex max-w-full items-center gap-2 overflow-x-auto px-1">
          <div
            className="flex h-20 shrink-0 items-stretch rounded-2xl border-4 border-foreground/70 bg-background p-2 shadow-inner"
            style={{ width: trackLength + 16, gap: GAP }}
          >
            {segments.map((on, i) => (
              <div
                key={i}
                style={{ width: SEG }}
                className={`shrink-0 rounded-md transition-all duration-300 ${on ? fillClass : emptyClass}`}
              />
            ))}
          </div>
          {variant === "bateria" && (
            <div className="h-8 w-3 shrink-0 rounded-r-md bg-foreground/70" />
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground">{parts} partes iguais</div>
    </div>
  );
}
