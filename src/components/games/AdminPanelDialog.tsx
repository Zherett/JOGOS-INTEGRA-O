import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Gamepad2,
  KeyRound,
  CalendarClock,
  RotateCcw,
  Save,
  Copy,
  Check,
  Sparkles,
  Cloud,
  Users,
  Lock,
  Unlock,
  Trash2,
  Award,
  Mail,
  Plus,
  Zap,
  Clock,
  School,
  Flame,
  Swords,
  UserCheck,
  ChevronRight,
  Calendar,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ALL_GAME_IDS, GAME_NAMES, type GameId } from "@/lib/game-storage";
import {
  DEFAULT_ENABLED_GAMES,
  DEFAULT_GAME_CODES,
  DEFAULT_MASTER_CODE,
  normalizeCode,
  type PlatformAdminConfig,
} from "@/lib/game-codes";
import { usePlayerAuth } from "@/lib/player-auth";
import {
  ageFrom,
  levelProgress,
  stageFromBirthdate,
  SCHOOLS,
  VALID_TURMAS,
  type TurmaCode,
} from "@/lib/player-profile";
import {
  getAllRegisteredPlayers,
  getLastAdminCloudSyncError,
  getPlayFabTitleId,
  grantPlayerMedalManually,
  isPlayFabConfigured,
  setAdminPin,
  syncStudentRosterFromPlayFab,
  playfabApproveTurmaRequest,
  playfabRejectTurmaRequest,
  type PlayerProfile,
} from "@/lib/playfab";
import {
  loadTurmaRequests,
  type TurmaChangeRequest,
} from "@/lib/player-profile";
import {
  loadSpecialEvents,
  saveSpecialEvents,
  createSpecialEvent,
  formatEventRemainingTime,
  formatDateOnlyBR,
  formatDateTimeBR,
  isEventActive,
  loadRecurringEvents,
  saveRecurringEvents,
  createRecurringEvent,
  isRecurringEventActive,
  DAYS_OF_WEEK,
  getEventLinkedMedalIds,
  type SpecialEvent,
  type RecurringEvent,
  type EventBonusType,
} from "@/lib/custom-events";
import {
  AVAILABLE_MEDAL_ICONS,
  getAllAvailableMedals,
  getDistinctGamesPlayed,
  getEffectivePlayerProgression,
  RARITY_INFO,
  formatEventRequirementLabel,
  type MedalDefinition,
  type MedalRarity,
  type EventRequirementType,
  type EventMedalRequirement,
} from "@/lib/medals-catalog";
import {
  getActiveRotatedX1Game,
  loadX1MatchHistory,
  markAllX1MatchesRead,
  clearX1MatchHistory,
  type X1MatchLogEntry,
} from "@/lib/x1-challenge";
import { MedalIcon } from "./MedalIcon";
import { PlayerInspectModal } from "./PlayerInspectModal";
import { PresenceDot } from "./PresenceDot";
import {
  computePresenceSummary,
  PRESENCE_UPDATED_EVENT,
  syncPresenceFromPlayFab,
} from "@/lib/presence";
import { TournamentRankBadge } from "./TournamentRankBadge";
import {
  AGE_STAGES,
  getTournamentRank,
  getWeeklyTournamentSnapshot,
  syncWeeklyTournamentWithPlayFab,
  type AgeStageId,
} from "@/lib/weekly-tournament";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfigSaved?: () => void;
}

type AdminTab = "jogos" | "arena_x1" | "torneio" | "eventos" | "medalhas" | "turmas" | "resets" | "sistema";

