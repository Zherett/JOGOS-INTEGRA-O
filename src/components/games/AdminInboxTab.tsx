import { useState, useMemo, useEffect } from "react";
import {
  Mail,
  Send,
  Gift,
  Plus,
  Trash2,
  Search,
  Users,
  School,
  GraduationCap,
  CheckSquare,
  Square,
  Sparkles,
  Clock,
  Lock,
  Eye,
  Award,
  Coins,
  Package,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  sendAdminBroadcastMessage,
  loadAllInboxMessages,
  getMessageReaders,
  type SystemInboxMessage,
  type AdminBroadcastDraft,
} from "@/lib/inbox-messages";
import { getAllAvailableMedals, RARITY_INFO } from "@/lib/medals-catalog";
import {
  SCHOOLS,
  AGE_STAGES,
  stageFromBirthdate,
  levelProgress,
} from "@/lib/player-profile";
import {
  getAllRegisteredPlayers,
  syncInboxReadsFromPlayFab,
  type PlayerProfile,
} from "@/lib/playfab";
import { usePlayerAuth } from "@/lib/player-auth";
import { MedalIcon } from "./MedalIcon";

interface Props {
  registeredStudents?: PlayerProfile[];
  onBroadcastSent?: (msg: string) => void;
}

export function AdminInboxTab({ registeredStudents = [], onBroadcastSent }: Props) {
  const auth = usePlayerAuth();

  // Lista de alunos garantida (usa prop ou fallback direto para a base local)
  const studentsList = useMemo(() => {
    if (Array.isArray(registeredStudents) && registeredStudents.length > 0) {
      return registeredStudents;
    }
    return getAllRegisteredPlayers();
  }, [registeredStudents]);

  // Modo de destinatários
  const [recipientMode, setRecipientMode] = useState<"all" | "school" | "stage" | "students">("all");
  const [selectedSchool, setSelectedSchool] = useState<string>("TODAS");
  const [selectedStage, setSelectedStage] = useState<string>("TODAS");
  const [studentSearch, setStudentSearch] = useState("");

  // Conjunto de IDs de alunos explicitamente selecionados
  // REGRA DO USUÁRIO: Por padrão, os alunos começam DESMARCADOS
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Dados da mensagem
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Tags de GIF: [{ tagKey: "gif1", url: "" }]
  const [gifList, setGifList] = useState<{ tagKey: string; url: string }[]>([]);
  // Tags de Imagens Estáticas: [{ tagKey: "img1", url: "" }]
  const [imageList, setImageList] = useState<{ tagKey: string; url: string }[]>([]);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Configurações de Recompensa
  const [hasReward, setHasReward] = useState(false);
  const [rewardType, setRewardType] = useState<"points" | "medal" | "future_item">("points");
  const [rewardPoints, setRewardPoints] = useState<number>(100);
  const [selectedMedalId, setSelectedMedalId] = useState<string>("");
  const [isSecretReward, setIsSecretReward] = useState<boolean>(false);

  // Histórico de mensagens enviadas e visualizador de leituras
  const [sentHistory, setSentHistory] = useState<SystemInboxMessage[]>([]);
  const [readersModalMsg, setReadersModalMsg] = useState<SystemInboxMessage | null>(null);
  const [readersTab, setReadersTab] = useState<"read" | "unread">("read");

  // Carrega lista de medalhas disponíveis de forma segura
  const availableMedals = useMemo(() => {
    try {
      return getAllAvailableMedals() || [];
    } catch {
      return [];
    }
  }, []);

  // Define medalha padrão caso vazio
  useEffect(() => {
    if (!selectedMedalId && availableMedals.length > 0) {
      setSelectedMedalId(availableMedals[0].id);
    }
  }, [availableMedals, selectedMedalId]);

  const [readersRefreshCount, setReadersRefreshCount] = useState(0);
  const [isSyncingReaders, setIsSyncingReaders] = useState(false);

  // Carrega histórico de mensagens enviadas
  const refreshHistory = () => {
    try {
      const all = loadAllInboxMessages();
      const admMsgs = all.filter((m) => m && m.sender === "adm");
      setSentHistory(admMsgs.slice().reverse());
      // Dispara sincronização em segundo plano das leituras na nuvem
      syncInboxReadsFromPlayFab()
        .then(() => setReadersRefreshCount((c) => c + 1))
        .catch(console.warn);
    } catch (err) {
      console.error("Erro ao carregar histórico de mensagens:", err);
      setSentHistory([]);
    }
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  // Sincroniza ativamente da nuvem PlayFab sempre que o modal de detalhes de leitura for aberto
  useEffect(() => {
    if (readersModalMsg) {
      let isSubscribed = true;
      setIsSyncingReaders(true);
      syncInboxReadsFromPlayFab()
        .then(() => {
          if (isSubscribed) {
            setReadersRefreshCount((c) => c + 1);
          }
        })
        .catch(console.warn)
        .finally(() => {
          if (isSubscribed) {
            setIsSyncingReaders(false);
          }
        });

      return () => {
        isSubscribed = false;
      };
    }
  }, [readersModalMsg]);

  const handleManualSyncReaders = async () => {
    setIsSyncingReaders(true);
    try {
      await syncInboxReadsFromPlayFab();
      setReadersRefreshCount((c) => c + 1);
    } catch (err) {
      console.warn("Falha na sincronização manual de leituras:", err);
    } finally {
      setIsSyncingReaders(false);
    }
  };

  // Alunos elegíveis de acordo com os filtros de escola e etapa
  const eligibleStudents = useMemo(() => {
    return studentsList.filter((student) => {
      if (!student || !student.id) return false;

      // Filtro de Escola
      if (recipientMode === "school" && selectedSchool !== "TODAS") {
        const studentSchool = (student.school || "").trim().toLowerCase();
        if (studentSchool !== selectedSchool.trim().toLowerCase()) {
          return false;
        }
      }

      // Filtro de Etapa
      if (recipientMode === "stage" && selectedStage !== "TODAS") {
        try {
          const stInfo = stageFromBirthdate(student.birthdate, new Date(), student.school);
          if (stInfo.id !== selectedStage && stInfo.shortLabel !== selectedStage) {
            return false;
          }
        } catch {
          return false;
        }
      }

      return true;
    });
  }, [studentsList, recipientMode, selectedSchool, selectedStage]);

  // Alunos elegíveis filtrados pelo termo de pesquisa na UI
  const displayStudents = useMemo(() => {
    if (!studentSearch.trim()) return eligibleStudents;
    const q = studentSearch.toLowerCase().trim();
    return eligibleStudents.filter((s) => {
      const nick = (s.nick || "").toLowerCase();
      const fullName = (s.full_name || "").toLowerCase();
      const school = (s.school || "").toLowerCase();
      return nick.includes(q) || fullName.includes(q) || school.includes(q);
    });
  }, [eligibleStudents, studentSearch]);

  // Contagem de alunos por escola para exibir no seletor
  const schoolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const st of studentsList) {
      if (st.school) {
        counts[st.school] = (counts[st.school] || 0) + 1;
      }
    }
    return counts;
  }, [studentsList]);

  // Contagem de alunos por etapa para exibir no seletor
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const st of studentsList) {
      try {
        const info = stageFromBirthdate(st.birthdate, new Date(), st.school);
        counts[info.id] = (counts[info.id] || 0) + 1;
      } catch {
        /* ignore */
      }
    }
    return counts;
  }, [studentsList]);

  // Ao alternar o modo ou alterar o filtro de escola/etapa:
  // Por regra, os alunos começam DESMARCADOS (seleção limpa)
  useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [recipientMode, selectedSchool, selectedStage]);

  // Verifica se todos os alunos elegíveis estão marcados atualmente
  const isAllSelected = useMemo(() => {
    if (eligibleStudents.length === 0) return false;
    return eligibleStudents.every((s) => selectedStudentIds.has(s.id));
  }, [eligibleStudents, selectedStudentIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Se todos estiverem selecionados, desmarca todos
      setSelectedStudentIds(new Set());
    } else {
      // Caso contrário, marca todos os elegíveis
      const next = new Set(eligibleStudents.map((s) => s.id));
      setSelectedStudentIds(next);
    }
  };

  const handleToggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Manipulação de GIFs
  const handleAddGifTag = () => {
    const nextIdx = gifList.length + 1;
    const tagKey = `gif${nextIdx}`;
    setGifList((prev) => [...prev, { tagKey, url: "" }]);
  };

  const handleRemoveGifTag = (idx: number) => {
    setGifList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateGifUrl = (idx: number, url: string) => {
    setGifList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, url: url.trim() } : item))
    );
  };

  const handleInsertGifIntoBody = (tagKey: string) => {
    const tag = `[${tagKey}]`;
    setBody((prev) => (prev ? `${prev}\n${tag}\n` : `${tag}\n`));
    setCopiedTag(tagKey);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // Manipulação de Imagens Estáticas ([img1], [img2], etc.)
  const handleAddImageTag = () => {
    const nextIdx = imageList.length + 1;
    const tagKey = `img${nextIdx}`;
    setImageList((prev) => [...prev, { tagKey, url: "" }]);
  };

  const handleRemoveImageTag = (idx: number) => {
    setImageList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateImageUrl = (idx: number, url: string) => {
    setImageList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, url: url.trim() } : item))
    );
  };

  const handleInsertImageIntoBody = (tagKey: string) => {
    const tag = `[${tagKey}]`;
    setBody((prev) => (prev ? `${prev}\n${tag}\n` : `${tag}\n`));
    setCopiedTag(tagKey);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // Envio da Mensagem
  const handleSendMessage = async () => {
    if (!title.trim()) {
      alert("Por favor, informe o título da mensagem.");
      return;
    }
    if (!body.trim()) {
      alert("Por favor, escreva o texto da mensagem.");
      return;
    }

    if (selectedStudentIds.size === 0) {
      alert(
        "Nenhum aluno está selecionado para receber a mensagem. Marque pelo menos um aluno ou utilize o botão 'Marcar Todos'."
      );
      return;
    }

    // Coleta todos os identificadores (id, nick, nickNormalizado, playfabId) dos alunos marcados
    const selectedStudents = studentsList.filter((s) => selectedStudentIds.has(s.id));
    const targetIdentifiers: string[] = [];
    for (const s of selectedStudents) {
      if (s.id) targetIdentifiers.push(s.id);
      if (s.nick) targetIdentifiers.push(s.nick);
      if (s.nickNormalized) targetIdentifiers.push(s.nickNormalized);
      if (s.playfabId) targetIdentifiers.push(s.playfabId);
    }

    // Alunos que foram desmarcados dentro do escopo elegível
    const excludedStudentIds = eligibleStudents
      .filter((s) => !selectedStudentIds.has(s.id))
      .map((s) => s.id);

    // Constrói mapa de gifLinks
    const gifLinks: Record<string, string> = {};
    for (const g of gifList) {
      if (g.url.trim()) {
        gifLinks[g.tagKey] = g.url.trim();
      }
    }

    // Constrói mapa de imageLinks ([img1], [img2], etc.)
    const imageLinks: Record<string, string> = {};
    for (const img of imageList) {
      if (img.url.trim()) {
        imageLinks[img.tagKey] = img.url.trim();
      }
    }

    const draft: AdminBroadcastDraft = {
      mode: recipientMode,
      targetSchool: recipientMode === "school" ? selectedSchool : undefined,
      targetStage: recipientMode === "stage" ? selectedStage : undefined,
      targetStudentIds: targetIdentifiers,
      excludedStudentIds: excludedStudentIds,
      title: title.trim(),
      body: body.trim(),
      gifLinks: Object.keys(gifLinks).length > 0 ? gifLinks : undefined,
      imageLinks: Object.keys(imageLinks).length > 0 ? imageLinks : undefined,
      reward: hasReward
        ? {
            type: rewardType,
            pointsAmount: rewardType === "points" ? Number(rewardPoints) || 50 : undefined,
            medalId: rewardType === "medal" ? selectedMedalId : undefined,
            isSecret: isSecretReward,
          }
        : undefined,
    };

    const sent = sendAdminBroadcastMessage(draft);

    // Sincroniza imediatamente com PlayFab Cloud através de PlatformAdminConfig
    const allMsgs = loadAllInboxMessages();
    try {
      await auth.updateAdminConfig({
        ...auth.adminConfig,
        inboxMessages: allMsgs.slice(0, 50),
      });
    } catch (err) {
      console.warn("Aviso ao salvar configuração remota:", err);
    }

    refreshHistory();

    const recipientCount = selectedStudentIds.size;
    const msgFeedback = `✅ Mensagem "${sent.title}" transmitida com sucesso para ${recipientCount} aluno(s)!`;
    onBroadcastSent?.(msgFeedback);

    // Limpa campos do compositor e seleção
    setTitle("");
    setBody("");
    setGifList([]);
    setImageList([]);
    setHasReward(false);
    setIsSecretReward(false);
    setSelectedStudentIds(new Set());
  };

  // Estatísticas de leitura para o modal de inspeção
  const activeReadersData = useMemo(() => {
    if (!readersModalMsg) return null;
    // readersRefreshCount garante recalculo imediato após retorno do PlayFab
    void readersRefreshCount;
    return getMessageReaders(readersModalMsg, studentsList);
  }, [readersModalMsg, studentsList, readersRefreshCount]);

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="rounded-3xl border bg-gradient-to-r from-amber-500/10 via-primary/10 to-transparent p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500 text-zinc-950 shadow-md">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-lg font-black text-foreground">
                Correio & Transmissão de Mensagens
              </h2>
              <p className="text-xs text-muted-foreground">
                Envie comunicados gerais, gifs animados, pontos e medalhas para todos os alunos ou grupos específicos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-foreground border">
              Total na Plataforma: <b>{studentsList.length}</b> alunos
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: DESTINATÁRIOS & SELEÇÃO DE ALUNOS (5 colunas) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl border bg-card p-4 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold text-foreground">
                  Destinatários da Mensagem
                </h3>
              </div>
              <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {selectedStudentIds.size} selecionado(s)
              </span>
            </div>

            {/* SELETOR DE MODO */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Modo de Envio</Label>
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-secondary/50 p-1">
                <button
                  type="button"
                  onClick={() => setRecipientMode("all")}
                  className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
                    recipientMode === "all"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🌐 Todos
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode("school")}
                  className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
                    recipientMode === "school"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🏫 Por Escola
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode("stage")}
                  className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
                    recipientMode === "stage"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🎓 Por Etapa
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode("students")}
                  className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
                    recipientMode === "students"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  👤 Específicos
                </button>
              </div>
            </div>

            {/* FILTROS ADICIONAIS CONFORME MODO */}
            {recipientMode === "school" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">Selecione a Escola</Label>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    {selectedSchool === "TODAS"
                      ? `${studentsList.length} alunos cadastrados`
                      : `${schoolCounts[selectedSchool] || 0} alunos cadastrados`}
                  </span>
                </div>
                <select
                  value={selectedSchool}
                  onChange={(e) => setSelectedSchool(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="TODAS">Todas as Escolas ({studentsList.length} alunos)</option>
                  {SCHOOLS.map((s) => {
                    const count = schoolCounts[s.name] || 0;
                    return (
                      <option key={s.name} value={s.name}>
                        {s.name} ({count} {count === 1 ? "aluno" : "alunos"})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {recipientMode === "stage" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">Selecione a Etapa</Label>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    {selectedStage === "TODAS"
                      ? `${studentsList.length} alunos no total`
                      : `${stageCounts[selectedStage] || 0} alunos`}
                  </span>
                </div>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary"
                >
                  <option value="TODAS">Todas as Etapas ({studentsList.length} alunos)</option>
                  {AGE_STAGES.map((st) => {
                    const count = stageCounts[st.id] || 0;
                    return (
                      <option key={st.id} value={st.id}>
                        {st.label} ({count} {count === 1 ? "aluno" : "alunos"})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* BARRA DE PESQUISA E AÇÃO RÁPIDA DE MARCAÇÃO EM 1 BOTÃO */}
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Pesquisar por nick ou escola..."
                  className="h-9 pl-8 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className={`flex items-center gap-1.5 font-bold text-xs py-1.5 px-3 rounded-xl transition-all cursor-pointer border ${
                    isAllSelected
                      ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                      : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                  }`}
                >
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="h-3.5 w-3.5" />
                      <span>Desmarcar Todos ({eligibleStudents.length})</span>
                    </>
                  ) : (
                    <>
                      <Square className="h-3.5 w-3.5" />
                      <span>Marcar Todos ({eligibleStudents.length})</span>
                    </>
                  )}
                </button>

                <span className="text-[11px] font-bold text-muted-foreground">
                  {selectedStudentIds.size} de {eligibleStudents.length} marcados
                </span>
              </div>
            </div>

            {/* LISTA ROLÁVEL DE ALUNOS COM CHECKBOX */}
            <div className="max-h-[380px] overflow-y-auto space-y-1.5 rounded-2xl border bg-background/50 p-2">
              {displayStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum aluno encontrado com os filtros atuais.
                </div>
              ) : (
                displayStudents.map((student) => {
                  const isChecked = selectedStudentIds.has(student.id);
                  let stageText = "Geral";
                  try {
                    const stInfo = stageFromBirthdate(student.birthdate, new Date(), student.school);
                    stageText = stInfo.shortLabel || "Geral";
                  } catch {
                    stageText = "Geral";
                  }

                  const studentLvl = student.level || levelProgress(student.xp || 0).level || 1;

                  return (
                    <div
                      key={student.id}
                      onClick={() => handleToggleStudent(student.id)}
                      className={`flex items-center justify-between gap-2 rounded-xl p-2.5 text-xs transition-colors cursor-pointer border ${
                        isChecked
                          ? "border-primary/40 bg-primary/5 text-foreground"
                          : "border-border/60 bg-card/60 opacity-60 text-muted-foreground hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleStudent(student.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded accent-primary cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-display font-bold text-foreground truncate">
                            {student.nick}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {student.school || "Sem escola"} • {stageText}
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary shrink-0">
                        Nv. {studentLvl}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: COMPOSITOR DA MENSAGEM, GIFS E RECOMPENSAS (7 colunas) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-3xl border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold text-foreground">
                  Compositor do Comunicado
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                Suporta quebras de linha e tags de mídia
              </span>
            </div>

            {/* TÍTULO DA MENSAGEM */}
            <div className="space-y-1.5">
              <Label htmlFor="msg-title" className="text-xs font-bold text-foreground">
                Título do Comunicado
              </Label>
              <Input
                id="msg-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: 🏆 Desafio de Sexta-feira liberado para todos!"
                className="h-11 rounded-2xl font-bold text-sm"
              />
            </div>

            {/* CORPO DA MENSAGEM */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="msg-body" className="text-xs font-bold text-foreground">
                  Texto da Mensagem
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {body.length} caracteres
                </span>
              </div>
              <textarea
                id="msg-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva a mensagem completa para os alunos. Para exibir um GIF animado em um ponto específico do texto, use a tag [gif1] ou [gif2]..."
                rows={6}
                className="w-full rounded-2xl border bg-background p-3.5 text-xs font-medium leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* GERENCIADOR DE MÍDIAS (GIFS E IMAGENS ESTÁTICAS) */}
            <div className="space-y-4 rounded-2xl border bg-secondary/30 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="font-display text-xs font-bold text-foreground">
                    Anexar Mídias (GIFs Animados & Imagens Estáticas)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddGifTag}
                    className="h-7 rounded-xl text-[11px] font-bold gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> GIF ([gif])
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddImageTag}
                    className="h-7 rounded-xl text-[11px] font-bold gap-1 cursor-pointer border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                  >
                    <ImageIcon className="h-3 w-3" /> Imagem ([img])
                  </Button>
                </div>
              </div>

              {/* LISTA DE GIFS */}
              {gifList.length > 0 && (
                <div className="space-y-2 border-t border-border/50 pt-2">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> GIFs Animados:
                  </span>
                  {gifList.map((gif, idx) => (
                    <div
                      key={gif.tagKey}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-2 rounded-xl border bg-background p-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleInsertGifIntoBody(gif.tagKey)}
                        title="Clique para inserir a tag no texto"
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-zinc-950 transition-colors cursor-pointer shrink-0"
                      >
                        {copiedTag === gif.tagKey ? (
                          <>
                            <Check className="h-3 w-3" /> Inserido!
                          </>
                        ) : (
                          <>
                            [{gif.tagKey}] <Copy className="h-3 w-3 opacity-70" />
                          </>
                        )}
                      </button>

                      <Input
                        value={gif.url}
                        onChange={(e) => handleUpdateGifUrl(idx, e.target.value)}
                        placeholder="Cole o link direto do GIF (ex: https://media.tenor.com/.../anim.gif)"
                        className="h-8 rounded-lg text-xs flex-1"
                      />

                      {gif.url && (
                        <div className="h-8 w-8 rounded-lg border bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                          <img
                            src={gif.url}
                            alt="preview"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveGifTag(idx)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* LISTA DE IMAGENS ESTÁTICAS */}
              {imageList.length > 0 && (
                <div className="space-y-2 border-t border-border/50 pt-2">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> Imagens Estáticas (PNG, JPG, WebP):
                  </span>
                  {imageList.map((img, idx) => (
                    <div
                      key={img.tagKey}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-2 rounded-xl border bg-background p-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleInsertImageIntoBody(img.tagKey)}
                        title="Clique para inserir a tag no texto"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-500/15 border border-blue-500/30 px-2 py-1 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer shrink-0"
                      >
                        {copiedTag === img.tagKey ? (
                          <>
                            <Check className="h-3 w-3" /> Inserido!
                          </>
                        ) : (
                          <>
                            [{img.tagKey}] <Copy className="h-3 w-3 opacity-70" />
                          </>
                        )}
                      </button>

                      <Input
                        value={img.url}
                        onChange={(e) => handleUpdateImageUrl(idx, e.target.value)}
                        placeholder="Cole o link direto da imagem (ex: https://.../aviso.png)"
                        className="h-8 rounded-lg text-xs flex-1"
                      />

                      {img.url && (
                        <div className="h-8 w-8 rounded-lg border bg-muted/50 overflow-hidden shrink-0 flex items-center justify-center">
                          <img
                            src={img.url}
                            alt="preview"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveImageTag(idx)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {gifList.length === 0 && imageList.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nenhuma mídia anexada. Use os botões acima para adicionar tags como <code>[gif1]</code> para animações ou <code>[img1]</code> para imagens estáticas (PNG, JPG, etc.) e cole as URLs correspondentes.
                </p>
              ) : (
                <div className="text-[10px] text-muted-foreground pt-1 border-t">
                  💡 <b>Dica:</b> Clique no botão da tag (ex: <code>[gif1]</code> ou <code>[img1]</code>) para inseri-la automaticamente no corpo do texto.
                </div>
              )}
            </div>

            {/* SEÇÃO DE RECOMPENSAS */}
            <div className="space-y-3 rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-amber-500 animate-bounce" />
                  <div>
                    <span className="font-display text-xs font-bold text-foreground block">
                      Anexar Recompensa à Mensagem
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      O aluno receberá um botão para resgatar o prêmio dentro do correio
                    </span>
                  </div>
                </div>
                <Switch
                  checked={hasReward}
                  onCheckedChange={setHasReward}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {hasReward && (
                <div className="space-y-3.5 pt-2 border-t border-primary/10">
                  {/* TIPO DE RECOMPENSA */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Tipo de Recompensa</Label>
                    <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-background p-1 border">
                      <button
                        type="button"
                        onClick={() => setRewardType("points")}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                          rewardType === "points"
                            ? "bg-amber-500 text-zinc-950 shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Coins className="h-3.5 w-3.5" /> Pontos
                      </button>
                      <button
                        type="button"
                        onClick={() => setRewardType("medal")}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                          rewardType === "medal"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Award className="h-3.5 w-3.5" /> Medalha
                      </button>
                      <button
                        type="button"
                        onClick={() => setRewardType("future_item")}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all ${
                          rewardType === "future_item"
                            ? "bg-secondary text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Package className="h-3.5 w-3.5" /> Novo Item
                      </button>
                    </div>
                  </div>

                  {/* CONFIGURAÇÃO ESPECÍFICA DO TIPO */}
                  {rewardType === "points" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="reward-points" className="text-xs font-bold text-foreground">
                        Quantidade de Pontos de Carreira
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="reward-points"
                          type="number"
                          min={10}
                          max={5000}
                          step={10}
                          value={rewardPoints}
                          onChange={(e) => setRewardPoints(Math.max(1, Number(e.target.value)))}
                          className="h-10 rounded-xl font-bold text-sm w-36"
                        />
                        <span className="text-xs text-muted-foreground">
                          Serão adicionados diretamente ao saldo de pontos do aluno.
                        </span>
                      </div>
                    </div>
                  )}

                  {rewardType === "medal" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="reward-medal" className="text-xs font-bold text-foreground">
                        Medalha a Conceder
                      </Label>
                      <select
                        id="reward-medal"
                        value={selectedMedalId}
                        onChange={(e) => setSelectedMedalId(e.target.value)}
                        className="h-10 w-full rounded-xl border bg-background px-3 text-xs font-bold"
                      >
                        {availableMedals.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.rarity.toUpperCase()}] {m.title} — {m.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {rewardType === "future_item" && (
                    <div className="rounded-xl border border-dashed border-primary/40 bg-background/50 p-3 text-center space-y-1">
                      <Package className="h-6 w-6 text-primary mx-auto opacity-70" />
                      <div className="text-xs font-bold text-foreground">
                        Módulo de Itens Futuros (Reservado)
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Esta área já está isolada e estruturada para expansões de inventário e itens especiais que serão adicionados futuramente à plataforma.
                      </div>
                    </div>
                  )}

                  {/* TOGGLE DE RECOMPENSA SECRETA */}
                  <div className="flex items-center justify-between rounded-xl border bg-background/80 p-3">
                    <div className="flex items-center gap-2.5">
                      <Lock className="h-4 w-4 text-amber-500" />
                      <div>
                        <span className="font-display text-xs font-bold text-foreground block">
                          Tornar Recompensa Secreta
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          O aluno terá que pressionar para carregar a barra de revelação antes de abrir o prêmio
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={isSecretReward}
                      onCheckedChange={setIsSecretReward}
                      className="data-[state=checked]:bg-amber-500"
                    />
                  </div>

                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Regra do Sistema: O aluno só poderá excluir esta mensagem após resgatar a recompensa.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* BOTÃO PRINCIPAL DE ENVIO */}
            <Button
              type="button"
              size="lg"
              onClick={() => void handleSendMessage()}
              className="h-12 w-full rounded-2xl font-display text-sm font-extrabold gap-2 shadow-lg cursor-pointer"
            >
              <Send className="h-4 w-4" /> Transmitir Mensagem para {selectedStudentIds.size} Aluno(s)
            </Button>
          </div>

          {/* HISTÓRICO DE MENSAGENS TRANSMITIDAS COM CONTADOR DE LEITURAS */}
          <div className="rounded-3xl border bg-card p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-display text-xs font-bold text-foreground uppercase tracking-wider">
                  Histórico de Mensagens Transmitidas ({sentHistory.length})
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshHistory}
                className="h-7 text-xs font-bold cursor-pointer"
              >
                Atualizar
              </Button>
            </div>

            {sentHistory.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Nenhum comunicado foi transmitido recentemente.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2.5">
                {sentHistory.map((msg) => {
                  let formattedDate = "Recente";
                  try {
                    formattedDate = new Date(msg.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  } catch {
                    formattedDate = "Recente";
                  }

                  const stats = getMessageReaders(msg, studentsList);
                  const readPercent =
                    stats.totalTargeted > 0
                      ? Math.round((stats.readCount / stats.totalTargeted) * 100)
                      : 0;

                  return (
                    <div
                      key={msg.id}
                      className="flex flex-col gap-2 rounded-2xl border bg-secondary/25 p-3.5 text-xs transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-foreground truncate text-sm">
                              {msg.title}
                            </span>
                            {msg.reward && (
                              <span className="rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 shrink-0">
                                🎁 Recompensa
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {formattedDate} • Destinatários:{" "}
                            {msg.recipientId === "ALL"
                              ? msg.recipientFilter?.school
                                ? `Escola: ${msg.recipientFilter.school}`
                                : msg.recipientFilter?.stage
                                  ? `Etapa: ${msg.recipientFilter.stage}`
                                  : "Todos os Alunos"
                              : `Aluno: ${msg.recipientId}`}
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-background/80 px-2 py-0.5 rounded-md border">
                          ID: {msg.id.substring(0, 8)}
                        </span>
                      </div>

                      {/* ESTATÍSTICA DE LEITURAS / QUEM ABRIU A MENSAGEM */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary">
                            <Eye className="h-3.5 w-3.5" />
                            <span>
                              {stats.readCount} de {stats.totalTargeted} alunos abriram ({readPercent}%)
                            </span>
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReadersModalMsg(msg);
                            setReadersTab("read");
                          }}
                          className="h-7 rounded-xl text-[11px] font-bold gap-1 cursor-pointer"
                        >
                          <Users className="h-3 w-3" /> Ver Detalhes de Leitura
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE DETALHES DE LEITURA (QUEM ABRIU / QUEM NÃO ABRIU) */}
      <Dialog open={Boolean(readersModalMsg)} onOpenChange={() => setReadersModalMsg(null)}>
        <DialogContent className="w-[95vw] max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle className="font-display text-lg font-black text-foreground flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Controle de Leitura do Comunicado
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSyncingReaders}
                onClick={handleManualSyncReaders}
                className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1.5 text-primary hover:bg-primary/10 cursor-pointer"
                title="Sincronizar leituras registradas na nuvem PlayFab"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncingReaders ? "animate-spin" : ""}`} />
                <span>{isSyncingReaders ? "Sincronizando..." : "Sincronizar"}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {readersModalMsg?.title}
            </p>
          </DialogHeader>

          {activeReadersData && (
            <div className="space-y-4 pt-2">
              {/* RESUMO EM NÚMEROS */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="font-display text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {activeReadersData.readCount}
                  </div>
                  <div className="text-[11px] font-bold text-muted-foreground">
                    Já Abriram ({activeReadersData.totalTargeted > 0 ? Math.round((activeReadersData.readCount / activeReadersData.totalTargeted) * 100) : 0}%)
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-secondary/40 p-3">
                  <div className="font-display text-2xl font-black text-foreground">
                    {activeReadersData.unreadStudents.length}
                  </div>
                  <div className="text-[11px] font-bold text-muted-foreground">
                    Ainda Não Abriram
                  </div>
                </div>
              </div>

              {/* SELETOR DE ABA DENTRO DO MODAL */}
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => setReadersTab("read")}
                  className={`rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    readersTab === "read"
                      ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🟢 Já Abriram ({activeReadersData.readStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReadersTab("unread")}
                  className={`rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    readersTab === "unread"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ⚪ Não Abriram ({activeReadersData.unreadStudents.length})
                </button>
              </div>

              {/* LISTA ROLÁVEL DE ALUNOS */}
              <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-2xl border bg-background/50 p-2 text-xs">
                {readersTab === "read" ? (
                  activeReadersData.readStudents.length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground">
                      Nenhum aluno abriu esta mensagem ainda.
                    </div>
                  ) : (
                    activeReadersData.readStudents.map(({ student, readAt }) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5"
                      >
                        <div>
                          <div className="font-display font-bold text-foreground">
                            {student.nick}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {student.school || "Sem escola"}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>
                            {readAt
                              ? new Date(readAt).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Lida"}
                          </span>
                        </div>
                      </div>
                    ))
                  )
                ) : activeReadersData.unreadStudents.length === 0 ? (
                  <div className="py-6 text-center text-emerald-600 font-bold">
                    🎉 Todos os alunos destinatários já abriram esta mensagem!
                  </div>
                ) : (
                  activeReadersData.unreadStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between gap-2 rounded-xl border bg-card/60 p-2.5"
                    >
                      <div>
                        <div className="font-display font-bold text-foreground">
                          {student.nick}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {student.school || "Sem escola"}
                        </div>
                      </div>

                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock3 className="h-3 w-3" /> Pendente
                      </span>
                    </div>
                  ))
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => setReadersModalMsg(null)}
                className="w-full rounded-xl text-xs font-bold"
              >
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
