import { useEffect, useState } from "react";
import { User, School, Trophy, Flame, Award, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPlayerPublicProfile, type PlayerProfile } from "@/lib/playfab";
import { usePlayerAuth } from "@/lib/player-auth";
import { ageFrom, levelProgress, stageFromBirthdate } from "@/lib/player-profile";
import { PlayerMedalsInventory } from "./PlayerMedalsInventory";

interface Props {
  playerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlayerInspectModal({ playerId, open, onOpenChange }: Props) {
  const auth = usePlayerAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    if (open && playerId) {
      const found = getPlayerPublicProfile(playerId);
      setProfile(found);
    } else {
      setProfile(null);
    }
  }, [open, playerId]);

  if (!profile) return null;

  const age = ageFrom(profile.birthdate);
  const stage = stageFromBirthdate(profile.birthdate, new Date(), profile.school);
  const progress = levelProgress(profile.xp);
  const isMe = auth.profile?.id === profile.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] md:w-[90vw] max-w-4xl h-[88vh] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-3xl border bg-background shadow-2xl">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-extrabold text-foreground">
            <User className="h-5 w-5 text-primary" /> Perfil & Medalhas do Jogador
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Cabeçalho do Perfil Inspecionado */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border bg-secondary/30 p-4">
            <div className="flex items-center gap-3.5">
              {/* Nível destacado no lugar do ícone */}
              <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-primary/80 text-primary-foreground shadow-md border-2 border-primary/40">
                <div className="flex flex-col items-center justify-center leading-none text-center">
                  <span className="text-[9px] font-black uppercase text-primary-foreground/80">
                    NÍVEL
                  </span>
                  <span className="font-display text-2xl font-black">
                    {profile.level}
                  </span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-display text-xl font-black text-foreground">
                    {profile.nick}
                  </h3>
                  {isMe && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-black text-accent-foreground">
                      VOCÊ
                    </span>
                  )}
                  {profile.turma && (
                    <span className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                      Turma {profile.turma}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs font-semibold text-muted-foreground uppercase">{profile.full_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-extrabold text-primary">
                    {profile.xp} XP
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-semibold text-foreground">
                    {stage.emoji} {stage.shortLabel} ({age} anos)
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="rounded-xl border bg-card px-3 py-1.5">
                <span className="block text-[10px] font-bold text-muted-foreground">Escola</span>
                <span className="truncate font-display text-xs font-black text-foreground">
                  {profile.school}
                </span>
              </div>
              <div className="rounded-xl border bg-card px-3 py-1.5">
                <span className="block text-[10px] font-bold text-muted-foreground">Vitórias</span>
                <span className="font-display text-xs font-black text-accent">
                  {profile.wins ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Inventário Completo de Medalhas */}
          <PlayerMedalsInventory
            unlockedMedals={profile.unlockedMedals}
            customMedals={auth.adminConfig.customMedals}
            profile={profile}
            isOwner={isMe}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