function randomGameCode(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = prefix.slice(0, 1).toUpperCase();
  for (let i = 0; i < 5; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const EVENT_REQUIREMENT_OPTIONS: {
  type: EventRequirementType;
  label: string;
  unit: string;
  defaultVal: number;
}[] = [
  { type: "event_matches", label: "Partidas Jogadas no Evento", unit: "partida(s)", defaultVal: 5 },
  { type: "event_xp", label: "XP Acumulado no Evento", unit: "XP", defaultVal: 300 },
  { type: "event_score", label: "Pontuação Máxima em uma Partida", unit: "pontos", defaultVal: 50 },
  { type: "event_level", label: "Nível Alcançado no Jogo", unit: "Nível", defaultVal: 3 },
  { type: "event_flawless", label: "Vitória com Zero Erros (Partida Perfeita)", unit: "partida(s) com 0 erros", defaultVal: 1 },
  { type: "event_x1_wins", label: "Gladiador do X1 (Vitórias no Versus Online)", unit: "vitória(s)", defaultVal: 3 },
  { type: "event_combo", label: "Sequência de Acertos (Combo sem Erros)", unit: "acertos seguidos", defaultVal: 10 },
  { type: "event_daily_cap", label: "Constância (Bater Limite Diário de XP)", unit: "dia(s)", defaultVal: 1 },
  { type: "event_team_matches", label: "Espírito de Equipe (Modo Grupos)", unit: "partida(s)", defaultVal: 3 },
  { type: "event_distinct_games", label: "Explorador Multijogos do Evento", unit: "jogos diferentes", defaultVal: 3 },
];

export function AdminPanelDialog({ open, onOpenChange, onConfigSaved }: Props) {
  const auth = usePlayerAuth();
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("jogos");
  const [draft, setDraft] = useState<PlatformAdminConfig>(auth.adminConfig);
  const [copied, setCopied] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [, setPresenceTick] = useState(0);
  const [tournamentStageFilter, setTournamentStageFilter] = useState<AgeStageId | "TODAS">("TODAS");
  const [syncingTournament, setSyncingTournament] = useState(false);

  // Special Events states (with 3 simultaneous lines of bonus)
  const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([]);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [evScope, setEvScope] = useState<"todos" | GameId>("todos");
  const [evBonusType, setEvBonusType] = useState<EventBonusType>("personalizado");
  const [evHasMultiplier, setEvHasMultiplier] = useState(true);
  const [evMultiplier, setEvMultiplier] = useState<number>(2);
  const [evHasMatchCap, setEvHasMatchCap] = useState(false);
  const [evMatchXpCap, setEvMatchXpCap] = useState<number>(30);
  const [evHasDailyCap, setEvHasDailyCap] = useState(false);
  const [evDailyExtraXp, setEvDailyExtraXp] = useState<number>(500);
  const [evDurationHours, setEvDurationHours] = useState<number>(24);
  const [evLinkedMedalId, setEvLinkedMedalId] = useState<string>("");
  const [evObjective, setEvObjective] = useState<string>("");

  // Event Medals state for punctual events
  const [evAttachedMedals, setEvAttachedMedals] = useState<MedalDefinition[]>([]);
  const [isAddingMedalToEv, setIsAddingMedalToEv] = useState(false);
  const [evMedalMode, setEvMedalMode] = useState<"novo" | "existente">("novo");
  const [evNewMedalTitle, setEvNewMedalTitle] = useState("");
  const [evNewMedalDesc, setEvNewMedalDesc] = useState("");
  const [evNewMedalRarity, setEvNewMedalRarity] = useState<MedalRarity>("ouro");
  const [evNewMedalIcon, setEvNewMedalIcon] = useState("Award");
  const [evNewMedalReqType, setEvNewMedalReqType] = useState<EventRequirementType>("event_matches");
  const [evNewMedalScope, setEvNewMedalScope] = useState<"todos" | GameId>("todos");
  const [evNewMedalThreshold, setEvNewMedalThreshold] = useState<number>(5);
  const [evNewMedalMinScore, setEvNewMedalMinScore] = useState<number>(30);
  const [evSelectedExistingMedalId, setEvSelectedExistingMedalId] = useState("");

  // Eventos Sub-Abas: "criacao" e "recorrentes"
  const [eventosSubTab, setEventosSubTab] = useState<"criacao" | "recorrentes">("criacao");
  const [recurringEvents, setRecurringEvents] = useState<RecurringEvent[]>([]);
  const [isCreatingRecurring, setIsCreatingRecurring] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  const [recDesc, setRecDesc] = useState("");
  const [recScope, setRecScope] = useState<"todos" | GameId>("todos");
  const [recDaysOfWeek, setRecDaysOfWeek] = useState<number[]>([6, 0]); // Padrão: Sábado e Domingo
  const [recSpecificDates, setRecSpecificDates] = useState<string[]>([]);
  const [recDateInput, setRecDateInput] = useState("");
  const [recHasMultiplier, setRecHasMultiplier] = useState(true);
  const [recMultiplier, setRecMultiplier] = useState<number>(1.5);
  const [recHasMatchCap, setRecHasMatchCap] = useState(false);
  const [recMatchCap, setRecMatchCap] = useState<number>(30);
  const [recHasDailyCap, setRecHasDailyCap] = useState(false);
  const [recDailyExtraXp, setRecDailyExtraXp] = useState<number>(500);
  const [recLinkedMedal, setRecLinkedMedal] = useState<string>("");
  const [recObjective, setRecObjective] = useState<string>("");

  // Event Medals state for recurring events
  const [recAttachedMedals, setRecAttachedMedals] = useState<MedalDefinition[]>([]);
  const [isAddingMedalToRec, setIsAddingMedalToRec] = useState(false);
  const [recMedalMode, setRecMedalMode] = useState<"novo" | "existente">("novo");
  const [recNewMedalTitle, setRecNewMedalTitle] = useState("");
  const [recNewMedalDesc, setRecNewMedalDesc] = useState("");
  const [recNewMedalRarity, setRecNewMedalRarity] = useState<MedalRarity>("ouro");
  const [recNewMedalIcon, setRecNewMedalIcon] = useState("Award");
  const [recNewMedalReqType, setRecNewMedalReqType] = useState<EventRequirementType>("event_matches");
  const [recNewMedalScope, setRecNewMedalScope] = useState<"todos" | GameId>("todos");
  const [recNewMedalThreshold, setRecNewMedalThreshold] = useState<number>(5);
  const [recNewMedalMinScore, setRecNewMedalMinScore] = useState<number>(30);
  const [recSelectedExistingMedalId, setRecSelectedExistingMedalId] = useState("");

  // Arena X1 Caixa de Entrada / Histórico
  const [x1History, setX1History] = useState<X1MatchLogEntry[]>([]);

  // Turmas & Escolas states (2 Sub-abas: 1 = Visão por Escolas & Turmas, 2 = Solicitações de Troca)
  const [turmaSubTab, setTurmaSubTab] = useState<"visao" | "solicitacoes">("visao");
  const [selectedAdminSchool, setSelectedAdminSchool] = useState<string>("TODAS");
  const [selectedAdminTurma, setSelectedAdminTurma] = useState<TurmaCode | "TODAS">("TODAS");
  const [registeredStudents, setRegisteredStudents] = useState<PlayerProfile[]>([]);
  const [turmaRequests, setTurmaRequests] = useState<TurmaChangeRequest[]>([]);

  // Reset schedule states
  const [scheduleInput, setScheduleInput] = useState("");
  const [scheduleClearXp, setScheduleClearXp] = useState(false);
  const [nextSeasonName, setNextSeasonName] = useState("");
  const [nowClearXp, setNowClearXp] = useState(false);
  const [confirmResetNow, setConfirmResetNow] = useState(false);

  // System states
  const [newAdminPin, setNewAdminPin] = useState("");

  // Custom Medal Form states
  const [isCreatingMedal, setIsCreatingMedal] = useState(false);
  const [newMedalTitle, setNewMedalTitle] = useState("");
  const [newMedalDesc, setNewMedalDesc] = useState("");
  const [newMedalRarity, setNewMedalRarity] = useState<MedalRarity>("ouro");
  const [newMedalIcon, setNewMedalIcon] = useState("Award");
  const [newMedalMode, setNewMedalMode] = useState<"manual" | "evento">("evento");
  const [newMedalReqType, setNewMedalReqType] = useState<EventRequirementType>("event_matches");
  const [newMedalScope, setNewMedalScope] = useState<"todos" | GameId>("todos");
  const [newMedalThreshold, setNewMedalThreshold] = useState<number>(5);

  // Manual Grant Modal state
  const [grantMedalTarget, setGrantMedalTarget] = useState<MedalDefinition | null>(null);
  const [selectedStudentForGrant, setSelectedStudentForGrant] = useState<string>("");
  const [inspectStudentId, setInspectStudentId] = useState<string | null>(null);
  const [syncingRoster, setSyncingRoster] = useState(false);

  // Consolidação de partidas jogadas por jogo para a Lista de Jogos do ADM
  const gameStatsSummary = useMemo(() => {
    const counts: Record<GameId, { totalPlays: number; admPlays: number }> = {} as any;
    for (const gId of ALL_GAME_IDS) {
      counts[gId] = { totalPlays: 0, admPlays: 0 };
    }

    // 1. Partidas disputadas pelos alunos cadastrados no sistema
    for (const st of registeredStudents) {
      if (Array.isArray(st.stats)) {
        for (const row of st.stats) {
          if (row && row.game_id && counts[row.game_id]) {
            counts[row.game_id].totalPlays += Math.max(0, row.plays ?? 0);
          }
        }
      }
    }

    // 2. Partidas jogadas pela conta do próprio ADM
    if (Array.isArray(auth.stats)) {
      const admAlreadyInStudents = registeredStudents.some((s) => s.id === auth.profile?.id);
      for (const row of auth.stats) {
        if (row && row.game_id && counts[row.game_id]) {
          const p = Math.max(0, row.plays ?? 0);
          counts[row.game_id].admPlays += p;
          if (!admAlreadyInStudents) {
            counts[row.game_id].totalPlays += p;
          }
        }
      }
    }

    return counts;
  }, [registeredStudents, auth.stats, auth.profile?.id]);

  // Identificação de medalhas já atreladas a eventos ativos
  const activeLinkedMedalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ev of specialEvents) {
      if (ev.active) {
        getEventLinkedMedalIds(ev).forEach((id) => ids.add(id));
      }
    }
    for (const ev of recurringEvents) {
      if (ev.active) {
        getEventLinkedMedalIds(ev).forEach((id) => ids.add(id));
      }
    }
    return ids;
  }, [specialEvents, recurringEvents]);

  // Medalhas de eventos disponíveis que não estão atualmente em uso em eventos ativos
  const availableExistingEventMedals = useMemo(() => {
    return getAllAvailableMedals(draft.customMedals).filter(
      (m) =>
        (m.category === "evento" || Boolean(m.eventRequirement)) &&
        !activeLinkedMedalIds.has(m.id)
    );
  }, [draft.customMedals, activeLinkedMedalIds]);

  useEffect(() => {
    if (!open) return;
    setDraft(auth.adminConfig);
    setSpecialEvents(loadSpecialEvents());
    setRecurringEvents(loadRecurringEvents());
    setX1History(loadX1MatchHistory());
    setTurmaRequests(loadTurmaRequests());
    setRegisteredStudents(getAllRegisteredPlayers());

    // Automatically sync cloud student roster and presence from PlayFab when opening ADM
    setSyncingRoster(true);
    void syncPresenceFromPlayFab(true);
    void syncStudentRosterFromPlayFab()
      .then((players) => setRegisteredStudents(players))
      .finally(() => setSyncingRoster(false));

    const onPresenceChange = () => {
      setPresenceTick((t) => t + 1);
    };
    window.addEventListener(PRESENCE_UPDATED_EVENT, onPresenceChange);
    const presencePoll = window.setInterval(() => {
      void syncPresenceFromPlayFab();
      setPresenceTick((t) => t + 1);
    }, 8000);

    setScheduleClearXp(auth.adminConfig.scheduledResetClearXp);
    if (auth.adminConfig.scheduledResetAt) {
      const d = new Date(auth.adminConfig.scheduledResetAt);
      if (!Number.isNaN(d.getTime())) {
        const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setScheduleInput(localIso);
      }
    } else {
      setScheduleInput("");
    }
    setNextSeasonName(`Temporada ${auth.adminConfig.seasonId + 1} • SEMED Coari`);
    setConfirmResetNow(false);
    setSavedMsg(null);
    return () => {
      window.removeEventListener(PRESENCE_UPDATED_EVENT, onPresenceChange);
      window.clearInterval(presencePoll);
    };
  }, [open, auth.adminConfig]);

  async function handleRefreshRoster() {
    setSyncingRoster(true);
    try {
      await syncPresenceFromPlayFab(true);
      const players = await syncStudentRosterFromPlayFab();
      setRegisteredStudents(players);
      setPresenceTick((t) => t + 1);
      flashSaved(`${players.length} alunos sincronizados com a nuvem!`);
    } finally {
      setSyncingRoster(false);
    }
  }

  function flashSaved(msg: string) {
    setSavedMsg(msg);
    window.setTimeout(() => setSavedMsg(null), 3000);
  }

  /** Mostra sucesso apenas se a configuração foi publicada na nuvem para todos os dispositivos. */
  function flashCloudResult(successMsg: string) {
    const err = getLastAdminCloudSyncError();
    if (err) {
      setSavedMsg(`⚠️ Salvo só neste dispositivo — falha ao publicar para todos: ${err}`);
      window.setTimeout(() => setSavedMsg(null), 7000);
    } else {
      flashSaved(`${successMsg} (publicado para todos os dispositivos)`);
    }
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (auth.unlockAdminWithPin(pinInput)) {
      setPinInput("");
      setPinError(null);
    } else {
      setPinError("Código de administrador incorreto.");
    }
  }

  async function saveGamesAndCodes() {
    await auth.updateAdminConfig(draft);
    onConfigSaved?.();
    flashCloudResult("Jogos e códigos salvos com sucesso!");
  }

  async function handleToggleRequireCodeGate() {
    const nextState = !draft.requireCodeGate;
    const updated: PlatformAdminConfig = { ...draft, requireCodeGate: nextState };
    setDraft(updated);
    await auth.updateAdminConfig(updated);
    onConfigSaved?.();
    flashCloudResult(
      nextState
        ? `🔒 Jogos travados com código Master (${draft.masterCode || "SEMED26"})!`
        : "🔓 Jogos liberados para todos sem necessidade de código!",
    );
  }

  async function handleToggleGame(id: GameId, nextVal: boolean) {
    const updated: PlatformAdminConfig = {
      ...draft,
      enabledGames: { ...draft.enabledGames, [id]: nextVal },
    };
    setDraft(updated);
    await auth.updateAdminConfig(updated);
    onConfigSaved?.();
    flashCloudResult(
      nextVal
        ? `✅ "${GAME_NAMES[id]}" ativado e visível na página inicial!`
        : `🚫 "${GAME_NAMES[id]}" desmarcado e ocultado da página inicial!`,
    );
  }

  async function restoreDefaultCodes() {
    const restored: PlatformAdminConfig = {
      ...draft,
      enabledGames: { ...DEFAULT_ENABLED_GAMES },
      gameCodes: { ...DEFAULT_GAME_CODES },
      masterCode: DEFAULT_MASTER_CODE,
    };
    setDraft(restored);
    await auth.updateAdminConfig(restored);
    onConfigSaved?.();
    flashCloudResult("Códigos e jogos restaurados para o padrão com sucesso!");
  }

  async function copyCodesList() {
    const lines = ALL_GAME_IDS.filter((id) => draft.enabledGames[id]).map(
      (id) => `• ${GAME_NAMES[id]}: ${draft.gameCodes[id]}`,
    );
    const text = [
      "🔑 CÓDIGOS DOS JOGOS — DESAFIOS DE LÓGICA (SEMED)",
      ...lines,
      `⭐ Código Mestre (Professor): ${draft.masterCode}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function saveScheduledReset() {
    if (!scheduleInput) {
      const cleared: PlatformAdminConfig = {
        ...draft,
        scheduledResetAt: null,
        scheduledResetClearXp: false,
      };
      setDraft(cleared);
      await auth.updateAdminConfig(cleared);
      flashSaved("Agendamento de reset removido.");
      return;
    }
    const parsed = new Date(scheduleInput);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      flashSaved("Escolha uma data e hora no futuro para o agendamento.");
      return;
    }
    const updated: PlatformAdminConfig = {
      ...draft,
      scheduledResetAt: parsed.toISOString(),
      scheduledResetClearXp: scheduleClearXp,
    };
    setDraft(updated);
    await auth.updateAdminConfig(updated);
    flashSaved(
      `Reset agendado para ${parsed.toLocaleDateString("pt-BR")} às ${parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}!`,
    );
  }

  async function cancelScheduledReset() {
    setScheduleInput("");
    const updated: PlatformAdminConfig = {
      ...draft,
      scheduledResetAt: null,
      scheduledResetClearXp: false,
    };
    setDraft(updated);
    await auth.updateAdminConfig(updated);
    flashSaved("Agendamento de reset cancelado.");
  }

  async function executeImmediateReset() {
    await auth.triggerReset({
      clearXp: nowClearXp,
      newSeasonName: nextSeasonName,
      reason: "Reset imediato acionado pelo painel ADM",
    });
    setConfirmResetNow(false);
    onConfigSaved?.();
    flashSaved("Ranking resetado e nova temporada iniciada!");
  }

  async function saveSystemSettings() {
    await auth.updateAdminConfig(draft);
    if (newAdminPin.trim().length >= 4) {
      setAdminPin(newAdminPin.trim());
      setNewAdminPin("");
    }
    onConfigSaved?.();
    flashSaved("Configurações da plataforma atualizadas!");
  }

  function renderActiveBonusesLabel(ev: {
    xpMultiplier?: number;
    matchXpCap?: number;
    dailyXpCap?: number;
    bonusType?: string;
    bonusValue?: number;
    linkedMedalIds?: string[];
    linkedMedalId?: string | null;
  }): string {
    const parts: string[] = [];
    if (ev.xpMultiplier && ev.xpMultiplier > 1) {
      parts.push(
        ev.xpMultiplier === 2
          ? "2x XP (Dobro)"
          : `${ev.xpMultiplier}x XP (+${Math.round((ev.xpMultiplier - 1) * 100)}%)`,
      );
    }
    if (ev.matchXpCap && ev.matchXpCap > 20) {
      parts.push(`Max ${ev.matchXpCap} XP/partida`);
    }
    if (ev.dailyXpCap && ev.dailyXpCap > 1000) {
      parts.push(`+${ev.dailyXpCap - 1000} XP/dia (${ev.dailyXpCap} total)`);
    } else if (ev.bonusType === "aumentar_limite_diario" && ev.bonusValue && ev.bonusValue > 1000) {
      parts.push(`+${ev.bonusValue - 1000} XP/dia (${ev.bonusValue} total)`);
    }
    if (parts.length === 0) {
      if (ev.bonusType === "dobro_xp") parts.push("2x XP (Dobro)");
      else if (ev.bonusType === "xp_1_5x") parts.push("1.5x XP (+50%)");
      else if ((ev.linkedMedalIds && ev.linkedMedalIds.length > 0) || ev.linkedMedalId) {
        parts.push("Medalha de Evento");
      } else {
        parts.push("Bônus Ativo");
      }
    }
    return parts.join(" • ");
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!evTitle.trim()) {
      flashSaved("Informe o título do evento.");
      return;
    }
    const hasAnyBonus = evHasMultiplier || evHasMatchCap || evHasDailyCap;
    const hasAnyMedal = evAttachedMedals.length > 0 || Boolean(evLinkedMedalId);
    if (!hasAnyBonus && !hasAnyMedal) {
      flashSaved("Marque pelo menos uma caixa de bônus ou vincule uma medalha ao evento.");
      return;
    }
    const newCustoms = [...(draft.customMedals ?? [])];
    const linkedIds: string[] = [];
    for (const m of evAttachedMedals) {
      if (!newCustoms.some((c) => c.id === m.id)) {
        newCustoms.push(m);
      }
      linkedIds.push(m.id);
    }

    createSpecialEvent({
      title: evTitle,
      description: evDesc,
      scope: evScope,
      bonusType: evHasDailyCap
        ? "aumentar_limite_diario"
        : evHasMultiplier
          ? evMultiplier === 2
            ? "dobro_xp"
            : "xp_1_5x"
          : "personalizado",
      bonusValue: evHasDailyCap ? 1000 + Number(evDailyExtraXp) : undefined,
      xpMultiplier: evHasMultiplier ? Number(evMultiplier) : undefined,
      matchXpCap: evHasMatchCap ? Number(evMatchXpCap) : undefined,
      dailyXpCap: evHasDailyCap ? 1000 + Number(evDailyExtraXp) : undefined,
      durationHours: Number(evDurationHours),
      linkedMedalId: linkedIds[0] ?? (evLinkedMedalId || null),
      linkedMedalIds: linkedIds,
      objectiveDescription: evObjective || null,
    });
    const updated = loadSpecialEvents();
    setSpecialEvents(updated);
    setIsCreatingEvent(false);
    setEvTitle("");
    setEvDesc("");
    setEvObjective("");
    setEvAttachedMedals([]);
    const nextCfg = { ...draft, specialEvents: updated, customMedals: newCustoms };
    setDraft(nextCfg);
    await auth.updateAdminConfig(nextCfg);
    flashSaved(
      isPlayFabConfigured()
        ? "✅ Evento especial salvo no Banco de Dados (PlayFab) e ativado!"
        : "💾 Evento especial salvo localmente neste navegador!"
    );
    onConfigSaved?.();
  }

  async function handleToggleEventActive(id: string) {
    const list = specialEvents.map((ev) =>
      ev.id === id ? { ...ev, active: !ev.active } : ev,
    );
    setSpecialEvents(list);
    saveSpecialEvents(list);
    const nextCfg = { ...draft, specialEvents: list };
    setDraft(nextCfg);
    await auth.updateAdminConfig(nextCfg);
    flashSaved(
      isPlayFabConfigured()
        ? "✅ Status sincronizado com o Banco de Dados (PlayFab)!"
        : "💾 Status do evento atualizado localmente!"
    );
    onConfigSaved?.();
  }

  async function handleDeleteEvent(id: string) {
    const list = specialEvents.filter((ev) => ev.id !== id);
    setSpecialEvents(list);
    saveSpecialEvents(list);
    const nextCfg = { ...draft, specialEvents: list };
    setDraft(nextCfg);
    await auth.updateAdminConfig(nextCfg);
    flashSaved(
      isPlayFabConfigured()
        ? "✅ Evento excluído do Banco de Dados (PlayFab)!"
        : "💾 Evento excluído localmente."
    );
    onConfigSaved?.();
  }

  async function handleCreateRecurringEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!recTitle.trim()) {
      flashSaved("Informe o título do evento recorrente.");
      return;
    }
    if (recDaysOfWeek.length === 0 && recSpecificDates.length === 0) {
      flashSaved("Selecione pelo menos um dia da semana ou uma data específica.");
      return;
    }
    const hasAnyBonus = recHasMultiplier || recHasMatchCap || recHasDailyCap;
    const hasAnyMedal = recAttachedMedals.length > 0 || Boolean(recLinkedMedal);
    if (!hasAnyBonus && !hasAnyMedal) {
      flashSaved("Marque pelo menos uma caixa de bônus ou vincule uma medalha ao evento.");
      return;
    }
    const newCustoms = [...(draft.customMedals ?? [])];
    const linkedIds: string[] = [];
    for (const m of recAttachedMedals) {
      if (!newCustoms.some((c) => c.id === m.id)) {
        newCustoms.push(m);
      }
      linkedIds.push(m.id);
    }

    createRecurringEvent({
      title: recTitle,
      description: recDesc,
      scope: recScope,
      daysOfWeek: recDaysOfWeek,
      specificDates: recSpecificDates,
      xpMultiplier: recHasMultiplier ? Number(recMultiplier) : undefined,
      matchXpCap: recHasMatchCap ? Number(recMatchCap) : undefined,
      dailyXpCap: recHasDailyCap ? 1000 + Number(recDailyExtraXp) : undefined,
      linkedMedalId: linkedIds[0] ?? (recLinkedMedal || null),
      linkedMedalIds: linkedIds,
      objectiveDescription: recObjective || null,
    });
    const updated = loadRecurringEvents();
    setRecurringEvents(updated);
    setIsCreatingRecurring(false);
    setRecTitle("");
    setRecDesc("");
    setRecObjective("");
    setRecSpecificDates([]);
    setRecDaysOfWeek([6, 0]);
    setRecAttachedMedals([]);
    const nextCfg = { ...draft, recurringEvents: updated, customMedals: newCustoms };
    setDraft(nextCfg);
    await auth.updateAdminConfig(nextCfg);
    flashSaved(
      isPlayFabConfigured()
        ? "✅ Evento recorrente salvo no Banco de Dados (PlayFab) e ativado!"
        : "💾 Evento recorrente salvo localmente neste navegador!"
    );
    onConfigSaved?.();
  }

  async function handleToggleRecurringActive(id: string) {
    const list = recurringEvents.map((ev) =>
      ev.id === id ? { ...ev, active: !ev.active } : ev,
    );
    setRecurringEvents(list);
    saveRecurringEvents(list);
    const nextCfg = { ...draft, recurringEvents: list };
    setDraft(nextCfg);
    await auth.updateAdminConfig(nextCfg);
    flashSaved(
      isPlayFabConfigured()
        ? "✅ Status recorrente sincronizado com o Banco de Dados (PlayFab)!"
        : "💾 Status do evento recorrente atualizado localmente!"
    );
    onConfigSaved?.();
  }

  async function handleDeleteRecurringEvent(id: string) {
    const list = recurringEvents.filter((ev) => ev.id !== id);
    setRecurringEvents(list);
    saveRecurringEvents(list);
    const nextCfg = { ...draft, recurringEvents: list };
    setDraft(nextCfg);
    await auth.updateAdminConfig(nextCfg);
    flashSaved(
      isPlayFabConfigured()
        ? "✅ Evento recorrente excluído do Banco de Dados (PlayFab)!"
        : "💾 Evento recorrente excluído localmente."
    );
    onConfigSaved?.();
  }

  async function handleApproveTurma(requestId: string) {
    await playfabApproveTurmaRequest(requestId);
    setTurmaRequests(loadTurmaRequests());
    flashSaved("Troca de turma aprovada!");
    onConfigSaved?.();
  }

  async function handleRejectTurma(requestId: string) {
    await playfabRejectTurmaRequest(requestId);
    setTurmaRequests(loadTurmaRequests());
    flashSaved("Solicitação de troca recusada.");
    onConfigSaved?.();
  }

  const players = open && auth.isAdmin ? getAllRegisteredPlayers() : [];
  const pendingTurmaCount = turmaRequests.filter((r) => r.status === "pendente").length;
  const activeEventsCount =
    specialEvents.filter((e) => isEventActive(e)).length +
    recurringEvents.filter((e) => isRecurringEventActive(e)).length;
  const unreadNotifsCount = draft.adminMedalNotifications?.filter((n) => !n.read).length ?? 0;
  const unreadX1Count = x1History.filter((h) => !h.read).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] md:w-[92vw] max-w-5xl h-[88vh] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-3xl border bg-background shadow-2xl">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2 font-display text-2xl font-extrabold text-foreground">
            <ShieldCheck className="h-6 w-6 text-primary" /> Painel do Administrador (ADM)
          </DialogTitle>
        </DialogHeader>

        {!auth.isAdmin ? (
          <form onSubmit={handlePinSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <div className="rounded-2xl border bg-secondary/40 p-4 text-sm text-muted-foreground">
              Insira a chave de Administrador ou o Código Mestre do Professor para configurar os
              jogos disponíveis, códigos de acesso e agendamentos de reset do ranking.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-pin">Chave / Senha de Administrador</Label>
              <Input
                id="admin-pin"
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(null);
                }}
                placeholder="Digite o código ADM (ex: SEMED26)"
                className="rounded-xl"
                autoFocus
                required
              />
            </div>
            {pinError && (
              <p className="rounded-xl bg-destructive/15 px-3 py-2 text-sm font-semibold text-destructive">
                {pinError}
              </p>
            )}
            <Button type="submit" size="lg" className="h-12 w-full rounded-2xl font-bold">
              <Lock className="mr-2 h-4 w-4" /> Acessar Painel ADM
            </Button>
          </form>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Header Tabs */}
            <div className="px-6 py-3 border-b shrink-0 bg-secondary/30">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 rounded-2xl bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => setTab("jogos")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors ${
                    tab === "jogos" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <Gamepad2 className="h-4 w-4" /> Jogos
                </button>
                <button
                  type="button"
                  onClick={() => setTab("arena_x1")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors ${
                    tab === "arena_x1" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <Swords className="h-4 w-4 text-accent" /> Arena X1
                  {unreadX1Count > 0 && (
                    <span className="rounded-full bg-accent text-accent-foreground px-1.5 py-0.2 text-[10px] font-black">
                      {unreadX1Count}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("torneio")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors ${
                    tab === "torneio" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <Trophy className="h-4 w-4 text-accent" /> Torneio
                </button>
                <button
                  type="button"
                  onClick={() => setTab("eventos")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors ${
                    tab === "eventos" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <Zap className="h-4 w-4 text-amber-500" /> Eventos
                  {activeEventsCount > 0 && (
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("medalhas")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors ${
                    tab === "medalhas" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <Award className="h-4 w-4 text-accent" /> Medalhas
                  {unreadNotifsCount > 0 && (
                    <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("turmas")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors ${
                    tab === "turmas" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <School className="h-4 w-4 text-primary" /> Turmas & Escolas
                  {pendingTurmaCount > 0 && (
                    <span className="rounded-full bg-primary text-primary-foreground px-1.5 py-0.2 text-[10px] font-black">
                      {pendingTurmaCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("resets")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors ${
                    tab === "resets" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <CalendarClock className="h-4 w-4" /> Resets
                </button>
                <button
                  type="button"
                  onClick={() => setTab("sistema")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors ${
                    tab === "sistema" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <Cloud className="h-4 w-4" /> PlayFab
                </button>
              </div>
            </div>

            {/* Stable Internal Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {savedMsg && (
                <div className="animate-pop-in rounded-2xl bg-success/15 px-4 py-2.5 text-center text-sm font-bold text-success">
                  {savedMsg}
                </div>
              )}

            {/* TAB 1: JOGOS & CÓDIGOS */}
            {tab === "jogos" && (
              <div className="space-y-4">
                {/* Status e Controle de Acesso aos Jogos (Liberado Inicialmente / Travado com SEMED26) */}
                <div
                  className={`rounded-2xl border p-4 transition-all ${
                    draft.requireCodeGate
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-emerald-500/10 border-emerald-500/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-display text-base font-black">
                        {draft.requireCodeGate ? (
                          <>
                            <Lock className="h-5 w-5 text-amber-500 shrink-0" />
                            <span className="text-amber-600 dark:text-amber-400">
                              Jogos Travados com Código ({draft.masterCode || "SEMED26"})
                            </span>
                          </>
                        ) : (
                          <>
                            <Unlock className="h-5 w-5 text-emerald-500 shrink-0" />
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Jogos Liberados Inicialmente (Acesso Livre)
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                        {draft.requireCodeGate
                          ? `Acesso travado. Alunos precisam inserir o código Master (${draft.masterCode || "SEMED26"}) ou o código individual para liberar os jogos marcados.`
                          : "Todos os jogos marcados abaixo já ficam liberados e prontos para jogar na página inicial desde o início."}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant={draft.requireCodeGate ? "default" : "outline"}
                      onClick={() => void handleToggleRequireCodeGate()}
                      className={`shrink-0 rounded-xl font-black text-xs gap-1.5 shadow-sm ${
                        draft.requireCodeGate
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                      }`}
                    >
                      {draft.requireCodeGate ? (
                        <>
                          <Unlock className="h-4 w-4" /> Liberar Jogos para Todos
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" /> Travar com Código {draft.masterCode || "SEMED26"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Arena X1 Online Config (Nível 5+ e Horários) */}
                <div className="rounded-2xl border bg-accent/10 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-display text-sm font-bold text-foreground">
                        Arena de Batalha X1 Online (Nível 5+ • +100 XP Extra/dia)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Liberada apenas para alunos a partir do Nível 5 nos horários configurados
                        abaixo (padrão: 07h às 19h).
                      </div>
                    </div>
                    <Switch
                      checked={draft.x1Enabled ?? true}
                      onCheckedChange={(v) => setDraft({ ...draft, x1Enabled: v })}
                    />
                  </div>

                  {(draft.x1Enabled ?? true) && (
                    <div className="grid grid-cols-1 gap-2 rounded-xl border bg-background/80 p-3 sm:grid-cols-3">
                      <div>
                        <Label className="text-[11px] font-bold">Hora de Abertura (0–23h)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={23}
                          value={draft.x1OpenHour ?? 7}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              x1OpenHour: Math.max(0, Math.min(23, Number(e.target.value) || 0)),
                            })
                          }
                          className="mt-1 h-9 rounded-xl font-display font-bold"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] font-bold">Hora de Fechamento (1–24h)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={24}
                          value={draft.x1CloseHour ?? 19}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              x1CloseHour: Math.max(1, Math.min(24, Number(e.target.value) || 19)),
                            })
                          }
                          className="mt-1 h-9 rounded-xl font-display font-bold"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-xl border bg-secondary/30 px-3 py-2 sm:col-span-1">
                        <div className="text-[11px] leading-tight">
                          <div className="font-bold">Liberar 24h</div>
                          <div className="text-muted-foreground">Ignorar horário</div>
                        </div>
                        <Switch
                          checked={draft.x1ForceOpen ?? false}
                          onCheckedChange={(v) => setDraft({ ...draft, x1ForceOpen: v })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Torneio Semanal Ranqueado Config (Nível 3+ e 1 Jogo/Semana) */}
                <div className="rounded-2xl border bg-primary/10 p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-display text-sm font-bold text-foreground">
                        Torneio Semanal Ranqueado (Nível 3+ • Top 5 & Medalhas)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        1 jogo por semana, até 10 entradas/dia (+100 XP extra/dia) e bônus de
                        permanência no Top 5.
                      </div>
                    </div>
                    <Switch
                      checked={draft.tournamentEnabled ?? true}
                      onCheckedChange={(v) => setDraft({ ...draft, tournamentEnabled: v })}
                    />
                  </div>

                  {(draft.tournamentEnabled ?? true) && (
                    <div className="rounded-xl border bg-background/80 p-3 space-y-1.5">
                      <Label className="text-xs font-bold">Jogo do Torneio desta Semana</Label>
                      <select
                        value={draft.tournamentGameOverride ?? "auto"}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            tournamentGameOverride:
                              e.target.value === "auto" ? null : (e.target.value as GameId),
                          })
                        }
                        className="h-10 w-full rounded-xl border bg-card px-3 font-display text-sm font-bold"
                      >
                        <option value="auto">🔄 Rotação Automática Semanal (1 jogo por semana)</option>
                        {ALL_GAME_IDS.map((id) => (
                          <option key={id} value={id}>
                            🎯 Fixar manualmente: {GAME_NAMES[id]}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="flex items-center gap-1.5 font-display font-bold text-primary">
                      <KeyRound className="h-4 w-4" /> Código Mestre (Professor — libera todos)
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyCodesList}
                      className="h-8 rounded-xl text-xs"
                    >
                      {copied ? (
                        <>
                          <Check className="mr-1 h-3.5 w-3.5 text-success" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3.5 w-3.5" /> Copiar códigos
                        </>
                      )}
                    </Button>
                  </div>
                  <Input
                    value={draft.masterCode}
                    onChange={(e) =>
                      setDraft({ ...draft, masterCode: normalizeCode(e.target.value) })
                    }
                    maxLength={12}
                    className="rounded-xl font-display font-bold uppercase tracking-widest"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                    <div className="flex items-center gap-2">
                      <span>Jogo (Ativar / Desativar)</span>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold text-primary lowercase tracking-normal">
                        {ALL_GAME_IDS.filter((id) => Boolean(draft.enabledGames[id])).length} de {ALL_GAME_IDS.length} visíveis na página inicial
                      </span>
                    </div>
                    <span>Código de Acesso</span>
                  </div>

                  {ALL_GAME_IDS.map((id) => {
                    const enabled = Boolean(draft.enabledGames[id]);
                    const gStats = gameStatsSummary[id] ?? { totalPlays: 0, admPlays: 0 };
                    return (
                      <div
                        key={id}
                        className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-2xl border p-3 transition-colors ${
                          enabled ? "bg-card border-primary/20" : "bg-muted/40 opacity-70 border-dashed"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Switch
                            checked={enabled}
                            onCheckedChange={(v) => void handleToggleGame(id, v)}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-display text-sm font-bold flex items-center gap-2">
                              {GAME_NAMES[id]}
                              {!enabled && (
                                <span className="rounded bg-destructive/15 text-destructive px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-normal">
                                  Oculto
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {enabled
                                ? "Liberado e visível na página inicial"
                                : "Desmarcado (Oculto da página inicial para todos)"}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-black ${
                                  gStats.totalPlays > 0
                                    ? "bg-primary/15 border border-primary/30 text-primary"
                                    : "bg-muted text-muted-foreground border border-border"
                                }`}
                              >
                                🎮 {gStats.totalPlays} partida{gStats.totalPlays === 1 ? "" : "s"} jogada{gStats.totalPlays === 1 ? "" : "s"}
                              </span>
                              {gStats.admPlays > 0 && (
                                <span className="text-[10px] font-bold text-muted-foreground">
                                  ({gStats.admPlays} pelo seu perfil)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          <Input
                            value={draft.gameCodes[id] ?? ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                gameCodes: {
                                  ...draft.gameCodes,
                                  [id]: normalizeCode(e.target.value),
                                },
                              })
                            }
                            maxLength={10}
                            className="h-9 w-28 rounded-xl text-center font-display text-sm font-extrabold uppercase tracking-wider"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Sortear novo código"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                gameCodes: {
                                  ...draft.gameCodes,
                                  [id]: randomGameCode(id),
                                },
                              })
                            }
                            className="h-9 px-2.5 rounded-xl"
                          >
                            <Sparkles className="h-4 w-4 text-accent" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={saveGamesAndCodes}
                    className="flex-1 h-12 rounded-2xl font-bold"
                  >
                    <Save className="mr-2 h-4 w-4" /> Salvar alterações
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={restoreDefaultCodes}
                    className="h-12 rounded-2xl"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Restaurar padrão
                  </Button>
                </div>
              </div>
            )}

            {/* TAB 2: CONFIGURAÇÕES DA ARENA X1 (1 A 3 JOGOS COM ROTAÇÃO PROGRAMADA) */}
            {tab === "arena_x1" && (
              <div className="space-y-4">
                <div className="rounded-2xl border bg-secondary/30 p-4">
                  <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-foreground">
                    <Swords className="h-5 w-5 text-accent" /> Arena de Desafio X1 Online (1 vs 1)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure os jogos disponíveis nas batalhas 1 contra 1. Escolha de 1 a 3 jogos com rotação automática programada a cada intervalo!
                  </p>
                </div>

                {/* Status e Horários */}
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display text-sm font-bold text-foreground">
                        Habilitar Arena X1 para os Alunos (Nível 5+)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Duelos em tempo real com sala e código compartilhado.
                      </div>
                    </div>
                    <Switch
                      checked={draft.x1Enabled ?? true}
                      onCheckedChange={(v) => setDraft({ ...draft, x1Enabled: v })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t">
                    <div>
                      <Label className="text-xs font-bold">Abertura da Arena (0-23h)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={draft.x1OpenHour ?? 7}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            x1OpenHour: Math.max(0, Math.min(23, Number(e.target.value) || 0)),
                          })
                        }
                        className="mt-1 h-9 rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold">Fechamento da Arena (1-24h)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={draft.x1CloseHour ?? 19}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            x1CloseHour: Math.max(1, Math.min(24, Number(e.target.value) || 19)),
                          })
                        }
                        className="mt-1 h-9 rounded-xl font-bold"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-xl border bg-secondary/30 p-2.5">
                      <div className="text-xs">
                        <div className="font-bold">Modo 24 Horas</div>
                        <div className="text-[10px] text-muted-foreground">Sem restrição de horário</div>
                      </div>
                      <Switch
                        checked={draft.x1ForceOpen ?? false}
                        onCheckedChange={(v) => setDraft({ ...draft, x1ForceOpen: v })}
                      />
                    </div>
                  </div>
                </div>

                {/* Seleção de 1 a 3 Jogos para Rotação */}
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-display text-sm font-bold text-foreground">
                        Jogos Ativos no X1 (Selecione de 1 a 3 Jogos)
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {(draft.x1AvailableGames ?? ["rpg", "logica", "porcentagem"]).length} jogo(s) selecionado(s) de no máximo 3.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold whitespace-nowrap">Intervalo de Rotação (min):</Label>
                      <Input
                        type="number"
                        min={1}
                        max={120}
                        value={draft.x1RotationMinutes ?? 10}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            x1RotationMinutes: Math.max(1, Math.min(120, Number(e.target.value) || 10)),
                          })
                        }
                        className="h-9 w-20 rounded-xl text-center font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                    {ALL_GAME_IDS.filter((id) => draft.enabledGames[id]).map((id) => {
                      const selected = (draft.x1AvailableGames ?? ["rpg", "logica", "porcentagem"]).includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            const cur = draft.x1AvailableGames ?? ["rpg", "logica", "porcentagem"];
                            if (selected) {
                              if (cur.length > 1) {
                                setDraft({ ...draft, x1AvailableGames: cur.filter((g) => g !== id) });
                              } else {
                                flashSaved("Selecione pelo menos 1 jogo para a Arena X1.");
                              }
                            } else {
                              if (cur.length < 3) {
                                setDraft({ ...draft, x1AvailableGames: [...cur, id] });
                              } else {
                                flashSaved("Limite de 3 jogos atingido. Desmarque um para adicionar outro.");
                              }
                            }
                          }}
                          className={`rounded-xl border p-2.5 text-xs font-extrabold text-left transition-all ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-background hover:bg-secondary/50 text-muted-foreground"
                          }`}
                        >
                          <div className="truncate">{GAME_NAMES[id]}</div>
                          <div className="text-[10px] opacity-80 mt-0.5">
                            {selected ? "✓ Ativo no X1" : "+ Adicionar"}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Prévia da Rotação Ativa */}
                  {(() => {
                    const rot = getActiveRotatedX1Game({
                      availableGames: draft.x1AvailableGames,
                      rotationMinutes: draft.x1RotationMinutes,
                    });
                    return (
                      <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-accent" />
                          <span>
                            Jogo ativo agora: <b className="text-primary">{GAME_NAMES[rot.currentGame]}</b>
                          </span>
                        </div>
                        {rot.totalGamesCount > 1 ? (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              Próxima rotação em <b>{Math.floor(rot.secondsUntilNextRotation / 60)}m {rot.secondsUntilNextRotation % 60}s</b> (Próximo: {GAME_NAMES[rot.nextGame]})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-semibold">Modalidade fixa (sem rotação)</span>
                        )}
                      </div>
                    );
                  })()}

                  <Button
                    type="button"
                    onClick={saveSystemSettings}
                    className="w-full h-11 rounded-xl font-bold mt-2"
                  >
                    <Save className="mr-2 h-4 w-4" /> Salvar Configurações da Arena X1
                  </Button>
                </div>

                {/* Caixa de Entrada: Desafios X1 Realizados Entre Alunos */}
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5 text-accent" />
                      <div>
                        <h4 className="font-display text-sm font-bold text-foreground">
                          Caixa de Entrada: Desafios X1 Realizados Entre Alunos
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Histórico de confrontos 1 contra 1 disputados pelos alunos na Arena.
                        </p>
                      </div>
                      {unreadX1Count > 0 && (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-black text-accent-foreground">
                          {unreadX1Count} novo(s)
                        </span>
                      )}
                    </div>
                    {x1History.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            markAllX1MatchesRead();
                            setX1History(loadX1MatchHistory());
                            flashSaved("Todos os confrontos marcados como lidos!");
                          }}
                          className="h-8 rounded-xl text-xs"
                        >
                          Marcar todos como lidos
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            clearX1MatchHistory();
                            setX1History([]);
                            flashSaved("Histórico de confrontos limpo.");
                          }}
                          className="h-8 rounded-xl text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar
                        </Button>
                      </div>
                    )}
                  </div>

                  {x1History.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Nenhum confronto registrado na Arena X1 ainda. Conforme os alunos disputarem partidas 1v1, os relatórios aparecerão aqui em tempo real.
                    </div>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {x1History.map((m) => (
                        <div
                          key={m.id}
                          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 text-xs transition-colors ${
                            m.read ? "bg-background/60 opacity-80" : "bg-card border-accent/40 shadow-sm"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold">
                              <Swords className="h-5 w-5 text-accent" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-foreground">
                                  {m.hostNick} ({m.hostSchool})
                                </span>
                                <span className="font-black text-accent">VS</span>
                                <span className="font-extrabold text-foreground">
                                  {m.guestNick} ({m.guestSchool})
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Jogo: <b>{m.gameName}</b> • Placar: <b>{m.hostScore} pts</b> × <b>{m.guestScore} pts</b> •{" "}
                                {new Date(m.finishedAt).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </div>
                          <div>
                            <span
                              className={`rounded-xl px-2.5 py-1 text-[11px] font-black ${
                                m.winnerId === "draw"
                                  ? "bg-secondary text-secondary-foreground"
                                  : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              }`}
                            >
                              {m.winnerId === "draw" ? "🤝 Empate" : `🏆 Vencedor: ${m.winnerNick}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: TORNEIO SEMANAL RANQUEADO (CONFIGURAÇÃO & VISUALIZAÇÃO POR ETAPA) */}
            {tab === "torneio" && (() => {
              const snap = getWeeklyTournamentSnapshot(auth.profile, tournamentStageFilter);

              return (
                <div className="space-y-4">
                  {/* Cabeçalho e Ações do Torneio */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-secondary/30 p-4">
                    <div>
                      <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-foreground">
                        <Trophy className="h-5 w-5 text-accent" /> Torneio Semanal Ranqueado
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Gerencie o jogo oficial da semana, ative/desative o torneio e inspecione a classificação e ranks de todas as etapas escolares.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={syncingTournament}
                        onClick={async () => {
                          setSyncingTournament(true);
                          await syncWeeklyTournamentWithPlayFab();
                          setSyncingTournament(false);
                          flashSaved("Dados do Torneio sincronizados com a nuvem!");
                        }}
                        className="rounded-xl font-bold"
                      >
                        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncingTournament ? "animate-spin" : ""}`} />
                        Sincronizar Torneio
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          await auth.updateAdminConfig(draft);
                          onConfigSaved?.();
                          flashSaved("Configurações do Torneio salvas com sucesso!");
                        }}
                        className="rounded-xl font-bold"
                      >
                        <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar Alterações
                      </Button>
                    </div>
                  </div>

                  {/* Painel de Configurações do Torneio */}
                  <div className="rounded-2xl border bg-card p-5 space-y-4">
                    <h4 className="font-display text-sm font-black text-foreground">
                      Parâmetros da Semana ({snap.weekKey} • Até {snap.endsAtLabel})
                    </h4>

                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Ativar / Desativar Torneio */}
                      <div className="flex items-center justify-between rounded-xl border bg-secondary/20 p-3.5">
                        <div className="space-y-0.5">
                          <Label className="font-bold text-xs">Torneio Semanal Ativo</Label>
                          <p className="text-[11px] text-muted-foreground">
                            Permite aos alunos a partir do Nível 3 entrarem na disputa ranqueada.
                          </p>
                        </div>
                        <Switch
                          checked={draft.tournamentEnabled !== false}
                          onCheckedChange={(checked) =>
                            setDraft((d) => ({ ...d, tournamentEnabled: checked }))
                          }
                        />
                      </div>

                      {/* Escolha do Jogo da Semana */}
                      <div className="rounded-xl border bg-secondary/20 p-3.5 space-y-1.5">
                        <Label className="font-bold text-xs">Jogo Oficial da Semana</Label>
                        <select
                          value={draft.tournamentGameOverride || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraft((d) => ({
                              ...d,
                              tournamentGameOverride: val ? (val as GameId) : null,
                            }));
                          }}
                          className="w-full rounded-xl border bg-background px-3 py-2 text-xs font-semibold"
                        >
                          <option value="">🔄 Rotação Automática Semanal (Pelo Calendário)</option>
                          {ALL_GAME_IDS.map((gId) => (
                            <option key={gId} value={gId}>
                              🎯 {GAME_NAMES[gId]}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-muted-foreground">
                          Jogo atualmente ativo nesta semana: <b>{snap.gameName}</b>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Inspeção do Ranking por Etapa Escolar */}
                  <div className="rounded-2xl border bg-card p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-display text-sm font-black text-foreground flex items-center gap-1.5">
                          <Award className="h-4 w-4 text-accent" /> Classificação Geral e por Etapas
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Inspecione o progresso, pontos ranqueados e divisão de cada aluno participante.
                        </p>
                      </div>

                      {/* Seletor de Etapas para o ADM */}
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setTournamentStageFilter("TODAS")}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                            tournamentStageFilter === "TODAS"
                              ? "border-accent bg-accent text-accent-foreground shadow-xs"
                              : "bg-secondary/40 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          🌐 Todas as Etapas
                        </button>
                        {AGE_STAGES.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setTournamentStageFilter(st.id)}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                              tournamentStageFilter === st.id
                                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                : "bg-secondary/40 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {st.emoji} {st.shortLabel}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tabela de Classificação do Torneio */}
                    {snap.allStandings.length === 0 ? (
                      <div className="rounded-xl bg-secondary/40 p-8 text-center text-xs text-muted-foreground">
                        Nenhum jogador pontuou no torneio semanal nesta etapa até o momento.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b bg-secondary/50 font-bold text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2.5">Posição</th>
                              <th className="px-3 py-2.5">Aluno</th>
                              <th className="px-3 py-2.5">Escola & Etapa</th>
                              <th className="px-3 py-2.5 text-center">Divisão / Rank</th>
                              <th className="px-3 py-2.5 text-right">Pontos Ranqueados</th>
                              <th className="px-3 py-2.5 text-center">Top 5</th>
                              <th className="px-3 py-2.5 text-right">Recorde (Tentativas)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {snap.allStandings.map((row) => {
                              const pts = row.tournamentPoints ?? row.totalRankedPoints;
                              const rDef = getTournamentRank(pts).currentRank;

                              return (
                                <tr key={row.playerId} className="hover:bg-secondary/20 transition-colors">
                                  <td className="px-3 py-2.5 font-display font-black">
                                    <span
                                      className={`inline-grid h-7 w-7 place-items-center rounded-lg text-xs font-black ${
                                        row.rank === 1
                                          ? "bg-yellow-400 text-yellow-950"
                                          : row.rank === 2
                                            ? "bg-slate-300 text-slate-800"
                                            : row.rank === 3
                                              ? "bg-amber-700 text-amber-50"
                                              : "bg-secondary text-foreground"
                                      }`}
                                    >
                                      {row.rank}º
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 min-w-[140px]">
                                    <div className="font-bold text-foreground truncate">{row.nick}</div>
                                    {row.fullName && row.fullName.toLowerCase() !== row.nick.toLowerCase() && (
                                      <div className="text-[10px] uppercase text-muted-foreground truncate">
                                        {row.fullName}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <div className="truncate font-medium">{row.school}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {row.stageLabel} • Nv. {row.level}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <div className="inline-flex items-center gap-1.5">
                                      <TournamentRankBadge rankId={rDef.id} points={pts} size="xs" />
                                      <span className={`font-bold ${rDef.textColor}`}>{rDef.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-mono font-black text-primary">
                                    {pts} pts
                                  </td>
                                  <td className="px-3 py-2.5 text-center text-muted-foreground">
                                    {row.holdMinutes > 0 ? (
                                      <span className="font-semibold text-accent">
                                        {row.holdMinutes} min (+{row.holdBonusPoints} pts)
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-muted-foreground">
                                    <b>{row.bestScore}</b> ({row.totalEntries}x)
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB 3: EVENTOS ESPECIAIS & EVENTOS RECORRENTES (2 SUB-ABAS) */}
            {tab === "eventos" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-secondary/30 p-4">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-foreground">
                      <Zap className="h-5 w-5 text-amber-500" /> Eventos & Linhas de Bônus
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gerencie eventos pontuais manuais ou programe eventos recorrentes por dias da semana e datas específicas!
                    </p>
                  </div>

                  {/* Alternador das 2 Sub-abas de Eventos */}
                  <div className="flex items-center gap-1 rounded-xl bg-background border p-1">
                    <button
                      type="button"
                      onClick={() => setEventosSubTab("criacao")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        eventosSubTab === "criacao"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Zap className="inline mr-1 h-3.5 w-3.5" /> 1. Criação de Eventos
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventosSubTab("recorrentes")}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        eventosSubTab === "recorrentes"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Calendar className="inline mr-1 h-3.5 w-3.5" /> 2. Eventos Recorrentes
                      {recurringEvents.filter((e) => isRecurringEventActive(e)).length > 0 && (
                        <span className="ml-1.5 rounded-full bg-emerald-500 text-white px-1.5 py-0.2 text-[9px] font-black animate-pulse">
                          Ao Vivo
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Indicador de Status do Banco de Dados / PlayFab Cloud */}
                {isPlayFabConfigured() ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="font-bold">
                        Banco de Dados Ativo: Microsoft Azure PlayFab (Title ID: {getPlayFabTitleId()})
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400">
                      ☁️ Sincronização em nuvem ativa: todos os eventos são salvos no banco de dados e sincronizados em todos os computadores.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-bold">
                        Modo Local (Banco de Dados Offline)
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-amber-700/80 dark:text-amber-400">
                      💾 Salvo no navegador local. Para salvar no banco de dados da nuvem para todos os computadores, configure o Title ID na aba <b>PlayFab</b>.
                    </span>
                  </div>
                )}

                {/* SUB-ABA 1: CRIAÇÃO DE EVENTOS PONTUAIS / MANUAIS */}
                {eventosSubTab === "criacao" && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={() => setIsCreatingEvent(!isCreatingEvent)}
                        className="rounded-xl font-bold h-9 text-xs"
                      >
                        {isCreatingEvent ? "Fechar Formulário" : "+ Criar Novo Evento Pontual"}
                      </Button>
                    </div>

                    {isCreatingEvent && (
                      <form onSubmit={handleCreateEvent} className="rounded-3xl border-2 border-primary/40 bg-card p-4 space-y-3 animate-in fade-in-50">
                        <h4 className="font-display text-sm font-black text-primary">Novo Evento Especial Turbinado</h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-bold">Nome do Evento</Label>
                            <Input
                              value={evTitle}
                              onChange={(e) => setEvTitle(e.target.value)}
                              placeholder="Ex: Super Fim de Semana 2x XP"
                              className="rounded-xl h-9 text-xs font-semibold"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-bold">Escopo (Jogos Participantes)</Label>
                            <select
                              value={evScope}
                              onChange={(e) => setEvScope(e.target.value as "todos" | GameId)}
                              className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-bold"
                            >
                              <option value="todos">🌟 Todos os Jogos da Plataforma</option>
                              {ALL_GAME_IDS.map((id) => (
                                <option key={id} value={id}>
                                  🎮 Somente: {GAME_NAMES[id]}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Descrição / Detalhes para os Alunos</Label>
                          <Input
                            value={evDesc}
                            onChange={(e) => setEvDesc(e.target.value)}
                            placeholder="Ex: Jogue qualquer partida e ganhe o dobro de XP com teto expandido!"
                            className="rounded-xl h-9 text-xs"
                          />
                        </div>

                        {/* As 3 Linhas de Bônus com Caixinhas para Marcar */}
                        <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <div className="font-display text-xs font-black uppercase text-amber-500 flex items-center gap-1.5">
                              <Zap className="h-4 w-4" /> Bônus do Evento (Marque as caixinhas que deseja ativar)
                            </div>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Escolha 1, 2 ou os 3 bônus (opcional se vincular medalha)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Bônus 1: Multiplicador */}
                            <div className={`rounded-xl border p-2.5 space-y-2 transition-all ${evHasMultiplier ? "border-amber-500/60 bg-card shadow-xs" : "border-border/60 bg-muted/20 opacity-60"}`}>
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={evHasMultiplier}
                                  onChange={(e) => setEvHasMultiplier(e.target.checked)}
                                  className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-foreground">
                                  1. Multiplicador de XP
                                </span>
                              </label>
                              <div className="space-y-1">
                                <select
                                  disabled={!evHasMultiplier}
                                  value={evMultiplier}
                                  onChange={(e) => setEvMultiplier(Number(e.target.value))}
                                  className={`h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold text-amber-500 ${!evHasMultiplier && "opacity-40 cursor-not-allowed"}`}
                                >
                                  <option value={1.5}>1.5x (+50% bônus)</option>
                                  <option value={2}>2x (Dobro de XP)</option>
                                  <option value={2.5}>2.5x (+150% bônus)</option>
                                  <option value={3}>3x (Triplo de XP)</option>
                                  <option value={4}>4x (4x de XP)</option>
                                </select>
                                <p className="text-[10px] text-muted-foreground">Multiplica o XP das partidas</p>
                              </div>
                            </div>

                            {/* Bônus 2: Teto por Partida */}
                            <div className={`rounded-xl border p-2.5 space-y-2 transition-all ${evHasMatchCap ? "border-amber-500/60 bg-card shadow-xs" : "border-border/60 bg-muted/20 opacity-60"}`}>
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={evHasMatchCap}
                                  onChange={(e) => setEvHasMatchCap(e.target.checked)}
                                  className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-foreground">
                                  2. Teto por Partida (XP)
                                </span>
                              </label>
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  disabled={!evHasMatchCap}
                                  min={10}
                                  max={200}
                                  step={5}
                                  value={evMatchXpCap}
                                  onChange={(e) => setEvMatchXpCap(Number(e.target.value))}
                                  className={`h-8 rounded-lg text-xs font-bold bg-background ${!evHasMatchCap && "opacity-40 cursor-not-allowed"}`}
                                  placeholder="Ex: 50 XP"
                                />
                                <p className="text-[10px] text-muted-foreground">Normal: 20 XP por partida</p>
                              </div>
                            </div>

                            {/* Bônus 3: Adicionar ao Limite Diário Geral */}
                            <div className={`rounded-xl border p-2.5 space-y-2 transition-all ${evHasDailyCap ? "border-amber-500/60 bg-card shadow-xs" : "border-border/60 bg-muted/20 opacity-60"}`}>
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={evHasDailyCap}
                                  onChange={(e) => setEvHasDailyCap(e.target.checked)}
                                  className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-foreground">
                                  3. Adicionar ao Limite Diário (+XP)
                                </span>
                              </label>
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  disabled={!evHasDailyCap}
                                  min={50}
                                  max={5000}
                                  step={50}
                                  value={evDailyExtraXp}
                                  onChange={(e) => setEvDailyExtraXp(Math.max(0, Number(e.target.value)))}
                                  className={`h-8 rounded-lg text-xs font-bold bg-background ${!evHasDailyCap && "opacity-40 cursor-not-allowed"}`}
                                  placeholder="Ex: 500 XP adicionais"
                                />
                                <p className="text-[10px] text-muted-foreground font-semibold">
                                  {evHasDailyCap
                                    ? `Base (1.000 XP) + ${evDailyExtraXp} = ${1000 + evDailyExtraXp} XP/dia`
                                    : "Normal da plataforma: 1.000 XP/dia"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Duração do Evento</Label>
                          <select
                            value={evDurationHours}
                            onChange={(e) => setEvDurationHours(Number(e.target.value))}
                            className="h-9 w-full max-w-sm rounded-xl border bg-background px-3 text-xs font-bold"
                          >
                            <option value={12}>12 Horas</option>
                            <option value={24}>1 Dia (24 horas)</option>
                            <option value={48}>2 Dias (Fim de Semana)</option>
                            <option value={72}>3 Dias (72 horas)</option>
                            <option value={168}>1 Semana Completa (7 dias)</option>
                          </select>
                        </div>

                        {/* Seção de Medalhas Atribuídas ao Evento */}
                        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3.5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h5 className="font-display text-xs font-black uppercase text-primary flex items-center gap-1.5">
                                <Award className="h-4 w-4 text-primary" /> Medalhas do Evento ({evAttachedMedals.length})
                              </h5>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Crie ou vincule medalhas exclusivas com objetivos e missões a serem cumpridos durante o evento.
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={isAddingMedalToEv ? "secondary" : "default"}
                              onClick={() => setIsAddingMedalToEv(!isAddingMedalToEv)}
                              className="rounded-xl font-bold text-xs h-8"
                            >
                              {isAddingMedalToEv ? "Fechar Seletor" : "+ Adicionar Medalha ao Evento"}
                            </Button>
                          </div>

                          {/* Lista das Medalhas já anexadas */}
                          {evAttachedMedals.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {evAttachedMedals.map((m, idx) => {
                                const rarity = RARITY_INFO[m.rarity];
                                return (
                                  <div
                                    key={m.id || idx}
                                    className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2.5 shadow-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${rarity.badgeBgClass}`}>
                                        <div className={rarity.textColor}>
                                          <MedalIcon name={m.iconName} className="h-4 w-4" />
                                        </div>
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="truncate font-display text-xs font-black text-foreground">
                                            {m.title}
                                          </span>
                                          <span className={`rounded-full px-1.5 py-0.2 text-[8px] font-black uppercase ${rarity.badgeBgClass}`}>
                                            {rarity.label}
                                          </span>
                                        </div>
                                        <p className="line-clamp-1 text-[10px] text-muted-foreground">
                                          {m.eventRequirement ? formatEventRequirementLabel(m.eventRequirement) : m.description}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setEvAttachedMedals(evAttachedMedals.filter((_, i) => i !== idx))}
                                      className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                      title="Remover medalha deste evento"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-primary/20 p-3 text-center text-[11px] text-muted-foreground">
                              Nenhuma medalha vinculada ainda. Clique em <b>"+ Adicionar Medalha ao Evento"</b> para criar novas medalhas com requisitos específicos ou escolher existentes.
                            </div>
                          )}

                          {/* Sub-painel para Adicionar Medalha */}
                          {isAddingMedalToEv && (
                            <div className="rounded-2xl border bg-card p-3 space-y-3 animate-in fade-in-50">
                              <div className="flex items-center gap-2 border-b pb-2">
                                <button
                                  type="button"
                                  onClick={() => setEvMedalMode("novo")}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                    evMedalMode === "novo"
                                      ? "bg-primary text-primary-foreground shadow-xs"
                                      : "text-muted-foreground hover:bg-secondary"
                                  }`}
                                >
                                  ✨ Criar Nova Medalha
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEvMedalMode("existente")}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                    evMedalMode === "existente"
                                      ? "bg-primary text-primary-foreground shadow-xs"
                                      : "text-muted-foreground hover:bg-secondary"
                                  }`}
                                >
                                  📂 Utilizar Medalha Existente ({availableExistingEventMedals.length})
                                </button>
                              </div>

                              {evMedalMode === "novo" ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">Título da Medalha</Label>
                                      <Input
                                        value={evNewMedalTitle}
                                        onChange={(e) => setEvNewMedalTitle(e.target.value)}
                                        placeholder="Ex: Campeão da Arena 2x"
                                        className="h-8 rounded-lg text-xs"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">Raridade</Label>
                                      <select
                                        value={evNewMedalRarity}
                                        onChange={(e) => setEvNewMedalRarity(e.target.value as MedalRarity)}
                                        className="h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold"
                                      >
                                        <option value="bronze">Bronze</option>
                                        <option value="prata">Prata</option>
                                        <option value="ouro">Ouro</option>
                                        <option value="platina">Platina</option>
                                        <option value="diamante">Diamante</option>
                                        <option value="heroi">Herói</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">Requisito do Evento</Label>
                                      <select
                                        value={evNewMedalReqType}
                                        onChange={(e) => {
                                          const t = e.target.value as EventRequirementType;
                                          setEvNewMedalReqType(t);
                                          const opt = EVENT_REQUIREMENT_OPTIONS.find((o) => o.type === t);
                                          if (opt) setEvNewMedalThreshold(opt.defaultVal);
                                        }}
                                        className="h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold"
                                      >
                                        {EVENT_REQUIREMENT_OPTIONS.map((opt) => (
                                          <option key={opt.type} value={opt.type}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">Jogo Vinculado</Label>
                                      <select
                                        disabled={["event_x1_wins", "event_distinct_games", "event_daily_cap", "event_team_matches"].includes(evNewMedalReqType)}
                                        value={evNewMedalScope}
                                        onChange={(e) => setEvNewMedalScope(e.target.value as "todos" | GameId)}
                                        className="h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold disabled:opacity-50"
                                      >
                                        <option value="todos">🌟 Qualquer Jogo</option>
                                        {ALL_GAME_IDS.map((id) => (
                                          <option key={id} value={id}>
                                            🎮 {GAME_NAMES[id]}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">
                                        Meta ({EVENT_REQUIREMENT_OPTIONS.find((o) => o.type === evNewMedalReqType)?.unit})
                                      </Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={evNewMedalThreshold}
                                        onChange={(e) => setEvNewMedalThreshold(Math.max(1, Number(e.target.value)))}
                                        className="h-8 rounded-lg text-xs font-bold bg-background"
                                      />
                                    </div>
                                  </div>

                                  {/* Ícones Selector Compact */}
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-bold">Ícone</Label>
                                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto rounded-lg border bg-background p-1.5">
                                      {AVAILABLE_MEDAL_ICONS.map((ic) => (
                                        <button
                                          key={ic}
                                          type="button"
                                          onClick={() => setEvNewMedalIcon(ic)}
                                          className={`grid h-7 w-7 place-items-center rounded-md border transition-all ${
                                            evNewMedalIcon === ic
                                              ? "border-primary bg-primary text-primary-foreground shadow-xs scale-105"
                                              : "hover:bg-secondary text-muted-foreground"
                                          }`}
                                          title={ic}
                                        >
                                          <MedalIcon name={ic} className="h-3.5 w-3.5" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Preview do Requisito */}
                                  <div className="rounded-xl border bg-secondary/30 p-2 text-[11px] text-muted-foreground">
                                    <b>Descrição automática:</b> {formatEventRequirementLabel({
                                      type: evNewMedalReqType,
                                      threshold: evNewMedalThreshold,
                                      gameId: evNewMedalScope === "todos" ? undefined : evNewMedalScope,
                                    })}
                                  </div>

                                  <div className="flex justify-end gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => {
                                        if (!evNewMedalTitle.trim()) {
                                          flashSaved("Informe o título da medalha.");
                                          return;
                                        }
                                        const req: EventMedalRequirement = {
                                          type: evNewMedalReqType,
                                          threshold: Number(evNewMedalThreshold) || 1,
                                          gameId: evNewMedalScope === "todos" ? undefined : evNewMedalScope,
                                        };
                                        const medalId = `ev_medal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                                        const newM: MedalDefinition = {
                                          id: medalId,
                                          title: evNewMedalTitle.trim(),
                                          description: `${evNewMedalTitle.trim()} — Exclusiva do evento "${evTitle.trim() || "Especial"}". ${formatEventRequirementLabel(req)}`,
                                          rarity: evNewMedalRarity,
                                          category: "evento",
                                          iconName: evNewMedalIcon,
                                          condition: {
                                            type: evNewMedalReqType,
                                            threshold: req.threshold,
                                            gameId: req.gameId,
                                          },
                                          isCustom: true,
                                          createdByAdmin: true,
                                          eventName: evTitle.trim() || "Evento Especial",
                                          eventRequirement: req,
                                        };
                                        setEvAttachedMedals([...evAttachedMedals, newM]);
                                        setIsAddingMedalToEv(false);
                                        setEvNewMedalTitle("");
                                        flashSaved(`Medalha "${newM.title}" adicionada ao evento!`);
                                      }}
                                      className="rounded-xl font-bold text-xs h-8 bg-primary"
                                    >
                                      + Adicionar Medalha ao Evento
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                /* Modo Existente */
                                <div className="space-y-3">
                                  {availableExistingEventMedals.length === 0 ? (
                                    <div className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
                                      Nenhuma medalha de evento disponível que não esteja em uso em outro evento ativo. Crie uma nova medalha na aba acima!
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <Label className="text-[11px] font-bold">Selecione uma Medalha Existente</Label>
                                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                        {availableExistingEventMedals.map((m) => {
                                          const rarity = RARITY_INFO[m.rarity];
                                          const isAlreadyAttached = evAttachedMedals.some((a) => a.id === m.id);
                                          return (
                                            <div
                                              key={m.id}
                                              className={`flex items-center justify-between gap-2 rounded-xl border p-2 text-xs transition-colors ${
                                                isAlreadyAttached ? "opacity-40 bg-muted" : "bg-card hover:border-primary"
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${rarity.badgeBgClass}`}>
                                                  <div className={rarity.textColor}>
                                                    <MedalIcon name={m.iconName} className="h-3.5 w-3.5" />
                                                  </div>
                                                </div>
                                                <div className="min-w-0">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="font-bold truncate">{m.title}</span>
                                                    <span className={`text-[8px] font-extrabold uppercase px-1 rounded ${rarity.badgeBgClass}`}>
                                                      {rarity.label}
                                                    </span>
                                                  </div>
                                                  <p className="text-[10px] text-muted-foreground truncate">
                                                    {m.eventRequirement ? formatEventRequirementLabel(m.eventRequirement) : m.description}
                                                  </p>
                                                </div>
                                              </div>
                                              <Button
                                                type="button"
                                                size="sm"
                                                disabled={isAlreadyAttached}
                                                onClick={() => {
                                                  const cloned: MedalDefinition = {
                                                    ...m,
                                                    eventName: evTitle.trim() || m.eventName || "Evento Especial",
                                                    description: m.description.includes("—")
                                                      ? m.description
                                                      : `${m.title} — Exclusiva do evento "${evTitle.trim() || "Especial"}". ${m.description}`,
                                                  };
                                                  setEvAttachedMedals([...evAttachedMedals, cloned]);
                                                  setIsAddingMedalToEv(false);
                                                  flashSaved(`Medalha "${m.title}" vinculada ao evento!`);
                                                }}
                                                className="rounded-lg text-[10px] font-bold h-7 px-2"
                                              >
                                                {isAlreadyAttached ? "Já Vinculada" : "+ Vincular"}
                                              </Button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsCreatingEvent(false)}
                            className="rounded-xl text-xs"
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" size="sm" className="rounded-xl font-bold text-xs bg-primary">
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Criar e Ativar Evento
                          </Button>
                        </div>
                      </form>
                    )}

                    {/* Lista de Eventos Pontuais */}
                    <div className="space-y-2">
                      <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Eventos Pontuais Ativos / Agendados ({specialEvents.length})
                      </h4>

                      {specialEvents.length === 0 ? (
                        <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                          Nenhum evento pontual cadastrado. Clique no botão acima para criar um evento temporário.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {specialEvents.map((ev) => {
                            const activeNow = isEventActive(ev);
                            const remaining = formatEventRemainingTime(ev.endsAt);
                            return (
                              <div
                                key={ev.id}
                                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border-2 p-3.5 transition-all ${
                                  activeNow
                                    ? "border-amber-500/50 bg-amber-500/5"
                                    : "border-border/60 bg-muted/20 opacity-75"
                                }`}
                              >
                                <div className="min-w-0 space-y-1 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                        activeNow
                                          ? "bg-amber-500 text-white"
                                          : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {activeNow ? "AO VIVO NO MENU" : "ENCERRADO / INATIVO"}
                                    </span>
                                    <h5 className="font-display text-sm font-black text-foreground truncate">
                                      {ev.title}
                                    </h5>
                                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                      {ev.scope === "todos" ? "Todos os Jogos" : GAME_NAMES[ev.scope]}
                                    </span>
                                  </div>

                                  {ev.description && (
                                    <p className="text-xs text-muted-foreground">{ev.description}</p>
                                  )}

                                  <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                                    <span className="font-bold text-amber-500 flex items-center gap-1">
                                      <Zap className="h-3.5 w-3.5" />
                                      {renderActiveBonusesLabel(ev)}
                                    </span>
                                    <span className="flex items-center gap-1 font-semibold text-foreground">
                                      <Calendar className="h-3.5 w-3.5 text-primary" />
                                      Período: <b>{formatDateTimeBR(ev.startsAt)}</b> até <b>{formatDateTimeBR(ev.endsAt)}</b>
                                    </span>
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                                      {activeNow ? remaining : "Expirado"}
                                    </span>
                                    {ev.linkedMedalId && (
                                      <span className="font-medium text-primary flex items-center gap-1">
                                        <Award className="h-3.5 w-3.5" />
                                        Medalha vinculada
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    type="button"
                                    variant={ev.active ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={() => handleToggleEventActive(ev.id)}
                                    className="rounded-xl text-xs h-8"
                                  >
                                    {ev.active ? "Desativar" : "Ativar"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteEvent(ev.id)}
                                    className="rounded-xl text-xs h-8 text-destructive hover:bg-destructive/10"
                                    title="Excluir evento"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-ABA 2: EVENTOS RECORRENTES (DIAS DA SEMANA E DATAS ESPECÍFICAS) */}
                {eventosSubTab === "recorrentes" && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={() => setIsCreatingRecurring(!isCreatingRecurring)}
                        className="rounded-xl font-bold h-9 text-xs"
                      >
                        {isCreatingRecurring ? "Fechar Formulário" : "+ Criar Evento Recorrente"}
                      </Button>
                    </div>

                    {isCreatingRecurring && (
                      <form onSubmit={handleCreateRecurringEvent} className="rounded-3xl border-2 border-primary/40 bg-card p-4 space-y-3 animate-in fade-in-50">
                        <h4 className="font-display text-sm font-black text-primary flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" /> Novo Evento Recorrente (Dias da Semana / Datas)
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-bold">Título do Evento Recorrente</Label>
                            <Input
                              value={recTitle}
                              onChange={(e) => setRecTitle(e.target.value)}
                              placeholder="Ex: Fim de Semana Turbinado"
                              className="rounded-xl h-9 text-xs font-semibold"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs font-bold">Escopo (Jogos)</Label>
                            <select
                              value={recScope}
                              onChange={(e) => setRecScope(e.target.value as "todos" | GameId)}
                              className="h-9 w-full rounded-xl border bg-background px-3 text-xs font-bold"
                            >
                              <option value="todos">🌟 Todos os Jogos da Plataforma</option>
                              {ALL_GAME_IDS.map((id) => (
                                <option key={id} value={id}>
                                  🎮 Somente: {GAME_NAMES[id]}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Descrição</Label>
                          <Input
                            value={recDesc}
                            onChange={(e) => setRecDesc(e.target.value)}
                            placeholder="Ex: Ativação automática todo sábado e domingo com XP em dobro!"
                            className="rounded-xl h-9 text-xs"
                          />
                        </div>

                        {/* Seleção de Dias da Semana */}
                        <div className="rounded-2xl border bg-secondary/20 p-3 space-y-2">
                          <Label className="text-xs font-bold flex items-center justify-between">
                            <span>Dias da Semana com Ativação Automática</span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              Clique para marcar/desmarcar
                            </span>
                          </Label>
                          <div className="grid grid-cols-2 sm:grid-cols-7 gap-1.5">
                            {DAYS_OF_WEEK.map((d) => {
                              const isSelected = recDaysOfWeek.includes(d.value);
                              return (
                                <button
                                  key={d.value}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setRecDaysOfWeek(recDaysOfWeek.filter((w) => w !== d.value));
                                    } else {
                                      setRecDaysOfWeek([...recDaysOfWeek, d.value]);
                                    }
                                  }}
                                  className={`rounded-xl py-2 px-1 text-center font-bold text-xs transition-all ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "border bg-card text-muted-foreground hover:bg-secondary"
                                  }`}
                                >
                                  <div>{d.short}</div>
                                  <div className="text-[9px] opacity-80">{isSelected ? "✓ Ativo" : "-"}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Seleção de Datas Específicas */}
                        <div className="rounded-2xl border bg-secondary/20 p-3 space-y-2">
                          <Label className="text-xs font-bold">Datas Específicas Adicionais (Feriados, Gincanas, etc.)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={recDateInput}
                              onChange={(e) => setRecDateInput(e.target.value)}
                              className="h-9 w-48 rounded-xl text-xs font-semibold bg-background"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (recDateInput && !recSpecificDates.includes(recDateInput)) {
                                  setRecSpecificDates([...recSpecificDates, recDateInput]);
                                  setRecDateInput("");
                                }
                              }}
                              className="h-9 rounded-xl text-xs font-bold"
                            >
                              + Adicionar Data
                            </Button>
                          </div>
                          {recSpecificDates.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {recSpecificDates.map((dt) => (
                                <span
                                  key={dt}
                                  className="inline-flex items-center gap-1 rounded-lg border bg-background px-2 py-0.5 text-xs font-bold text-primary"
                                >
                                  {formatDateOnlyBR(dt)}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRecSpecificDates(recSpecificDates.filter((d) => d !== dt))
                                    }
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* As 3 Linhas de Bônus para o Evento Recorrente com Caixinhas para Marcar */}
                        <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <div className="font-display text-xs font-black uppercase text-amber-500 flex items-center gap-1.5">
                              <Zap className="h-4 w-4" /> Bônus Recorrentes (Marque as caixinhas que deseja ativar)
                            </div>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              Escolha 1, 2 ou os 3 bônus (opcional se vincular medalha)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Bônus 1: Multiplicador */}
                            <div className={`rounded-xl border p-2.5 space-y-2 transition-all ${recHasMultiplier ? "border-amber-500/60 bg-card shadow-xs" : "border-border/60 bg-muted/20 opacity-60"}`}>
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={recHasMultiplier}
                                  onChange={(e) => setRecHasMultiplier(e.target.checked)}
                                  className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-foreground">
                                  1. Multiplicador de XP
                                </span>
                              </label>
                              <div className="space-y-1">
                                <select
                                  disabled={!recHasMultiplier}
                                  value={recMultiplier}
                                  onChange={(e) => setRecMultiplier(Number(e.target.value))}
                                  className={`h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold text-amber-500 ${!recHasMultiplier && "opacity-40 cursor-not-allowed"}`}
                                >
                                  <option value={1.5}>1.5x (+50% bônus)</option>
                                  <option value={2}>2x (Dobro de XP)</option>
                                  <option value={2.5}>2.5x (+150% bônus)</option>
                                  <option value={3}>3x (Triplo de XP)</option>
                                  <option value={4}>4x (4x de XP)</option>
                                </select>
                                <p className="text-[10px] text-muted-foreground">Multiplica o XP das partidas</p>
                              </div>
                            </div>

                            {/* Bônus 2: Teto por Partida */}
                            <div className={`rounded-xl border p-2.5 space-y-2 transition-all ${recHasMatchCap ? "border-amber-500/60 bg-card shadow-xs" : "border-border/60 bg-muted/20 opacity-60"}`}>
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={recHasMatchCap}
                                  onChange={(e) => setRecHasMatchCap(e.target.checked)}
                                  className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-foreground">
                                  2. Teto por Partida (XP)
                                </span>
                              </label>
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  disabled={!recHasMatchCap}
                                  min={10}
                                  max={200}
                                  step={5}
                                  value={recMatchCap}
                                  onChange={(e) => setRecMatchCap(Number(e.target.value))}
                                  className={`h-8 rounded-lg text-xs font-bold bg-background ${!recHasMatchCap && "opacity-40 cursor-not-allowed"}`}
                                  placeholder="Ex: 30 XP"
                                />
                                <p className="text-[10px] text-muted-foreground">Normal: 20 XP por partida</p>
                              </div>
                            </div>

                            {/* Bônus 3: Adicionar ao Limite Diário Geral */}
                            <div className={`rounded-xl border p-2.5 space-y-2 transition-all ${recHasDailyCap ? "border-amber-500/60 bg-card shadow-xs" : "border-border/60 bg-muted/20 opacity-60"}`}>
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={recHasDailyCap}
                                  onChange={(e) => setRecHasDailyCap(e.target.checked)}
                                  className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-foreground">
                                  3. Adicionar ao Limite Diário (+XP)
                                </span>
                              </label>
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  disabled={!recHasDailyCap}
                                  min={50}
                                  max={5000}
                                  step={50}
                                  value={recDailyExtraXp}
                                  onChange={(e) => setRecDailyExtraXp(Math.max(0, Number(e.target.value)))}
                                  className={`h-8 rounded-lg text-xs font-bold bg-background ${!recHasDailyCap && "opacity-40 cursor-not-allowed"}`}
                                  placeholder="Ex: 500 XP adicionais"
                                />
                                <p className="text-[10px] text-muted-foreground font-semibold">
                                  {recHasDailyCap
                                    ? `Base (1.000 XP) + ${recDailyExtraXp} = ${1000 + recDailyExtraXp} XP/dia`
                                    : "Normal da plataforma: 1.000 XP/dia"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Seção de Medalhas Atribuídas ao Evento Recorrente */}
                        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-3.5 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h5 className="font-display text-xs font-black uppercase text-primary flex items-center gap-1.5">
                                <Award className="h-4 w-4 text-primary" /> Medalhas do Evento ({recAttachedMedals.length})
                              </h5>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Crie ou vincule medalhas com metas a serem cumpridas a cada edição deste evento recorrente.
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={isAddingMedalToRec ? "secondary" : "default"}
                              onClick={() => setIsAddingMedalToRec(!isAddingMedalToRec)}
                              className="rounded-xl font-bold text-xs h-8"
                            >
                              {isAddingMedalToRec ? "Fechar Seletor" : "+ Adicionar Medalha ao Evento"}
                            </Button>
                          </div>

                          {/* Lista das Medalhas já anexadas ao evento recorrente */}
                          {recAttachedMedals.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {recAttachedMedals.map((m, idx) => {
                                const rarity = RARITY_INFO[m.rarity];
                                return (
                                  <div
                                    key={m.id || idx}
                                    className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2.5 shadow-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${rarity.badgeBgClass}`}>
                                        <div className={rarity.textColor}>
                                          <MedalIcon name={m.iconName} className="h-4 w-4" />
                                        </div>
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="truncate font-display text-xs font-black text-foreground">
                                            {m.title}
                                          </span>
                                          <span className={`rounded-full px-1.5 py-0.2 text-[8px] font-black uppercase ${rarity.badgeBgClass}`}>
                                            {rarity.label}
                                          </span>
                                        </div>
                                        <p className="line-clamp-1 text-[10px] text-muted-foreground">
                                          {m.eventRequirement ? formatEventRequirementLabel(m.eventRequirement) : m.description}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setRecAttachedMedals(recAttachedMedals.filter((_, i) => i !== idx))}
                                      className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                      title="Remover medalha deste evento"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-primary/20 p-3 text-center text-[11px] text-muted-foreground">
                              Nenhuma medalha vinculada ainda. Clique em <b>"+ Adicionar Medalha ao Evento"</b> para criar novas medalhas com requisitos específicos ou escolher existentes.
                            </div>
                          )}

                          {/* Sub-painel para Adicionar Medalha ao Evento Recorrente */}
                          {isAddingMedalToRec && (
                            <div className="rounded-2xl border bg-card p-3 space-y-3 animate-in fade-in-50">
                              <div className="flex items-center gap-2 border-b pb-2">
                                <button
                                  type="button"
                                  onClick={() => setRecMedalMode("novo")}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                    recMedalMode === "novo"
                                      ? "bg-primary text-primary-foreground shadow-xs"
                                      : "text-muted-foreground hover:bg-secondary"
                                  }`}
                                >
                                  ✨ Criar Nova Medalha
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRecMedalMode("existente")}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                                    recMedalMode === "existente"
                                      ? "bg-primary text-primary-foreground shadow-xs"
                                      : "text-muted-foreground hover:bg-secondary"
                                  }`}
                                >
                                  📂 Utilizar Medalha Existente ({availableExistingEventMedals.length})
                                </button>
                              </div>

                              {recMedalMode === "novo" ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">Título da Medalha</Label>
                                      <Input
                                        value={recNewMedalTitle}
                                        onChange={(e) => setRecNewMedalTitle(e.target.value)}
                                        placeholder="Ex: Guerreiro de Fim de Semana"
                                        className="h-8 rounded-lg text-xs"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">Raridade</Label>
                                      <select
                                        value={recNewMedalRarity}
                                        onChange={(e) => setRecNewMedalRarity(e.target.value as MedalRarity)}
                                        className="h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold"
                                      >
                                        <option value="bronze">Bronze</option>
                                        <option value="prata">Prata</option>
                                        <option value="ouro">Ouro</option>
                                        <option value="platina">Platina</option>
                                        <option value="diamante">Diamante</option>
                                        <option value="heroi">Herói</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">Requisito do Evento</Label>
                                      <select
                                        value={recNewMedalReqType}
                                        onChange={(e) => {
                                          const t = e.target.value as EventRequirementType;
                                          setRecNewMedalReqType(t);
                                          const opt = EVENT_REQUIREMENT_OPTIONS.find((o) => o.type === t);
                                          if (opt) setRecNewMedalThreshold(opt.defaultVal);
                                        }}
                                        className="h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold"
                                      >
                                        {EVENT_REQUIREMENT_OPTIONS.map((opt) => (
                                          <option key={opt.type} value={opt.type}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">Jogo Vinculado</Label>
                                      <select
                                        disabled={["event_x1_wins", "event_distinct_games", "event_daily_cap", "event_team_matches"].includes(recNewMedalReqType)}
                                        value={recNewMedalScope}
                                        onChange={(e) => setRecNewMedalScope(e.target.value as "todos" | GameId)}
                                        className="h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold disabled:opacity-50"
                                      >
                                        <option value="todos">🌟 Qualquer Jogo</option>
                                        {ALL_GAME_IDS.map((id) => (
                                          <option key={id} value={id}>
                                            🎮 {GAME_NAMES[id]}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[11px] font-bold">
                                        Meta ({EVENT_REQUIREMENT_OPTIONS.find((o) => o.type === recNewMedalReqType)?.unit})
                                      </Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={recNewMedalThreshold}
                                        onChange={(e) => setRecNewMedalThreshold(Math.max(1, Number(e.target.value)))}
                                        className="h-8 rounded-lg text-xs font-bold bg-background"
                                      />
                                    </div>
                                  </div>

                                  {/* Ícones Selector Compact */}
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-bold">Ícone</Label>
                                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto rounded-lg border bg-background p-1.5">
                                      {AVAILABLE_MEDAL_ICONS.map((ic) => (
                                        <button
                                          key={ic}
                                          type="button"
                                          onClick={() => setRecNewMedalIcon(ic)}
                                          className={`grid h-7 w-7 place-items-center rounded-md border transition-all ${
                                            recNewMedalIcon === ic
                                              ? "border-primary bg-primary text-primary-foreground shadow-xs scale-105"
                                              : "hover:bg-secondary text-muted-foreground"
                                          }`}
                                          title={ic}
                                        >
                                          <MedalIcon name={ic} className="h-3.5 w-3.5" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Preview do Requisito */}
                                  <div className="rounded-xl border bg-secondary/30 p-2 text-[11px] text-muted-foreground">
                                    <b>Descrição automática:</b> {formatEventRequirementLabel({
                                      type: recNewMedalReqType,
                                      threshold: recNewMedalThreshold,
                                      gameId: recNewMedalScope === "todos" ? undefined : recNewMedalScope,
                                    })}
                                  </div>

                                  <div className="flex justify-end gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => {
                                        if (!recNewMedalTitle.trim()) {
                                          flashSaved("Informe o título da medalha.");
                                          return;
                                        }
                                        const req: EventMedalRequirement = {
                                          type: recNewMedalReqType,
                                          threshold: Number(recNewMedalThreshold) || 1,
                                          gameId: recNewMedalScope === "todos" ? undefined : recNewMedalScope,
                                        };
                                        const medalId = `rec_medal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                                        const newM: MedalDefinition = {
                                          id: medalId,
                                          title: recNewMedalTitle.trim(),
                                          description: `${recNewMedalTitle.trim()} — Exclusiva do evento "${recTitle.trim() || "Recorrente"}". ${formatEventRequirementLabel(req)}`,
                                          rarity: recNewMedalRarity,
                                          category: "evento",
                                          iconName: recNewMedalIcon,
                                          condition: {
                                            type: recNewMedalReqType,
                                            threshold: req.threshold,
                                            gameId: req.gameId,
                                          },
                                          isCustom: true,
                                          createdByAdmin: true,
                                          eventName: recTitle.trim() || "Evento Recorrente",
                                          eventRequirement: req,
                                        };
                                        setRecAttachedMedals([...recAttachedMedals, newM]);
                                        setIsAddingMedalToRec(false);
                                        setRecNewMedalTitle("");
                                        flashSaved(`Medalha "${newM.title}" adicionada ao evento recorrente!`);
                                      }}
                                      className="rounded-xl font-bold text-xs h-8 bg-primary"
                                    >
                                      + Adicionar Medalha ao Evento
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                /* Modo Existente para Recorrente */
                                <div className="space-y-3">
                                  {availableExistingEventMedals.length === 0 ? (
                                    <div className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
                                      Nenhuma medalha de evento disponível que não esteja em uso em outro evento ativo. Crie uma nova medalha na aba acima!
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <Label className="text-[11px] font-bold">Selecione uma Medalha Existente</Label>
                                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                        {availableExistingEventMedals.map((m) => {
                                          const rarity = RARITY_INFO[m.rarity];
                                          const isAlreadyAttached = recAttachedMedals.some((a) => a.id === m.id);
                                          return (
                                            <div
                                              key={m.id}
                                              className={`flex items-center justify-between gap-2 rounded-xl border p-2 text-xs transition-colors ${
                                                isAlreadyAttached ? "opacity-40 bg-muted" : "bg-card hover:border-primary"
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${rarity.badgeBgClass}`}>
                                                  <div className={rarity.textColor}>
                                                    <MedalIcon name={m.iconName} className="h-3.5 w-3.5" />
                                                  </div>
                                                </div>
                                                <div className="min-w-0">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="font-bold truncate">{m.title}</span>
                                                    <span className={`text-[8px] font-extrabold uppercase px-1 rounded ${rarity.badgeBgClass}`}>
                                                      {rarity.label}
                                                    </span>
                                                  </div>
                                                  <p className="text-[10px] text-muted-foreground truncate">
                                                    {m.eventRequirement ? formatEventRequirementLabel(m.eventRequirement) : m.description}
                                                  </p>
                                                </div>
                                              </div>
                                              <Button
                                                type="button"
                                                size="sm"
                                                disabled={isAlreadyAttached}
                                                onClick={() => {
                                                  const cloned: MedalDefinition = {
                                                    ...m,
                                                    eventName: recTitle.trim() || m.eventName || "Evento Recorrente",
                                                    description: m.description.includes("—")
                                                      ? m.description
                                                      : `${m.title} — Exclusiva do evento "${recTitle.trim() || "Recorrente"}". ${m.description}`,
                                                  };
                                                  setRecAttachedMedals([...recAttachedMedals, cloned]);
                                                  setIsAddingMedalToRec(false);
                                                  flashSaved(`Medalha "${m.title}" vinculada ao evento recorrente!`);
                                                }}
                                                className="rounded-lg text-[10px] font-bold h-7 px-2"
                                              >
                                                {isAlreadyAttached ? "Já Vinculada" : "+ Vincular"}
                                              </Button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsCreatingRecurring(false)}
                            className="rounded-xl text-xs"
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" size="sm" className="rounded-xl font-bold text-xs bg-primary">
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Salvar Evento Recorrente
                          </Button>
                        </div>
                      </form>
                    )}

                    {/* Lista de Eventos Recorrentes Cadastrados */}
                    <div className="space-y-2">
                      <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Eventos Recorrentes Cadastrados ({recurringEvents.length})
                      </h4>

                      {recurringEvents.length === 0 ? (
                        <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                          Nenhum evento recorrente configurado. Crie um evento para ser ativado automaticamente nos fins de semana ou dias específicos.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {recurringEvents.map((ev) => {
                            const activeToday = isRecurringEventActive(ev);
                            const dayLabels = (ev.daysOfWeek ?? [])
                              .map((w) => DAYS_OF_WEEK.find((d) => d.value === w)?.short ?? String(w))
                              .join(", ");
                            return (
                              <div
                                key={ev.id}
                                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border-2 p-3.5 transition-all ${
                                  activeToday
                                    ? "border-emerald-500/50 bg-emerald-500/5 shadow-sm"
                                    : "border-border/60 bg-muted/20 opacity-80"
                                }`}
                              >
                                <div className="min-w-0 space-y-1 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                        activeToday
                                          ? "bg-emerald-500 text-white"
                                          : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {activeToday ? "✓ ATIVO HOJE" : "AGUARDANDO DIA PROGRAMADO"}
                                    </span>
                                    <h5 className="font-display text-sm font-black text-foreground truncate">
                                      {ev.title}
                                    </h5>
                                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                      {ev.scope === "todos" ? "Todos os Jogos" : GAME_NAMES[ev.scope]}
                                    </span>
                                  </div>

                                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                                    {dayLabels && (
                                      <span>
                                        Dias: <b>{dayLabels}</b>
                                      </span>
                                    )}
                                    {ev.specificDates?.length > 0 && (
                                      <span>
                                        Datas: <b>{ev.specificDates.map(formatDateOnlyBR).join(", ")}</b>
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                                    <span className="font-bold text-amber-500 flex items-center gap-1">
                                      <Zap className="h-3.5 w-3.5" />
                                      {renderActiveBonusesLabel(ev)}
                                    </span>
                                    {ev.linkedMedalId && (
                                      <span className="font-medium text-primary flex items-center gap-1">
                                        <Award className="h-3.5 w-3.5" />
                                        Medalha vinculada
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    type="button"
                                    variant={ev.active ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={() => handleToggleRecurringActive(ev.id)}
                                    className="rounded-xl text-xs h-8"
                                  >
                                    {ev.active ? "Desativar" : "Ativar"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteRecurringEvent(ev.id)}
                                    className="rounded-xl text-xs h-8 text-destructive hover:bg-destructive/10"
                                    title="Excluir evento recorrente"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: GESTÃO DE TURMAS & ESCOLAS (2 SUB-ABAS) */}
            {tab === "turmas" && (
              <div className="space-y-4">
                <div className="rounded-2xl border bg-secondary/30 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-foreground">
                      <School className="h-5 w-5 text-primary" /> Turmas & Escolas da Rede SEMED
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Acesse alunos por escola e turma ou gerencie as solicitações de mudança de turma.
                    </p>
                  </div>

                  {/* Alternador das 2 Sub-abas e Botão de Sincronizar Nuvem */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshRoster}
                      disabled={syncingRoster}
                      className="rounded-xl font-bold gap-1.5 text-xs h-9"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${syncingRoster ? "animate-spin text-primary" : "text-muted-foreground"}`}
                      />
                      {syncingRoster ? "Sincronizando..." : "Sincronizar Nuvem"}
                    </Button>

                    <div className="flex items-center gap-1 rounded-xl bg-background border p-1">
                      <button
                        type="button"
                        onClick={() => setTurmaSubTab("visao")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          turmaSubTab === "visao"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Users className="inline mr-1 h-3.5 w-3.5" /> 1. Escolas & Turmas
                      </button>
                      <button
                        type="button"
                        onClick={() => setTurmaSubTab("solicitacoes")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          turmaSubTab === "solicitacoes"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <UserCheck className="inline mr-1 h-3.5 w-3.5" /> 2. Solicitações de Troca
                        {pendingTurmaCount > 0 && (
                          <span className="ml-1.5 rounded-full bg-accent text-accent-foreground px-1.5 py-0.2 text-[9px] font-black">
                            {pendingTurmaCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* SUB-ABA 1: VISÃO POR ESCOLAS & TURMAS */}
                {turmaSubTab === "visao" && (
                  <div className="space-y-4">
                    {/* Seletor de Instituições e Escolas */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground uppercase">
                        Selecione a Instituição:
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2">
                        {/* Bloco Geral: Todas as Instituições / Escolas */}
                        {(() => {
                          const active = selectedAdminSchool === "TODAS";
                          return (
                            <button
                              key="TODAS"
                              type="button"
                              onClick={() => setSelectedAdminSchool("TODAS")}
                              className={`rounded-xl border p-2.5 text-left transition-all ${
                                active
                                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                                  : "border-border bg-card hover:bg-secondary/40"
                              }`}
                            >
                              <div className="font-display text-xs font-black truncate text-foreground flex items-center gap-1">
                                <span>Todas</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                {registeredStudents.length} aluno(s)
                              </div>
                            </button>
                          );
                        })()}
                        {SCHOOLS.map((s) => {
                          const active = selectedAdminSchool === s.name;
                          const schoolStudents = registeredStudents.filter((st) => st.school === s.name);
                          return (
                            <button
                              key={s.name}
                              type="button"
                              onClick={() => setSelectedAdminSchool(s.name)}
                              className={`rounded-xl border p-2.5 text-left transition-all ${
                                active
                                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                                  : "border-border bg-card hover:bg-secondary/40"
                              }`}
                            >
                              <div className="font-display text-xs font-black truncate text-foreground">
                                {s.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {schoolStudents.length} aluno(s)
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Seletor de Turma (A - F + TODAS) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground uppercase">
                        Filtrar Turma ({selectedAdminSchool === "TODAS" ? "Todas as Escolas" : selectedAdminSchool}):
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedAdminTurma("TODAS")}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                            selectedAdminTurma === "TODAS"
                              ? "border-primary bg-primary text-primary-foreground shadow-xs"
                              : "border-border bg-card text-muted-foreground"
                          }`}
                        >
                          Todas as Turmas
                        </button>
                        {VALID_TURMAS.map((t: TurmaCode) => {
                          const active = selectedAdminTurma === t;
                          const countInTurma = registeredStudents.filter(
                            (st) =>
                              (selectedAdminSchool === "TODAS" || st.school === selectedAdminSchool) &&
                              st.turma === t,
                          ).length;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setSelectedAdminTurma(t)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                                active
                                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                  : "border-border bg-card text-muted-foreground hover:bg-secondary/50"
                              }`}
                            >
                              Turma {t} ({countInTurma})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Lista dos Alunos Encontrados */}
                    {(() => {
                      const filtered = registeredStudents.filter((st) => {
                        const matchSchool =
                          selectedAdminSchool === "TODAS" || st.school === selectedAdminSchool;
                        const matchTurma =
                          selectedAdminTurma === "TODAS" || st.turma === selectedAdminTurma;
                        return matchSchool && matchTurma;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
                            Nenhum aluno cadastrado nesta escola e turma ainda.
                          </div>
                        );
                      }

                      const presenceSummary = computePresenceSummary(filtered);

                      return (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-bold text-muted-foreground">
                              Exibindo {filtered.length} aluno(s) de {selectedAdminSchool === "TODAS" ? "Todas as Escolas" : selectedAdminSchool}
                              {selectedAdminTurma !== "TODAS" ? ` • Turma ${selectedAdminTurma}` : ""}:
                            </div>

                            {/* Indicadores de Presenca Online / Inativo / Offline para o ADM */}
                            <div className="flex items-center gap-2.5 rounded-lg border bg-secondary/30 px-2.5 py-1 text-[11px] font-bold">
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Alunos ativos interagindo nos ultimos 5 minutos">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.9)]" />
                                {presenceSummary.online} Online
                              </span>
                              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400" title="Alunos conectados sem interacao entre 5 e 10 minutos">
                                <span className="h-2 w-2 rounded-full bg-slate-400" />
                                {presenceSummary.idle} Inativo
                              </span>
                              <span className="flex items-center gap-1 text-rose-500" title="Alunos desconectados ou sem interacao ha mais de 10 minutos">
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                                {presenceSummary.offline} Offline
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                            {filtered.map((st) => {
                              const stEff = getEffectivePlayerProgression(
                                st,
                                st.stats ?? [],
                                auth.adminConfig.enabledGames,
                              );
                              const stProg = levelProgress({
                                xp: stEff.xp,
                                matchesPlayed: stEff.matchesPlayed,
                                wins: stEff.wins,
                                distinctGames: stEff.distinctGames,
                              });

                              return (
                                <div
                                  key={st.id}
                                  onClick={() => setInspectStudentId(st.id)}
                                  className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3.5 cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.01]"
                                  title="Clique para inspecionar perfil, requisitos pendentes de nível e medalhas deste aluno"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-display text-sm font-black text-foreground truncate">
                                        {st.nick}
                                      </span>
                                      <PresenceDot
                                        playerId={st.id}
                                        playfabId={st.playfabId}
                                        nick={st.nick}
                                        nickNormalized={st.nickNormalized}
                                        size="xs"
                                      />
                                      <span className="rounded-full bg-primary/15 px-2 py-0.2 text-[10px] font-bold text-primary">
                                        Nv. {stProg.level}
                                      </span>
                                      {stProg.isLockedByMissions && (
                                        <span
                                          className="rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-extrabold text-amber-600 dark:text-amber-400"
                                          title={`XP atingido (${st.xp} XP), mas faltam missões para destravar o Nível ${stProg.nextRequirement?.level}`}
                                        >
                                          🔒 Faltam missões (Nv. {stProg.nextRequirement?.level})
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground uppercase truncate mt-0.5">
                                      {st.full_name}
                                    </div>
                                    {(selectedAdminSchool === "TODAS" ||
                                      Boolean(
                                        st.turma &&
                                          st.grade &&
                                          st.school &&
                                          st.school !== "Nenhuma" &&
                                          st.school !== "Outro"
                                      )) && (
                                      <div className="text-[11px] text-muted-foreground mt-0.5 font-semibold truncate">
                                        {selectedAdminSchool === "TODAS" && (
                                          <span className="font-bold text-primary mr-1.5">
                                            🏫 {st.school || "Sem escola"}
                                          </span>
                                        )}
                                        {st.grade ? `${st.grade} ` : ""}
                                        {st.turma ? `Turma ${st.turma}` : ""}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="font-display text-sm font-extrabold text-primary">
                                      {st.xp} XP
                                    </div>
                                    <span className="text-[10px] text-primary flex items-center justify-end gap-0.5 mt-0.5 font-bold">
                                      Ver perfil <ChevronRight className="h-3 w-3" />
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* SUB-ABA 2: SOLICITAÇÕES DE TROCA DE TURMA */}
                {turmaSubTab === "solicitacoes" && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Alunos que solicitaram mudar de turma (Turmas A até F). Ao aprovar, o perfil do aluno é atualizado automaticamente.
                    </p>

                    {turmaRequests.length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
                        Nenhuma solicitação de troca de turma registrada no momento.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {turmaRequests.map((req) => (
                          <div
                            key={req.id}
                            className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border p-4 transition-all ${
                              req.status === "pendente"
                                ? "border-primary/50 bg-primary/5"
                                : req.status === "aprovada"
                                ? "border-success/30 bg-success/5"
                                : "border-border/40 bg-muted/20 opacity-70"
                            }`}
                          >
                            <div className="min-w-0 space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                    req.status === "pendente"
                                      ? "bg-primary text-primary-foreground"
                                      : req.status === "aprovada"
                                      ? "bg-success text-success-foreground"
                                      : "bg-destructive text-destructive-foreground"
                                  }`}
                                >
                                  {req.status.toUpperCase()}
                                </span>
                                <span className="font-display text-sm font-black text-foreground">
                                  {req.playerNick}
                                </span>
                                <span className="text-xs text-muted-foreground uppercase">
                                  ({req.playerFullName})
                                </span>
                              </div>

                              <div className="text-xs text-muted-foreground">
                                Escola: <b>{req.school}</b> {req.grade ? `• ${req.grade}` : ""}
                              </div>

                              <div className="flex items-center gap-2 pt-1 font-display text-xs">
                                <span className="rounded-lg bg-card border px-2 py-0.5 text-muted-foreground font-bold">
                                  Turma Atual: {req.currentTurma ? `Turma ${req.currentTurma}` : "Nenhuma"}
                                </span>
                                <span className="text-primary font-bold">➔</span>
                                <span className="rounded-lg bg-primary/20 border border-primary/40 px-2.5 py-0.5 font-black text-primary">
                                  Nova Turma Solicitada: Turma {req.requestedTurma}
                                </span>
                              </div>

                              <p className="text-[10px] text-muted-foreground pt-0.5">
                                Solicitado em: {new Date(req.requestedAt).toLocaleString("pt-BR")}
                              </p>
                            </div>

                            {req.status === "pendente" && (
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void handleApproveTurma(req.id)}
                              className="rounded-xl text-xs font-bold bg-success hover:bg-success/90 text-white h-9"
                            >
                              <Check className="mr-1 h-3.5 w-3.5" /> Aprovar Troca
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleRejectTurma(req.id)}
                              className="rounded-xl text-xs text-destructive hover:bg-destructive/10 h-9"
                            >
                              Recusar
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

            {/* TAB 2: RESETS PERIÓDICOS & TEMPORADAS */}
            {tab === "resets" && (
              <div className="space-y-4">
                <div className="rounded-2xl border bg-secondary/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Temporada Vigente (#{draft.seasonId})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Último reset:{" "}
                      {new Date(draft.lastResetAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={draft.seasonName}
                      onChange={(e) => setDraft({ ...draft, seasonName: e.target.value })}
                      placeholder="Nome da temporada (ex: 1º Bimestre 2026)"
                      className="rounded-xl font-display font-bold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void auth.updateAdminConfig(draft).then(() => flashSaved("Nome da temporada salvo!"))}
                      className="rounded-xl shrink-0"
                    >
                      Renomear
                    </Button>
                  </div>
                </div>

                {/* Agendar Reset Flexível */}
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="font-display text-base font-extrabold flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-primary" /> Agendar Próximo Reset Periódico
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Escolha livremente a data e hora em que o ranking deverá ser reiniciado. Quando o
                    horário chegar, uma nova temporada será aberta automaticamente.
                  </p>

                  <div className="space-y-1.5">
                    <Label htmlFor="reset-datetime">Data e Hora do Reset</Label>
                    <Input
                      id="reset-datetime"
                      type="datetime-local"
                      value={scheduleInput}
                      onChange={(e) => setScheduleInput(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3">
                    <div className="text-xs">
                      <div className="font-bold">Zerar também XP Total e Nível dos alunos?</div>
                      <div className="text-muted-foreground">
                        Se desmarcado, apenas os recordes dos jogos e o XP da temporada são zerados
                        (mantendo o nível do aluno).
                      </div>
                    </div>
                    <Switch checked={scheduleClearXp} onCheckedChange={setScheduleClearXp} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={saveScheduledReset}
                      className="flex-1 rounded-xl font-bold"
                    >
                      <CalendarClock className="mr-2 h-4 w-4" /> Salvar Agendamento
                    </Button>
                    {draft.scheduledResetAt && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={cancelScheduledReset}
                        className="rounded-xl text-destructive"
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" /> Cancelar Agendamento
                      </Button>
                    )}
                  </div>
                </div>

                {/* Reset Imediato */}
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                  <div className="font-display text-base font-extrabold text-destructive flex items-center gap-2">
                    <RotateCcw className="h-5 w-5" /> Executar Reset Agora (Imediato)
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="next-season-name">Nome da Nova Temporada</Label>
                    <Input
                      id="next-season-name"
                      value={nextSeasonName}
                      onChange={(e) => setNextSeasonName(e.target.value)}
                      className="rounded-xl bg-background"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3">
                    <div className="text-xs">
                      <div className="font-bold">Zerar também XP Total e Nível dos alunos?</div>
                      <div className="text-muted-foreground">
                        Reinicia todos os alunos no Nível 1 (0 XP).
                      </div>
                    </div>
                    <Switch checked={nowClearXp} onCheckedChange={setNowClearXp} />
                  </div>

                  {!confirmResetNow ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setConfirmResetNow(true)}
                      className="w-full rounded-xl font-bold"
                    >
                      Iniciar Nova Temporada e Resetar Ranking Agora
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={executeImmediateReset}
                        className="flex-1 rounded-xl font-bold"
                      >
                        Confirmar Reset Definitivo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setConfirmResetNow(false)}
                        className="rounded-xl"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Histórico de Resets */}
                {draft.resetHistory.length > 0 && (
                  <div className="rounded-2xl border bg-card p-4 space-y-2">
                    <div className="font-display text-sm font-bold">Histórico de Resets</div>
                    <ul className="space-y-1.5 text-xs">
                      {draft.resetHistory.map((h) => (
                        <li
                          key={h.id}
                          className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2"
                        >
                          <span>
                            <b>{h.seasonName}</b> ({h.resetXp ? "Reset Total + XP" : "Reset de Temporada"})
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(h.executedAt).toLocaleString("pt-BR")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* TAB MEDALHAS: GERENCIAMENTO, CRIAÇÃO, CONCESSÃO MANUAL E CAIXA DE ENTRADA */}
            {tab === "medalhas" && (
              <div className="space-y-4">
                {/* 1. Caixa de Entrada de Notificações de Medalhas Conquistadas */}
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-display text-base font-extrabold text-foreground">
                      <Mail className="h-5 w-5 text-accent" /> Caixa de Entrada: Medalhas Conquistadas por Alunos
                    </div>
                    {(draft.adminMedalNotifications?.length ?? 0) > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const cleared = (draft.adminMedalNotifications ?? []).map((n) => ({
                            ...n,
                            read: true,
                          }));
                          const updated = { ...draft, adminMedalNotifications: cleared };
                          setDraft(updated);
                          await auth.updateAdminConfig(updated);
                          flashSaved("Mensagens marcadas como lidas.");
                        }}
                        className="text-[11px] h-7"
                      >
                        Marcar todas como lidas
                      </Button>
                    )}
                  </div>

                  {(draft.adminMedalNotifications?.length ?? 0) === 0 ? (
                    <div className="rounded-xl border border-dashed bg-secondary/30 p-6 text-center text-xs text-muted-foreground">
                      Nenhuma notificação na caixa de entrada ainda. Quando os alunos desbloquearem
                      medalhas no jogo, as mensagens aparecerão aqui em tempo real.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {draft.adminMedalNotifications!.map((notif) => {
                        const rarity = RARITY_INFO[notif.medalRarity];
                        return (
                          <div
                            key={notif.id}
                            className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-xs transition-colors ${
                              notif.read ? "bg-background/60 opacity-80" : "bg-card border-accent/40 shadow-sm"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${rarity.badgeBgClass}`}
                              >
                                <div className={rarity.textColor}>
                                  <MedalIcon name={notif.medalIcon} className="h-4 w-4" />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold truncate text-foreground">
                                  <b>{notif.studentNick}</b> ({notif.studentFullName}) conquistou a medalha:{" "}
                                  <span className={rarity.textColor}>{notif.medalTitle}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {notif.studentSchool} • Raridade: <b>{rarity.label}</b> •{" "}
                                  {new Date(notif.unlockedAt).toLocaleString("pt-BR")}
                                </div>
                              </div>
                            </div>
                            {!notif.read && (
                              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[9px] font-black uppercase text-accent-foreground">
                                Nova
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Criação de Novas Medalhas (Eventos Especiais & Competições) */}
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-display text-base font-extrabold text-foreground">
                      <Award className="h-5 w-5 text-primary" /> Criar Medalha de Evento Especial
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsCreatingMedal(!isCreatingMedal)}
                      className="rounded-xl font-bold h-8 text-xs"
                    >
                      {isCreatingMedal ? "Fechar Formulário" : "+ Nova Medalha"}
                    </Button>
                  </div>

                  {isCreatingMedal && (
                    <div className="space-y-3 rounded-2xl border bg-secondary/30 p-4 animate-in fade-in-50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Título da Medalha</Label>
                          <Input
                            value={newMedalTitle}
                            onChange={(e) => setNewMedalTitle(e.target.value)}
                            placeholder="Ex: Campeão da Gincana de Lógica"
                            className="rounded-xl h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Raridade & Brilho Neon</Label>
                          <select
                            value={newMedalRarity}
                            onChange={(e) => setNewMedalRarity(e.target.value as MedalRarity)}
                            className="h-9 w-full rounded-xl border bg-card px-2.5 text-xs font-bold text-foreground"
                          >
                            <option value="bronze">Bronze (Glow Marrom/Cobre)</option>
                            <option value="prata">Prata (Glow Prateado)</option>
                            <option value="ouro">Ouro (Glow Dourado)</option>
                            <option value="platina">Platina (Glow Ciano)</option>
                            <option value="diamante">Diamante (Glow Magenta)</option>
                            <option value="heroi">Herói (Brilho Vermelho Radiante)</option>
                          </select>
                        </div>
                      </div>

                      {/* Modo de Atribuição: Automático por Requisitos ou Manual */}
                      <div className="rounded-xl border bg-card p-3 space-y-2.5">
                        <Label className="text-xs font-bold">Tipo de Atribuição da Medalha</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setNewMedalMode("evento")}
                            className={`rounded-lg py-1.5 px-2 text-xs font-bold transition-all ${
                              newMedalMode === "evento"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "border bg-muted/30 text-muted-foreground hover:bg-secondary"
                            }`}
                          >
                            ⚡ Automática por Requisito de Evento
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewMedalMode("manual")}
                            className={`rounded-lg py-1.5 px-2 text-xs font-bold transition-all ${
                              newMedalMode === "manual"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "border bg-muted/30 text-muted-foreground hover:bg-secondary"
                            }`}
                          >
                            👤 Concessão Manual pelo ADM
                          </button>
                        </div>

                        {newMedalMode === "evento" && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold">Requisito Especial</Label>
                              <select
                                value={newMedalReqType}
                                onChange={(e) => {
                                  const t = e.target.value as EventRequirementType;
                                  setNewMedalReqType(t);
                                  const opt = EVENT_REQUIREMENT_OPTIONS.find((o) => o.type === t);
                                  if (opt) setNewMedalThreshold(opt.defaultVal);
                                }}
                                className="h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold"
                              >
                                {EVENT_REQUIREMENT_OPTIONS.map((opt) => (
                                  <option key={opt.type} value={opt.type}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold">Jogo Vinculado</Label>
                              <select
                                disabled={["event_x1_wins", "event_distinct_games", "event_daily_cap", "event_team_matches"].includes(newMedalReqType)}
                                value={newMedalScope}
                                onChange={(e) => setNewMedalScope(e.target.value as "todos" | GameId)}
                                className="h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold disabled:opacity-50"
                              >
                                <option value="todos">🌟 Qualquer Jogo</option>
                                {ALL_GAME_IDS.map((id) => (
                                  <option key={id} value={id}>
                                    🎮 {GAME_NAMES[id]}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold">
                                Meta ({EVENT_REQUIREMENT_OPTIONS.find((o) => o.type === newMedalReqType)?.unit})
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                value={newMedalThreshold}
                                onChange={(e) => setNewMedalThreshold(Math.max(1, Number(e.target.value)))}
                                className="h-8 rounded-lg text-xs font-bold bg-background"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Descrição da Conquista (Opcional)</Label>
                        <Input
                          value={newMedalDesc}
                          onChange={(e) => setNewMedalDesc(e.target.value)}
                          placeholder="Ex: Concedida por cumprir os requisitos especiais do evento."
                          className="rounded-xl h-9 text-xs"
                        />
                      </div>

                      {/* Seletor de Ícones Visual */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Selecione o Ícone da Medalha</Label>
                        <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5 max-h-32 overflow-y-auto rounded-xl border bg-card p-2">
                          {AVAILABLE_MEDAL_ICONS.map((ic) => (
                            <button
                              key={ic}
                              type="button"
                              onClick={() => setNewMedalIcon(ic)}
                              className={`grid h-8 w-8 place-items-center rounded-lg border transition-all ${
                                newMedalIcon === ic
                                  ? "border-primary bg-primary text-primary-foreground shadow-sm scale-110"
                                  : "hover:bg-secondary text-muted-foreground"
                              }`}
                              title={ic}
                            >
                              <MedalIcon name={ic} className="h-4 w-4" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={async () => {
                          if (!newMedalTitle.trim()) {
                            flashSaved("Informe o título da medalha.");
                            return;
                          }

                          let eventReq: EventMedalRequirement | null = null;
                          if (newMedalMode === "evento") {
                            eventReq = {
                              type: newMedalReqType,
                              threshold: Number(newMedalThreshold) || 1,
                              gameId: newMedalScope === "todos" ? undefined : newMedalScope,
                            };
                          }

                          const newMedal: MedalDefinition = {
                            id: `custom_${Date.now()}`,
                            title: newMedalTitle.trim(),
                            description:
                              newMedalDesc.trim() ||
                              (eventReq
                                ? `${newMedalTitle.trim()} — ${formatEventRequirementLabel(eventReq)}`
                                : "Medalha concedida manualmente pelo administrador."),
                            rarity: newMedalRarity,
                            category: "evento",
                            iconName: newMedalIcon,
                            condition: eventReq
                              ? {
                                  type: newMedalReqType,
                                  threshold: eventReq.threshold,
                                  gameId: eventReq.gameId,
                                }
                              : { type: "manual_event" },
                            isCustom: true,
                            createdByAdmin: true,
                            eventRequirement: eventReq,
                          };
                          const updatedCustoms = [...(draft.customMedals ?? []), newMedal];
                          const updatedConfig = { ...draft, customMedals: updatedCustoms };
                          setDraft(updatedConfig);
                          await auth.updateAdminConfig(updatedConfig);
                          setNewMedalTitle("");
                          setNewMedalDesc("");
                          setIsCreatingMedal(false);
                          flashSaved(`Medalha "${newMedal.title}" criada com sucesso!`);
                        }}
                        className="w-full rounded-xl font-bold h-10"
                      >
                        Salvar e Adicionar ao Catálogo de Medalhas
                      </Button>
                    </div>
                  )}
                </div>

                {/* 3. Catálogo Geral e Botão de Concessão Manual */}
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-sm font-extrabold text-foreground">
                      Todas as Medalhas do Sistema ({getAllAvailableMedals(draft.customMedals).length})
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Clique em "Conceder a Aluno" para premiar manualmente
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {getAllAvailableMedals(draft.customMedals).map((m) => {
                      const rarity = RARITY_INFO[m.rarity];
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-3 rounded-xl border bg-background p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${rarity.badgeBgClass}`}
                            >
                              <div className={rarity.textColor}>
                                <MedalIcon name={m.iconName} className="h-4 w-4" />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold truncate text-foreground">{m.title}</span>
                                <span className={`text-[10px] font-black uppercase ${rarity.textColor}`}>
                                  ({rarity.label})
                                </span>
                                {m.isCustom && (
                                  <span className="rounded bg-primary/20 px-1 text-[9px] font-black uppercase text-primary">
                                    ADM
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">{m.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setGrantMedalTarget(m);
                                setSelectedStudentForGrant(players[0]?.id ?? "");
                              }}
                              className="h-7 rounded-lg text-[11px] font-bold"
                            >
                              Conceder a Aluno
                            </Button>
                            {m.isCustom && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  const filtered = (draft.customMedals ?? []).filter((cm) => cm.id !== m.id);
                                  const updated = { ...draft, customMedals: filtered };
                                  setDraft(updated);
                                  await auth.updateAdminConfig(updated);
                                  flashSaved(`Medalha "${m.title}" excluída.`);
                                }}
                                className="h-7 w-7 p-0 text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Sub-diálogo para Conceder Medalha a Aluno */}
                {grantMedalTarget && (
                  <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4 space-y-3 animate-in zoom-in-95">
                    <div className="flex items-center justify-between">
                      <div className="font-display text-sm font-extrabold text-foreground">
                        Conceder Medalha: <b>{grantMedalTarget.title}</b>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setGrantMedalTarget(null)}
                        className="h-7 w-7 p-0"
                      >
                        ✕
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Selecione o Aluno</Label>
                      <select
                        value={selectedStudentForGrant}
                        onChange={(e) => setSelectedStudentForGrant(e.target.value)}
                        className="h-9 w-full rounded-xl border bg-card px-2.5 text-xs font-bold text-foreground"
                      >
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nick} ({p.full_name}) • {p.school} • Nv. {p.level}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      type="button"
                      onClick={async () => {
                        if (!selectedStudentForGrant) return;
                        const res = await grantPlayerMedalManually(selectedStudentForGrant, grantMedalTarget);
                        if (res.success) {
                          flashSaved(`Medalha "${grantMedalTarget.title}" concedida ao aluno com sucesso!`);
                          setGrantMedalTarget(null);
                        } else {
                          flashSaved(res.error || "Erro ao conceder medalha.");
                        }
                      }}
                      className="w-full rounded-xl font-bold h-10"
                    >
                      Confirmar e Enviar Medalha ao Inventário do Aluno
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: SISTEMA, PLAYFAB & ALUNOS */}
            {tab === "sistema" && (
              <div className="space-y-4">
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-base font-extrabold flex items-center gap-2">
                      <Cloud className="h-5 w-5 text-primary" /> Microsoft Azure PlayFab
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        isPlayFabConfigured()
                          ? "bg-success/15 text-success"
                          : "bg-accent/15 text-accent"
                      }`}
                    >
                      {isPlayFabConfigured()
                        ? `Ativo (Title ID: ${getPlayFabTitleId()})`
                        : "Modo Local / Offline-First"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Informe o <b>Title ID</b> do seu projeto no Azure PlayFab Game Manager (ex:{" "}
                    <code>1A2B3</code>) ou defina <code>VITE_PLAYFAB_TITLE_ID</code> no GitHub
                    Actions.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="pf-title-id">PlayFab Title ID</Label>
                    <Input
                      id="pf-title-id"
                      value={draft.playfabTitleId ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, playfabTitleId: e.target.value.trim().toUpperCase() })
                      }
                      placeholder="Ex: 9F8E7 (deixe vazio para modo local)"
                      className="rounded-xl font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="daily-xp-cap">
                      Limite Diário de XP por Aluno (padrão: 1.000 XP/dia)
                    </Label>
                    <Input
                      id="daily-xp-cap"
                      type="number"
                      min={100}
                      max={50000}
                      step={50}
                      value={draft.dailyXpCap ?? 1000}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          dailyXpCap: Math.max(100, Number(e.target.value) || 1000),
                        })
                      }
                      className="rounded-xl font-display font-bold"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Com 1.000 XP/dia, o aluno alcança no máximo o Nível 4 no 1º dia (795 XP) e
                      precisa de ~9 dias de atividades para atingir o Nível Máximo (10 — 8.433 XP).
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="new-admin-pin">Alterar Senha/PIN do Painel ADM (opcional)</Label>
                    <Input
                      id="new-admin-pin"
                      type="password"
                      value={newAdminPin}
                      onChange={(e) => setNewAdminPin(e.target.value)}
                      placeholder="Nova senha ADM (mínimo 4 caracteres)"
                      className="rounded-xl"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={saveSystemSettings}
                    className="w-full rounded-xl font-bold"
                  >
                    <Save className="mr-2 h-4 w-4" /> Salvar Configurações do Sistema
                  </Button>
                </div>

                {/* Lista de Alunos Cadastrados */}
                <div className="rounded-2xl border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" /> Alunos Cadastrados ({players.length})
                    </span>
                  </div>
                  {players.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Nenhum aluno cadastrado neste navegador ainda.
                    </p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {players.map((p) => {
                        const pEff = getEffectivePlayerProgression(
                          p,
                          p.stats ?? [],
                          auth.adminConfig.enabledGames,
                        );
                        const pProg = levelProgress({
                          xp: pEff.xp,
                          matchesPlayed: pEff.matchesPlayed,
                          wins: pEff.wins,
                          distinctGames: pEff.distinctGames,
                        });

                        return (
                          <div
                            key={p.id}
                            onClick={() => setInspectStudentId(p.id)}
                            className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-xs cursor-pointer hover:border-primary/50 transition-colors"
                            title="Clique para inspecionar perfil e requisitos de nível deste aluno"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-bold truncate flex-wrap">
                                <span className="truncate">{p.nick}</span>
                                <PresenceDot
                                  playerId={p.id}
                                  playfabId={p.playfabId}
                                  nick={p.nick}
                                  nickNormalized={p.nickNormalized}
                                  size="xs"
                                />
                                <span className="font-normal text-muted-foreground truncate">({p.full_name})</span>
                                {pProg.isLockedByMissions && (
                                  <span
                                    className="rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-600 dark:text-amber-400"
                                    title={`Faltam missões para o Nível ${pProg.nextRequirement?.level}`}
                                  >
                                    🔒 Faltam missões (Nv. {pProg.nextRequirement?.level})
                                  </span>
                                )}
                              </div>
                              <div className="text-muted-foreground truncate">
                                {p.school}
                                {p.grade ? ` • ${p.grade}` : ""} •{" "}
                                <b className="text-foreground">
                                  {stageFromBirthdate(p.birthdate).shortLabel} ({ageFrom(p.birthdate)}{" "}
                                  anos)
                                </b>{" "}
                                • Nasc:{" "}
                                {new Date(`${p.birthdate}T00:00:00`).toLocaleDateString("pt-BR")}
                              </div>
                            </div>
                            <div className="text-right shrink-0 font-display font-bold text-primary">
                              Nv. {pProg.level} ({p.xp} XP)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        <PlayerInspectModal
          playerId={inspectStudentId}
          open={Boolean(inspectStudentId)}
          onOpenChange={(v) => {
            if (!v) {
              setInspectStudentId(null);
              setRegisteredStudents(getAllRegisteredPlayers());
            }
          }}
          onStudentUpdated={() => setRegisteredStudents(getAllRegisteredPlayers())}
        />
      </DialogContent>
    </Dialog>
  );
}
