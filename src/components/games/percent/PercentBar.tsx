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

/** Visual percentage representation split into equal segments (no numbers). */
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

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {LABELS[variant]}
      </div>

      {vertical ? (
        <div className="flex items-end gap-2">
          <div className="flex h-56 w-24 flex-col-reverse gap-1 rounded-2xl border-4 border-foreground/70 bg-background p-1.5 shadow-inner sm:h-72 sm:w-32">
            {segments.map((on, i) => (
              <div
                key={i}
                className={`flex-1 rounded-md transition-all duration-300 ${on ? fillClass : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-xl items-center gap-2">
          <div className="flex h-16 flex-1 gap-1 rounded-2xl border-4 border-foreground/70 bg-background p-1.5 shadow-inner sm:h-20">
            {segments.map((on, i) => (
              <div
                key={i}
                className={`flex-1 rounded-md transition-all duration-300 ${on ? fillClass : "bg-muted"}`}
              />
            ))}
          </div>
          {variant === "bateria" && (
            <div className="h-6 w-2.5 rounded-r-md bg-foreground/70 sm:h-8 sm:w-3" />
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {parts} partes iguais
      </div>
    </div>
  );
}
