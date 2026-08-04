import { Users, User } from "lucide-react";
import { OptionChip } from "./StartScreen";
import {
  DEFAULT_TEAMS,
  TEAM_NAME_MAX,
  sanitizeTeamName,
  type TeamConfig,
} from "@/lib/teams";
import { useState } from "react";

interface Props {
  value: TeamConfig;
  onChange: (c: TeamConfig) => void;
}

/** Pre-game selector: modo normal x equipes (padrão ou personalizada). */
export function TeamSetup({ value, onChange }: Props) {
  const [preset, setPreset] = useState<"padrao" | "custom">("padrao");
  const [customNames, setCustomNames] = useState<string[]>(["EQUIPE 1", "EQUIPE 2"]);

  function pickNormal() {
    onChange({ mode: "normal", teams: [] });
  }
  function pickTeams(kind: "padrao" | "custom", names?: string[]) {
    setPreset(kind);
    const list = kind === "padrao" ? DEFAULT_TEAMS : (names ?? customNames);
    onChange({ mode: "equipes", teams: list.map(sanitizeTeamName) });
  }
  function setCount(n: number) {
    const next = Array.from({ length: n }, (_, i) => customNames[i] ?? `EQUIPE ${i + 1}`);
    setCustomNames(next);
    pickTeams("custom", next);
  }
  function setName(i: number, name: string) {
    const next = [...customNames];
    next[i] = name.slice(0, TEAM_NAME_MAX);
    setCustomNames(next);
    onChange({ mode: "equipes", teams: next.map(sanitizeTeamName) });
  }

  const isTeams = value.mode === "equipes";

  return (
    <div className="rounded-2xl border bg-secondary/30 p-4">
      <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
        Modo de jogo
      </div>
      <div className="grid grid-cols-2 gap-2">
        <OptionChip active={!isTeams} onClick={pickNormal}>
          <span className="inline-flex items-center gap-2"><User className="h-4 w-4" /> Normal</span>
        </OptionChip>
        <OptionChip active={isTeams} onClick={() => pickTeams(preset)}>
          <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> Equipes</span>
        </OptionChip>
      </div>

      {isTeams && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <OptionChip active={preset === "padrao"} onClick={() => pickTeams("padrao")}>
              Equipe padrão
            </OptionChip>
            <OptionChip active={preset === "custom"} onClick={() => pickTeams("custom")}>
              Personalizada
            </OptionChip>
          </div>

          {preset === "padrao" ? (
            <div className="flex flex-wrap justify-center gap-2">
              {DEFAULT_TEAMS.map((t) => (
                <span key={t} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground text-center">
                Quantidade de equipes
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 4, 5].map((n) => (
                  <OptionChip key={n} active={customNames.length === n} onClick={() => setCount(n)}>
                    {n}
                  </OptionChip>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {customNames.map((n, i) => (
                  <input
                    key={i}
                    value={n}
                    maxLength={TEAM_NAME_MAX}
                    onChange={(e) => setName(i, e.target.value)}
                    placeholder={`Equipe ${i + 1}`}
                    className="rounded-xl border-2 bg-card px-3 py-2 font-display font-bold outline-none focus:border-primary"
                  />
                ))}
              </div>
              <div className="text-center text-xs text-muted-foreground">
                Até {TEAM_NAME_MAX} caracteres por nome
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
