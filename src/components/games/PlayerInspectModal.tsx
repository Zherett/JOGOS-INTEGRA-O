import { useEffect, useState } from "react";
import {
  User,
  School,
  Trophy,
  Flame,
  Award,
  Shield,
  Star,
  Pencil,
  Check,
  X,
  Loader2,
  Lock,
  CheckCircle2,
  Clock,
  Sparkles,
  Gamepad2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getPlayerPublicProfile,
  playfabCompleteInitialSchoolSetup,
  updateStudentProfileByAdmin,
  type PlayerProfile,
} from "@/lib/playfab";
import { usePlayerAuth } from "@/lib/player-auth";
import {
  ageFrom,
  formatBirthdateBR,
  getAvailableSchoolsForAge,
  is5thGradeSchool,
  isEtapa3OrOlder,
  isOfficialSemedSchool,
  levelProgress,
  MAX_LEVEL,
  RAIMUNDO_GRADES,
  schoolNeedsGrade,
  SCHOOLS,
  VALID_TURMAS,
  type TurmaCode,
} from "@/lib/player-profile";
import { aggregateStatsByGame, getDistinctGamesPlayed } from "@/lib/medals-catalog";
import { ALL_GAME_IDS, GAME_NAMES } from "@/lib/game-storage";
import { PlayerMedalsInventory } from "./PlayerMedalsInventory";
import { PresenceDot } from "./PresenceDot";

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
  const [editGrade, setEditGrade] = useState<string>(RAIMUNDO_GRADES[0]);
  const [editTurma, setEditTurma] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados de seleção única para o próprio jogador comum (caso ainda não tenha escolhido escola/série)
  const [selfSchool, setSelfSchool] = useState<string>("Nenhuma");
  const [selfGrade, setSelfGrade] = useState<string>(RAIMUNDO_GRADES[0]);
  const [selfTurma, setSelfTurma] = useState<string>("");
  const [savingSelf, setSavingSelf] = useState(false);

  useEffect(() => {
    if (open && playerId) {
      const found = getPlayerPublicProfile(playerId);
      setProfile(found);
      setIsEditing(false);
      if (found) {
        setSelfSchool(found.school || "Nenhuma");
        setSelfGrade(found.grade || RAIMUNDO_GRADES[0]);
        setSelfTurma(found.turma || "");
      }
    } else {
      setProfile(null);
      setIsEditing(false);
    }
  }, [open, playerId]);

  useEffect(() => {
    if (isEditing) {
      const available = getAvailableSchoolsForAge(editBirthdate);
      if (!available.some((s) => s.name === editSchool)) {
        setEditSchool("Nenhuma");
        setEditTurma("");
      }
    }
  }, [editBirthdate, editSchool, isEditing]);

  if (!profile) return null;

  const age = ageFrom(profile.birthdate);
  const distinctGames = getDistinctGamesPlayed(
    profile,
    profile.stats ?? [],
    undefined,
    auth.adminConfig.enabledGames,
  );
  const matchesCount = Math.max(
    profile.matchesPlayed ?? 0,
    profile.totalMatches ?? 0,
    (profile as any).totalPlays ?? 0,
  );
  const progress = levelProgress({
    xp: profile.xp,
    matchesPlayed: matchesCount,
    wins: profile.wins ?? 0,
    distinctGames,
  });
  const isMe = auth.profile?.id === profile.id;

  async function handleSaveAdminEdit() {
    if (!profile) return;
    setSavingEdit(true);
    const resolvedGrade =
      editSchool === "Nenhuma" || editSchool === "Outro"
        ? null
        : is5thGradeSchool(editSchool)
          ? "5º ano"
          : schoolNeedsGrade(editSchool)
            ? editGrade
            : profile.grade;
    const updated = await updateStudentProfileByAdmin({
      playerId: profile.id,
      fullName: editFullName.trim(),
      birthdate: editBirthdate,
      school: editSchool,
      turma: editSchool === "Nenhuma" || editSchool === "Outro" ? null : (editTurma ? editTurma : null),
      grade: resolvedGrade,
    });
    setSavingEdit(false);
    if (updated) {
      setProfile(updated);
      setIsEditing(false);
      onStudentUpdated?.();
    }
  }

  async function handleSaveSelfInitialSetup() {
    if (!profile) return;
    setSavingSelf(true);
    const targetSchool =
      profile.school && profile.school !== "Nenhuma" ? profile.school : selfSchool;
    const targetGrade = profile.grade
      ? profile.grade
      : is5thGradeSchool(targetSchool)
        ? "5º ano"
        : schoolNeedsGrade(targetSchool)
          ? selfGrade
          : null;
    const targetTurma = (profile.turma || selfTurma || null) as TurmaCode | null;

    const res = await playfabCompleteInitialSchoolSetup({
      school: targetSchool,
      grade: targetGrade,
      turma: targetTurma,
    });
    setSavingSelf(false);
    if (res.profile) {
      setProfile(res.profile);
      await auth.refresh();
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
                  <PresenceDot playerId={profile.id} size="sm" />
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
                        setEditGrade(profile.grade || RAIMUNDO_GRADES[0]);
                        setEditTurma(profile.turma || "");
                        setIsEditing(true);
                      }}
                      className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary underline hover:text-primary/80"
                      title="Editar data de nascimento, nome, escola, série e turma deste aluno"
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
                      } else if (schoolNeedsGrade(val) && !RAIMUNDO_GRADES.includes(editGrade as any)) {
                        setEditGrade(RAIMUNDO_GRADES[0]);
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

                {/* 4. Série / Ano (para Raimundo Bezerra) */}
                {schoolNeedsGrade(editSchool) && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground">Série / Ano:</label>
                    <select
                      value={editGrade}
                      onChange={(e) => setEditGrade(e.target.value)}
                      className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-semibold"
                    >
                      {RAIMUNDO_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 5. Turma */}
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

          {/* Seleção Única para o próprio jogador comum caso ainda não tenha definido Escola / Série na criação */}
          {isMe && !auth.profile?.isAdmin && !isEtapa3OrOlder(profile.birthdate) && (() => {
            const schoolNotSelected = !profile.school || profile.school === "Nenhuma";
            const effectiveSchool = schoolNotSelected ? selfSchool : profile.school;
            const needsGrade = !profile.grade && schoolNeedsGrade(effectiveSchool);
            const needsTurma = !profile.turma && isOfficialSemedSchool(effectiveSchool);
            if (!schoolNotSelected && !needsGrade && !needsTurma) return null;

            const availableSchools = getAvailableSchoolsForAge(profile.birthdate).filter(
              (s) => s.name !== "Nenhuma",
            );

            return (
              <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-primary">
                  <span className="flex items-center gap-1.5">
                    <School className="h-3.5 w-3.5" /> Completar Escola e Série (Seleção Única)
                  </span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Após selecionar, ficará fixo e somente o ADM poderá alterar
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground">Instituição (Escola):</label>
                    {schoolNotSelected ? (
                      <select
                        value={selfSchool}
                        onChange={(e) => setSelfSchool(e.target.value)}
                        className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-semibold"
                      >
                        <option value="Nenhuma">Selecione sua escola...</option>
                        {availableSchools.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="h-9 flex items-center rounded-xl border bg-muted/60 px-3 text-xs font-bold text-muted-foreground">
                        🔒 {profile.school} (Fixada)
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground">Série / Ano:</label>
                    {profile.grade ? (
                      <div className="h-9 flex items-center rounded-xl border bg-muted/60 px-3 text-xs font-bold text-muted-foreground">
                        🔒 {profile.grade} (Fixada)
                      </div>
                    ) : is5thGradeSchool(effectiveSchool) ? (
                      <div className="h-9 flex items-center rounded-xl border bg-primary/10 px-3 text-xs font-extrabold text-primary">
                        5º ano
                      </div>
                    ) : schoolNeedsGrade(effectiveSchool) ? (
                      <select
                        value={selfGrade}
                        onChange={(e) => setSelfGrade(e.target.value)}
                        className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-semibold"
                      >
                        {RAIMUNDO_GRADES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="h-9 flex items-center rounded-xl border bg-muted/40 px-3 text-xs text-muted-foreground">
                        Selecione a escola
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-foreground">Turma:</label>
                    {profile.turma ? (
                      <div className="h-9 flex items-center rounded-xl border bg-muted/60 px-3 text-xs font-bold text-muted-foreground">
                        🔒 Turma {profile.turma} (Fixada)
                      </div>
                    ) : isOfficialSemedSchool(effectiveSchool) ? (
                      <select
                        value={selfTurma}
                        onChange={(e) => setSelfTurma(e.target.value)}
                        className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-semibold"
                      >
                        <option value="">Selecione a turma...</option>
                        {VALID_TURMAS.map((t) => (
                          <option key={t} value={t}>
                            Turma {t}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="h-9 flex items-center rounded-xl border bg-muted/40 px-3 text-xs text-muted-foreground">
                        Não se aplica
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={savingSelf || (schoolNotSelected && selfSchool === "Nenhuma")}
                    onClick={() => void handleSaveSelfInitialSetup()}
                    className="rounded-xl bg-primary px-4 py-1.5 text-xs font-black text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 shadow"
                  >
                    {savingSelf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Confirmar e Fixar no Perfil
                  </button>
                </div>
              </div>
            );
          })()}

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

          {/* Requisitos e Missões para o Próximo Nível (Visível para ADM e Jogador) */}
          {progress.nextRequirement ? (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-wider text-primary">
                  <Lock className="h-3.5 w-3.5" /> Requisitos para o Nível {progress.nextRequirement.level} ({progress.nextRequirement.emoji} {progress.nextRequirement.title})
                </span>
                {progress.isLockedByMissions ? (
                  <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black text-amber-600 dark:text-amber-400">
                    Trava de Missões Ativa
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Em progresso
                  </span>
                )}
              </div>

              {progress.isLockedByMissions && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs font-semibold text-foreground flex items-start gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-600 dark:text-amber-400">XP Suficiente! </span>
                    O aluno já atingiu o XP necessário ({profile.xp} XP), mas ainda precisa cumprir as missões pendentes abaixo para destravar o Nível {progress.nextRequirement.level}.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {progress.checklist.map((item) => {
                  const diff = Math.max(0, item.required - item.current);
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-colors ${
                        item.met
                          ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                          : "border-border bg-secondary/30 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {item.met ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                        )}
                        <div className="min-w-0">
                          <div className={`truncate font-semibold ${item.met ? "text-foreground" : "text-foreground/90"}`}>
                            {item.label}
                          </div>
                          {!item.met && (
                            <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              {item.key === "xp"
                                ? `Faltam ${diff} XP`
                                : item.key === "matches"
                                  ? `Falta(m) ${diff} partida(s)`
                                  : item.key === "wins"
                                    ? `Falta(m) ${diff} vitória(s)`
                                    : `Falta(m) ${diff} jogo(s)`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`font-display font-black text-xs ${
                            item.met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                          }`}
                        >
                          {item.current} / {item.required}
                        </span>
                        {item.met && (
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Concluído
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center space-y-1">
              <div className="font-display text-sm font-black text-primary flex items-center justify-center gap-1.5">
                <Trophy className="h-4 w-4" /> Nível Máximo Alcançado!
              </div>
              <p className="text-xs text-muted-foreground">
                Este jogador já atingiu o Nível 10 (Lenda da Lógica) e cumpriu todos os requisitos da plataforma.
              </p>
            </div>
          )}

          {/* Histórico e Partidas Jogadas por Jogo */}
          {(() => {
            const statsMap = aggregateStatsByGame(profile.stats ?? [], auth.adminConfig.enabledGames);
            return (
              <div className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-display text-sm font-black text-foreground">
                    <Gamepad2 className="h-4 w-4 text-primary" />
                    <span>Partidas Jogadas por Jogo</span>
                  </div>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                    {matchesCount} partida{matchesCount === 1 ? "" : "s"} no total
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_GAME_IDS.map((gId) => {
                    const gName = GAME_NAMES[gId];
                    const statRow = statsMap.get(gId);
                    const plays = statRow ? statRow.plays : 0;
                    const bestScore = statRow ? statRow.best_score : 0;
                    const bestLevel = statRow ? statRow.best_level : 1;
                    const isEnabled = auth.adminConfig.enabledGames[gId] !== false;

                    return (
                      <div
                        key={gId}
                        className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-all ${
                          plays > 0
                            ? "bg-card border-primary/30"
                            : "bg-muted/30 border-dashed opacity-70"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-display text-xs font-bold truncate text-foreground flex items-center gap-1.5">
                            <span>{gName}</span>
                            {!isEnabled && (
                              <span className="rounded bg-muted px-1 text-[9px] font-bold text-muted-foreground">
                                Oculto
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {bestScore > 0 ? (
                              <span>Recorde: {bestScore} pts • Nv. {bestLevel}</span>
                            ) : (
                              <span>Nenhuma partida registrada</span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-black ${
                              plays > 0
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Gamepad2 className="h-3 w-3" />
                            {plays} partida{plays === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Inventário Completo de Medalhas */}
          <PlayerMedalsInventory
            unlockedMedals={profile.unlockedMedals}
            customMedals={auth.adminConfig.customMedals}
            profile={profile}
            stats={profile.stats ?? []}
            isOwner={isMe}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
