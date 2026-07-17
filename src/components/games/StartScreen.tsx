import { Play, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LastMatch } from "@/lib/game-storage";
import { LastMatchCard } from "./LastMatchCard";

interface Props {
  title: string;
  description?: string;
  onStart: () => void;
  onExit: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
}

export function StartScreen({ title, description, onStart, onExit, children, disabled }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onExit} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" /> Menu
        </Button>
        <div className="font-display text-lg sm:text-xl font-bold">{title}</div>
        <div className="w-20" />
      </div>

      <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-6 sm:p-10 shadow-xl animate-pop-in">
        <div className="text-center">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold">{title}</h2>
          {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        </div>

        {children && <div className="mt-8">{children}</div>}

        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            onClick={onStart}
            disabled={disabled}
            className="h-16 px-10 text-xl font-bold rounded-2xl shadow-lg bg-primary hover:bg-primary/90"
          >
            <Play className="mr-2 h-6 w-6 fill-current" /> Iniciar jogo
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OptionChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border-2 px-4 py-3 font-display font-bold transition-all hover:scale-[1.02] active:scale-95 ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-md"
          : "bg-card hover:bg-secondary border-border text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
