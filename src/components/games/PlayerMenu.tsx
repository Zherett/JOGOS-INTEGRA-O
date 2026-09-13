import { useState } from "react";
import { User, LogOut, Cake, School, Trophy, Star, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlayerAuthDialog } from "./PlayerAuthDialog";
import { usePlayerAuth } from "@/lib/player-auth";
import { ageFrom, birthdayInfo, levelProgress } from "@/lib/player-profile";

const GAME_NAMES: Record<string, string> = {
  logica: "Lógica Matemática",
  cartesiano: "Plano Cartesiano",
  robogrid: "GridQuest",
  rpg: "RPG da Lógica",
  variaveis: "Caça às Variáveis",
  formas: "Formas e Cores",
  memoria: "Memória das Cores",
  minado: "Campo Minado Lógico",
  porcentagem: "Desafio das Partes",
};

/** Profile icon shown at the top of the platform. */
export function PlayerMenu() {
  const auth = usePlayerAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const profile = auth.profile;
  const age = profile ? ageFrom(profile.birthdate) : null;
  const bday = profile ? birthdayInfo(profile.birthdate) : null;
  const progress = profile ? levelProgress(profile.xp) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => (profile ? setProfileOpen(true) : setAuthOpen(true))}
        className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2 text-left shadow-sm transition-all hover:bg-secondary active:scale-95"
        aria-label={profile ? "Abrir meu perfil" : "Entrar na minha conta"}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <User className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block max-w-[9rem] truncate font-display text-sm font-bold leading-tight">
            {profile ? profile.nick : "Entrar"}
          </span>
          <span className="block text-[11px] leading-tight text-muted-foreground">
            {profile ? `Nível ${progress?.level}` : "criar perfil"}
          </span>
        </span>
      </button>

      <PlayerAuthDialog open={authOpen} onOpenChange={setAuthOpen} />

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-extrabold">Meu perfil</DialogTitle>
          </DialogHeader>

          {profile && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border bg-secondary/40 p-4">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <User className="h-8 w-8" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-extrabold">{profile.nick}</p>
                  <p className="truncate text-sm text-muted-foreground">{profile.full_name}</p>
                  <p className="text-sm text-muted-foreground">{age} anos</p>
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <p className="flex items-center gap-2">
                  <School className="h-4 w-4 text-primary" />
                  {profile.school}{profile.grade ? ` • ${profile.grade}` : ""}
                </p>
                <p className="flex items-center gap-2">
                  <Cake className="h-4 w-4 text-primary" />
                  Aniversário em {bday?.label}
                  {bday?.isToday ? " — é hoje! 🎉" : ` (faltam ${bday?.daysLeft} dias)`}
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span className="flex items-center gap-2"><Star className="h-4 w-4 text-accent" /> Nível {progress?.level}</span>
                  <span className="text-muted-foreground">{profile.xp} XP</span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress?.percent ?? 0}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {progress?.current}/{progress?.needed} XP para o próximo nível
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-4">
                <p className="flex items-center gap-2 font-bold"><Award className="h-4 w-4 text-accent" /> Conquistas</p>
                {profile.badges.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">Nenhuma conquista ainda — elas chegam em breve!</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.badges.map((b) => (
                      <span key={b.id} className="rounded-xl bg-accent/15 px-3 py-1 text-xs font-bold text-accent-foreground">
                        {b.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border bg-card p-4">
                <p className="flex items-center gap-2 font-bold"><Trophy className="h-4 w-4 text-accent" /> Meus jogos</p>
                {auth.stats.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">Você ainda não terminou nenhuma partida.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {auth.stats.map((s) => (
                      <li key={`${s.game_id}-${s.mode}`} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {GAME_NAMES[s.game_id] ?? s.game_id}
                          {s.mode !== "padrao" && <span className="text-muted-foreground"> • {s.mode}</span>}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {s.plays}x • recorde {s.best_score}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full rounded-2xl"
                onClick={async () => { await auth.signOut(); setProfileOpen(false); }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sair da conta
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
