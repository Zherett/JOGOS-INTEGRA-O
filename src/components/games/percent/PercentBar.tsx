import type { BarVariant } from "@/lib/percent-content";

interface Props {
  variant: BarVariant;
  parts: number;
  filled: number;
}

const LABELS: Record<BarVariant, string> = {
  bateria: "Bateria",
  carregamento: "Carregando",
  tanque: "Tanque / Nível",
  medidor: "Medidor",
  barra: "Barra de Energia",
};

/**
 * Representação visual percentual padronizada na horizontal (formato fixo de bateria/medidor).
 * O container externo possui dimensões rigorosamente fixas e responsivas para celular,
 * garantindo que barras de 2, 4, 5 ou 10 partes tenham exatamente o mesmo tamanho físico externo
 * e nunca vazem da tela.
 */
export function PercentBar({ variant, parts, filled }: Props) {
  const segments = Array.from({ length: parts }, (_, i) => i < filled);

  const fillClass =
    variant === "bateria"
      ? "bg-emerald-500 shadow-xs"
      : variant === "tanque"
        ? "bg-sky-500 shadow-xs"
        : variant === "medidor"
          ? "bg-accent shadow-xs"
          : "bg-primary shadow-xs";

  const emptyClass = "bg-muted/30 border-2 border-dashed border-foreground/30";

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-[320px] mx-auto select-none">
      <div className="flex items-center justify-between w-full px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>{LABELS[variant]}</span>
        <span className="text-foreground/80 font-mono font-extrabold">{parts} partes iguais</span>
      </div>

      {/* Container horizontal padronizado com terminal de bateria */}
      <div className="flex items-center justify-center w-full px-1">
        <div className="flex-1 flex h-14 sm:h-16 items-stretch rounded-2xl border-4 border-foreground/70 bg-background p-1.5 shadow-inner gap-1.5 min-w-0">
          {segments.map((on, i) => (
            <div
              key={i}
              className={`flex-1 min-w-0 rounded-lg transition-all duration-300 ${
                on ? fillClass : emptyClass
              }`}
            />
          ))}
        </div>
        {/* Terminal positivo da bateria/medidor */}
        <div className="h-6 w-2.5 sm:w-3 shrink-0 rounded-r-md bg-foreground/70 -ml-0.5" />
      </div>

      <div className="text-[11px] text-muted-foreground font-medium">
        <span className="font-bold text-foreground">{filled}</span> de{" "}
        <span className="font-bold text-foreground">{parts}</span> partes preenchidas
      </div>
    </div>
  );
}
