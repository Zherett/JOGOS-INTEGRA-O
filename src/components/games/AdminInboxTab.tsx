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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  sendAdminBroadcastMessage,
  loadAllInboxMessages,
  type SystemInboxMessage,
  type AdminBroadcastDraft,
} from "@/lib/inbox-messages";
import { getAllAvailableMedals, RARITY_INFO } from "@/lib/medals-catalog";
import { SCHOOLS, stageFromBirthdate } from "@/lib/player-profile";
import type { PlayerProfile } from "@/lib/playfab";
import { MedalIcon } from "./MedalIcon";

interface Props {
  registeredStudents: PlayerProfile[];
  onBroadcastSent?: (msg: string) => void;
}

const STAGES = [
  "Anos Iniciais (1º ao 3º ano)",
  "Anos Iniciais (4º e 5º ano)",
  "Anos Finais (6º e 7º ano)",
  "Anos Finais (8º e 9º ano)",
];

export function AdminInboxTab({ registeredStudents, onBroadcastSent }: Props) {
  // Modo de destinatários
  const [recipientMode, setRecipientMode] = useState<"all" | "school" | "stage" | "students">("all");
  const [selectedSchool, setSelectedSchool] = useState<string>("TODAS");
  const [selectedStage, setSelectedStage] = useState<string>("TODAS");
  const [studentSearch, setStudentSearch] = useState("");

  // Conjunto de IDs de alunos explicitamente selecionados
  // No modo "all", "school", "stage", este conjunto armazena os alunos ativos
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Dados da mensagem
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Tags de GIF: [{ tagKey: "gif1", url: "" }]
  const [gifList, setGifList] = useState<{ tagKey: string; url: string }[]>([]);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Configurações de Recompensa
  const [hasReward, setHasReward] = useState(false);
  const [rewardType, setRewardType] = useState<"points" | "medal" | "future_item">("points");
  const [rewardPoints, setRewardPoints] = useState<number>(100);
  const [selectedMedalId, setSelectedMedalId] = useState<string>("");
  const [isSecretReward, setIsSecretReward] = useState<boolean>(false);

  // Histórico de mensagens enviadas
  const [sentHistory, setSentHistory] = useState<SystemInboxMessage[]>([]);
  const [selectedHistoryMsg, setSelectedHistoryMsg] = useState<SystemInboxMessage | null>(null);

  // Carrega lista de medalhas disponíveis
  const availableMedals = useMemo(() => {
    return getAllAvailableMedals();
  }, []);

  // Define medalha padrão caso vazio
  useEffect(() => {
    if (!selectedMedalId && availableMedals.length > 0) {
      setSelectedMedalId(availableMedals[0].id);
    }
  }, [availableMedals, selectedMedalId]);

  // Carrega histórico de mensagens enviadas
  const refreshHistory = () => {
    const all = loadAllInboxMessages();
    // Filtra comunicados gerados pelo ADM
    const admMsgs = all.filter((m) => m.sender === "adm");
    setSentHistory(admMsgs.reverse());
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  // Alunos elegíveis de acordo com os filtros de escola e etapa
  const eligibleStudents = useMemo(() => {
    return registeredStudents.filter((student) => {
      // Ignora contas administrativas internas se necessário ou mantém todos
      if (recipientMode === "school" && selectedSchool !== "TODAS") {
        if (!student.school || student.school.toLowerCase().trim() !== selectedSchool.toLowerCase().trim()) {
          return false;
        }
      }
      if (recipientMode === "stage" && selectedStage !== "TODAS") {
        const studentStage = stageFromBirthdate(student.birthdate);
        if (studentStage !== selectedStage) {
          return false;
        }
      }
      return true;
    });
  }, [registeredStudents, recipientMode, selectedSchool, selectedStage]);

  // Alunos elegíveis filtrados pelo termo de pesquisa na UI
  const displayStudents = useMemo(() => {
    if (!studentSearch.trim()) return eligibleStudents;
    const q = studentSearch.toLowerCase().trim();
    return eligibleStudents.filter((s) => {
      return (
        s.nick.toLowerCase().includes(q) ||
        (s.fullName && s.fullName.toLowerCase().includes(q)) ||
        (s.school && s.school.toLowerCase().includes(q))
      );
    });
  }, [eligibleStudents, studentSearch]);

  // Inicializa a seleção quando muda o modo ou o filtro
  useEffect(() => {
    const allIds = new Set(eligibleStudents.map((s) => s.id));
    setSelectedStudentIds(allIds);
  }, [recipientMode, selectedSchool, selectedStage, eligibleStudents.length]);

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

  const handleSelectAll = () => {
    const next = new Set(eligibleStudents.map((s) => s.id));
    setSelectedStudentIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds(new Set());
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

  // Envio da Mensagem
  const handleSendMessage = () => {
    if (!title.trim()) {
      alert("Por favor, informe o título da mensagem.");
      return;
    }
    if (!body.trim()) {
      alert("Por favor, escreva o texto da mensagem.");
      return;
    }

    if (selectedStudentIds.size === 0) {
      alert("Nenhum aluno está selecionado para receber a mensagem. Marque pelo menos um aluno.");
      return;
    }

    // Calcula excluídos em caso de modo all/school/stage
    const allEligibleIds = eligibleStudents.map((s) => s.id);
    const excludedStudentIds = allEligibleIds.filter((id) => !selectedStudentIds.has(id));

    // Constrói mapa de gifLinks
    const gifLinks: Record<string, string> = {};
    for (const g of gifList) {
      if (g.url.trim()) {
        gifLinks[g.tagKey] = g.url.trim();
      }
    }

    const draft: AdminBroadcastDraft = {
      mode: recipientMode,
      targetSchool: recipientMode === "school" ? selectedSchool : undefined,
      targetStage: recipientMode === "stage" ? selectedStage : undefined,
      targetStudentIds: Array.from(selectedStudentIds),
      excludedStudentIds: excludedStudentIds,
      title: title.trim(),
      body: body.trim(),
      gifLinks: Object.keys(gifLinks).length > 0 ? gifLinks : undefined,
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
    refreshHistory();

    const recipientCount = selectedStudentIds.size;
    const msgFeedback = `✅ Mensagem "${sent.title}" transmitida com sucesso para ${recipientCount} aluno(s)!`;
    onBroadcastSent?.(msgFeedback);

    // Limpa campos do compositor
    setTitle("");
    setBody("");
    setGifList([]);
    setHasReward(false);
    setIsSecretReward(false);
  };

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
              Total na Plataforma: <b>{registeredStudents.length}</b> alunos
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
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${
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
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${
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
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${
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
                  className={`rounded-xl py-2 text-xs font-bold transition-all ${
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
                <Label className="text-xs font-bold text-foreground">Selecione a Escola</Label>
                <select
                  value={selectedSchool}
                  onChange={(e) => setSelectedSchool(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-xs font-bold"
                >
                  <option value="TODAS">Todas as Escolas</option>
                  {SCHOOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {recipientMode === "stage" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">Selecione a Etapa</Label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-xs font-bold"
                >
                  <option value="TODAS">Todas as Etapas</option>
                  {STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* BARRA DE PESQUISA E AÇÕES RÁPIDAS DE MARCAÇÃO */}
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
                  onClick={handleSelectAll}
                  className="flex items-center gap-1 font-bold text-primary hover:underline cursor-pointer"
                >
                  <CheckSquare className="h-3.5 w-3.5" /> Marcar Todos ({eligibleStudents.length})
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="flex items-center gap-1 font-bold text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5" /> Desmarcar Todos
                </button>
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
                  const stStage = stageFromBirthdate(student.birthdate);
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
                            {student.school || "Sem escola"} • {stStage ? stStage.replace("Anos ", "") : "Geral"}
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary shrink-0">
                        Nv. {student.level || 1}
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

            {/* GERENCIADOR DE GIFS / ANIMAÇÕES */}
            <div className="space-y-3 rounded-2xl border bg-secondary/30 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="font-display text-xs font-bold text-foreground">
                    Anexar Mídia / GIFs Animados
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddGifTag}
                  className="h-7 rounded-xl text-[11px] font-bold gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Adicionar GIF
                </Button>
              </div>

              {gifList.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nenhum GIF anexado. Clique no botão acima para adicionar uma tag de animação (ex: <code>[gif1]</code>) e colar a URL correspondente.
                </p>
              ) : (
                <div className="space-y-2">
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
                        placeholder="Cole o link direto do GIF (ex: https://media.tenor.com/.../badge.gif)"
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
                  <div className="text-[10px] text-muted-foreground">
                    💡 <b>Dica:</b> Clique no botão da tag para inseri-la automaticamente no corpo da mensagem. Quando o aluno abrir a mensagem, o GIF será renderizado exatamente naquele local!
                  </div>
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
              onClick={handleSendMessage}
              className="h-12 w-full rounded-2xl font-display text-sm font-extrabold gap-2 shadow-lg cursor-pointer"
            >
              <Send className="h-4 w-4" /> Transmitir Mensagem para {selectedStudentIds.size} Aluno(s)
            </Button>
          </div>

          {/* HISTÓRICO DE MENSAGENS TRANSMITIDAS */}
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
              <div className="max-h-60 overflow-y-auto space-y-2">
                {sentHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-xl border bg-secondary/30 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-foreground truncate">
                          {msg.title}
                        </span>
                        {msg.reward && (
                          <span className="rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.2 shrink-0">
                            🎁 Recompensa
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {new Date(msg.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        • Destinatários:{" "}
                        {msg.recipientId === "ALL"
                          ? msg.recipientFilter?.school
                            ? `Escola: ${msg.recipientFilter.school}`
                            : msg.recipientFilter?.stage
                              ? `Etapa: ${msg.recipientFilter.stage}`
                              : "Todos os Alunos"
                          : `Aluno: ${msg.recipientId}`}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      ID: {msg.id.substring(0, 10)}...
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
