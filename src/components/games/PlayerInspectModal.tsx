import { useEffect, useState } from "react";
import { User, School, Trophy, Flame, Award, Shield, Star, Pencil, Check, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPlayerPublicProfile, updateStudentProfileByAdmin, type PlayerProfile } from "@/lib/playfab";
import { usePlayerAuth } from "@/lib/player-auth";
import {
  ageFrom,
  formatBirthdateBR,
  getAvailableSchoolsForAge,
  is5thGradeSchool,
  isOfficialSemedSchool,
  levelProgress,
  MAX_LEVEL,
  SCHOOLS,
  VALID_TURMAS,
} from "@/lib/player-profile";
import { PlayerMedalsInventory } from "./PlayerMedalsInventory";

interface Props {
  playerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentUpdated?: () => void;
}

export function PlayerInspectModal({ playerId, open, onOpenChange, onStudentUpdated }: Props) {
  const auth = usePlayerAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  // Estados de edição pelo Administrador
  const [isEditing, setIsEditing] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editBirthdate, setEditBirthdate] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editTurma, setEditTurma] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (open && playerId) {
      const found = getPlayerPublicProfile(playerId);
      setProfile(found);
      setIsEditing(false);
    } else {
      setProfile(null);
      setIsEditing(false);
    }
  }, [open, playerId]);

  if (!profile) return null;

  const age = ageFrom(profile.birthdate);
  const progress = levelProgress({
    xp: profile.xp,
    matchesPlayed: profile.totalMatches ?? 0,
    wins: profile.wins ?? 0,
    distinctGames: profile.distinctGamesPlayed ?? 0,
  });
  const isMe = auth.profile?.id === profile.id;

  async function handleSaveAdminEdit() {
    if (!profile) return;
    setSavingEdit(true);
    const updated = await updateStudentProfileByAdmin({
      playerId: profile.id,
      fullName: editFullName.trim(),
      birthdate: editBirthdate,
      school: editSchool,
      turma: editSchool === "Nenhuma" || editSchool === "Outro" ? null : (editTurma ? editTurma : null),
      grade: editSchool === "Nenhuma" || editSchool === "Outro" ? null : profile.grade,
    });
    setSavingEdit(false);
    if (updated) {
      setProfile(updated);
      setIsEditing(false);
      onStudentUpdated?.();
    }
  }

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
                  {Boolean(
                    profile.turma &&
                      profile.school &&
                      profile.school !== "Nenhuma" &&
                      profile.school !== "Outro"
                  ) && (
                    <span className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                      {profile.grade ? `${profile.grade} ` : ""}Turma {profile.turma}
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
                    {age} anos
                  </span>
                  {profile.birthdate && (
                    <span className="text-muted-foreground font-medium text-[11px]">
                      (Nasc: {formatBirthdateBR(profile.birthdate)})
                    </span>
                  )}
                  {auth.profile?.isAdmin && !isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditFullName(profile.full_name || "");
                        setEditBirthdate(profile.birthdate || "");
                        setEditSchool(profile.school || "Outro");
                        setEditTurma(profile.turma || "");
                        setIsEditing(true);
                      }}
                      className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary underline hover:text-primary/80"
                      title="Editar data de nascimento, nome, escola e turma deste aluno"
                    >
                      <Pencil className="h-3 w-3" /> Editar (ADM)
                    </button>
                  )}
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

          {/* Painel de Edição Rápida para o Administrador */}
          {isEditing && (
            <div className="rounded-2xl border-2 border-primary/40 bg-card p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-primary">
                <span className="flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Editar Cadastro do Aluno (ADM)
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Nível ({profile.level}), XP ({profile.xp}) e Medalhas não são alterados
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Nome Completo */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground">Nome Completo:</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value.toUpperCase())}
                    className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-semibold uppercase"
                    placeholder="NOME DO ALUNO"
                  />
                </div>

                {/* 2. Data de Nascimento */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground">Data de Nascimento:</label>
                  <input
                    type="date"
                    value={editBirthdate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setEditBirthdate(newDate);
                      const a = newDate ? ageFrom(newDate) : 0;
                      if (a >= 15 && isOfficialSemedSchool(editSchool)) {
                        setEditSchool("Nenhuma");
                        setEditTurma("");
                      } else if (a > 11 && is5thGradeSchool(editSchool)) {
                        setEditSchool("Nenhuma");
                        setEditTurma("");
                      }
                    }}
                    className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-semibold"
                  />
                  {editBirthdate && (
                    <div className="text-[10px] text-muted-foreground">
                      Idade calculada: <b>{ageFrom(editBirthdate)} anos</b>
                    </div>
                  )}
                </div>

                {/* 3. Instituição (Escola) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground">Instituição (Escola):</label>
                  <select
                    value={editSchool}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditSchool(val);
                      if (val === "Nenhuma" || val === "Outro") {
                        setEditTurma("");
                      }
                    }}
                    className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-semibold"
                  >
                    {getAvailableSchoolsForAge(editBirthdate).map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Turma */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground">Turma:</label>
                  <select
                    value={editTurma}
                    onChange={(e) => setEditTurma(e.target.value)}
                    disabled={editSchool === "Nenhuma" || editSchool === "Outro"}
                    className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-semibold disabled:opacity-50"
                  >
                    <option value="">Sem turma</option>
                    {VALID_TURMAS.map((t) => (
                      <option key={t} value={t}>
                        Turma {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={savingEdit}
                  className="rounded-xl border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary"
                >
                  <X className="inline h-3.5 w-3.5 mr-1" /> Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdminEdit}
                  disabled={savingEdit}
                  className="rounded-xl bg-primary px-4 py-1.5 text-xs font-black text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow"
                >
                  {savingEdit ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Salvar Alterações
                </button>
              </div>
            </div>
          )}

          {/* Barra de Progresso de XP */}
          <div className="rounded-2xl border bg-card p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-foreground">
                <Star className="h-4 w-4 text-accent fill-accent" />
                Nível {progress.level}/{MAX_LEVEL} — {progress.title}
              </span>
              <span className="text-primary font-mono font-black">{profile.xp} XP</span>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {progress.isMaxLevel
                  ? "Nível Máximo alcançado!"
                  : `${progress.current}/${progress.needed} XP para o Nível ${progress.level + 1}`}
              </span>
              <span className="font-semibold text-foreground">{progress.percent}%</span>
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
