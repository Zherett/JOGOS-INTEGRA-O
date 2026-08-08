import { useState } from "react";
import { KeyRound, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { redeemCode } from "@/lib/game-codes";
import type { GameId } from "@/lib/game-storage";
import robot from "@/assets/robot-hero.png.asset.json";
import integracaoPreto from "@/assets/integracao-preto.asset.json";
import semed from "@/assets/semed.asset.json";

interface Props {
  /** Shown when the user already has games and is adding one more. */
  hasGames: boolean;
  onUnlocked: (game?: GameId) => void;
  onBack?: () => void;
}

export function CodeGate({ hasGames, onUnlocked, onBack }: Props) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = redeemCode(code);
    if (r.status === "ok") {
      setMsg({ tone: "ok", text: "Código válido! Jogo liberado." });
      setCode("");
      onUnlocked(r.game);
    } else if (r.status === "all") {
      setMsg({ tone: "ok", text: "Código de professor: todos os jogos foram liberados." });
      setCode("");
      onUnlocked();
    } else if (r.status === "already") {
      setMsg({ tone: "ok", text: "Este jogo já está liberado." });
      setCode("");
      onUnlocked(r.game);
    } else if (r.status === "reserved") {
      setMsg({ tone: "err", text: "Código válido, mas esse jogo ainda está em construção." });
    } else {
      setMsg({ tone: "err", text: "Código inválido. Confira com o seu professor." });
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <img
          src={integracaoPreto.url}
          alt="Logo do Projeto INTEGRAÇÃO"
          width={160}
          height={80}
          className="h-12 w-auto sm:h-16 rounded-lg object-contain"
        />
        <img
          src={semed.url}
          alt="Logo da SEMED Coari"
          width={160}
          height={80}
          className="h-12 w-auto sm:h-16 rounded-lg object-contain"
        />
      </div>

      <div className="mx-auto max-w-lg text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm">
          <Sparkles className="h-3.5 w-3.5" /> Plataforma Educacional
        </div>

        <h1 className="mt-4 font-display text-4xl sm:text-5xl font-extrabold leading-none tracking-tight">
          Desafios de <span className="text-primary">Lógica</span>
        </h1>

        <img
          src={robot.url}
          alt="Robô mascote da plataforma acenando"
          width={768}
          height={768}
          className="mx-auto mt-4 h-48 w-48 animate-float object-contain sm:h-60 sm:w-60"
        />

        <div className="mt-2 rounded-3xl border bg-card p-6 shadow-xl">
          <p className="font-display text-lg font-bold">
            {hasGames ? "Adicionar novo jogo" : "Ainda estamos construindo as coisas por aqui!"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Insira o código do seu jogo abaixo para liberá-lo:
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setMsg(null); }}
              placeholder="EX: A1XX26"
              maxLength={10}
              aria-label="Código do jogo"
              className="w-full rounded-2xl border-2 bg-background px-4 py-4 text-center font-display text-2xl font-extrabold uppercase tracking-[0.3em] outline-none transition-colors focus:border-primary"
            />
            <Button type="submit" size="lg" className="h-14 w-full rounded-2xl text-lg font-bold">
              <KeyRound className="mr-2 h-5 w-5" /> Liberar jogo
            </Button>
          </form>

          {msg && (
            <p className={`mt-4 animate-pop-in rounded-2xl px-4 py-3 text-sm font-bold ${
              msg.tone === "ok" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            }`}>
              {msg.text}
            </p>
          )}

          {onBack && (
            <Button variant="ghost" className="mt-4 rounded-xl" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar aos jogos
            </Button>
          )}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Idealizado para alunos do 5º ao 9º ano • Funciona no celular, tablet e computador. Projeto INTEGRAÇÃO — SEMED-COARI.
        </p>
      </div>
    </div>
  );
}
