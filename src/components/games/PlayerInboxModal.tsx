import { useState, useMemo, useEffect } from "react";
import {
  Mail,
  Gift,
  CheckCircle2,
  Trash2,
  Sparkles,
  Clock,
  ArrowLeft,
  Check,
  AlertTriangle,
  HelpCircle,
  Eye,
  Award,
  Coins,
  ShieldAlert,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getInboxMessagesForPlayer,
  markInboxMessageAsRead,
  markAllInboxMessagesAsReadForRecipient,
  claimInboxReward,
  deleteInboxMessageForPlayer,
  type SystemInboxMessage,
  type InboxReward,
} from "@/lib/inbox-messages";
import { getAllAvailableMedals, RARITY_INFO } from "@/lib/medals-catalog";
import { usePlayerAuth } from "@/lib/player-auth";
import { MedalIcon } from "./MedalIcon";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlayerInboxModal({ open, onOpenChange }: Props) {
  const auth = usePlayerAuth();
  const profile = auth.profile;

  const [messages, setMessages] = useState<SystemInboxMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "unread" | "rewards">("all");

  // Estados da Revelação de Recompensa Secreta
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealProgress, setRevealProgress] = useState(0);
  const [revealedRewardModal, setRevealedRewardModal] = useState<InboxReward | null>(null);

  // Mensagem selecionada ativa
  const activeMessage = useMemo(() => {
    if (!selectedMessageId) return null;
    return messages.find((m) => m.id === selectedMessageId) || null;
  }, [selectedMessageId, messages]);

  const refreshMessages = () => {
    if (profile) {
      const list = getInboxMessagesForPlayer(profile);
      setMessages(list);
    } else {
      setMessages([]);
    }
  };

  useEffect(() => {
    if (open && profile) {
      refreshMessages();
      // Escuta novos eventos de correio em tempo real
      const handleNew = () => refreshMessages();
      window.addEventListener("desafios:inbox-message-received", handleNew);
      return () => {
        window.removeEventListener("desafios:inbox-message-received", handleNew);
      };
    }
  }, [open, profile]);

  // Filtro ativo
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (filterTab === "unread") return !m.read;
      if (filterTab === "rewards") return Boolean(m.reward && !m.reward.claimed);
      return true;
    });
  }, [messages, filterTab]);

  const unreadCount = messages.filter((m) => !m.read).length;
  const unclaimedRewardsCount = messages.filter((m) => m.reward && !m.reward.claimed).length;

  const handleSelectMessage = (msg: SystemInboxMessage) => {
    setSelectedMessageId(msg.id);
    if (!msg.read && profile) {
      markInboxMessageAsRead(msg.id, profile);
      refreshMessages();
    }
  };

  const handleMarkAllRead = () => {
    if (profile) {
      markAllInboxMessagesAsReadForRecipient(profile.id, profile);
      refreshMessages();
    }
  };

  const handleDeleteMessage = (msgId: string) => {
    if (!profile) return;
    const res = deleteInboxMessageForPlayer(msgId, profile);
    if (res.success) {
      if (selectedMessageId === msgId) {
        setSelectedMessageId(null);
      }
      refreshMessages();
    } else {
      alert(res.error || "Não foi possível apagar a mensagem.");
    }
  };

  // Fluxo de Recompensa Secreta
  const handleStartSecretReveal = (reward: InboxReward) => {
    setIsRevealing(true);
    setRevealProgress(0);

    const interval = setInterval(() => {
      setRevealProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsRevealing(false);
            setRevealedRewardModal(reward);
          }, 300);
          return 100;
        }
        return prev + 10;
      });
    }, 120);
  };

  // Confirmar Resgate
  const handleClaimReward = async (msgId: string) => {
    if (!profile) return;
    const res = claimInboxReward(msgId, profile);
    if (res.success) {
      setRevealedRewardModal(null);
      await auth.refresh();
      refreshMessages();
    } else {
      alert(res.error || "Erro ao resgatar recompensa.");
    }
  };

  // Renderiza corpo da mensagem substituindo tags como [gif1], [gif2]
  const renderMessageBody = (body: string, gifLinks?: Record<string, string>) => {
    if (!gifLinks || Object.keys(gifLinks).length === 0) {
      return (
        <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed space-y-2">
          {body}
        </div>
      );
    }

    // Divide texto pelas tags [gif1], [gif2], etc.
    const parts = body.split(/(\[gif\d+\])/gi);

    return (
      <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed space-y-3">
        {parts.map((part, index) => {
          const match = /^\[(gif\d+)\]$/i.exec(part.trim());
          if (match) {
            const tagKey = match[1].toLowerCase();
            const url = gifLinks[tagKey];
            if (url) {
              return (
                <div
                  key={index}
                  className="my-3 overflow-hidden rounded-2xl border-2 border-primary/30 bg-muted/40 shadow-md flex flex-col items-center p-2"
                >
                  <img
                    src={url}
                    alt={`Animação ${tagKey}`}
                    className="max-h-72 w-auto object-contain rounded-xl shadow-xs"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 font-mono uppercase">
                    Mídia Anexa ({tagKey})
                  </span>
                </div>
              );
            }
          }
          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };

  const allCatalogMedals = getAllAvailableMedals();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] md:w-[90vw] max-w-4xl h-[88vh] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-3xl border bg-background shadow-2xl">
          {/* Header da Caixa de Entrada */}
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-display text-xl font-black text-foreground flex items-center gap-2">
                  <span>Caixa de Entrada & Correio</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-black text-primary-foreground animate-pulse">
                      {unreadCount} nova{unreadCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {unclaimedRewardsCount > 0 && (
                    <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-xs font-black text-amber-600 dark:text-amber-400">
                      🎁 {unclaimedRewardsCount} presente{unclaimedRewardsCount === 1 ? "" : "s"}
                    </span>
                  )}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Comunicados oficiais da SEMED, avisos pedagógicos e recompensas exclusivas
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                className="hidden sm:flex text-xs rounded-xl"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Marcar lidas
              </Button>
            )}
          </DialogHeader>

          {/* Corpo: Lista de Mensagens ou Visualizador de Mensagem */}
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Barra lateral de filtros e lista (oculta no mobile quando lendo mensagem) */}
            <div
              className={`w-full md:w-80 border-r flex flex-col shrink-0 bg-secondary/15 ${
                activeMessage ? "hidden md:flex" : "flex"
              }`}
            >
              {/* Filtros em Abas */}
              <div className="p-3 border-b grid grid-cols-3 gap-1 bg-background">
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterTab === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Todas ({messages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("unread")}
                  className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterTab === "unread"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Novas ({unreadCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("rewards")}
                  className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterTab === "rewards"
                      ? "bg-amber-500 text-zinc-950 font-black shadow-xs"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  Presentes ({unclaimedRewardsCount})
                </button>
              </div>

              {/* Lista com Rolagem */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {filteredMessages.length === 0 ? (
                  <div className="py-16 text-center space-y-2 px-4">
                    <Mail className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="font-display text-sm font-bold text-foreground">
                      Nenhuma mensagem por aqui
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Quando a coordenação enviar comunicados ou prêmios, eles aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  filteredMessages.map((msg) => {
                    const isSelected = selectedMessageId === msg.id;
                    const hasUnclaimedReward = msg.reward && !msg.reward.claimed;

                    return (
                      <div
                        key={msg.id}
                        onClick={() => handleSelectMessage(msg)}
                        className={`rounded-2xl border p-3.5 cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/30"
                            : !msg.read
                              ? "border-primary/40 bg-card hover:border-primary shadow-xs"
                              : "border-border/60 bg-card/60 opacity-80 hover:opacity-100 hover:bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {!msg.read && (
                                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                              )}
                              <h4
                                className={`truncate font-display text-xs ${
                                  !msg.read ? "font-black text-foreground" : "font-bold text-foreground/80"
                                }`}
                              >
                                {msg.title}
                              </h4>
                            </div>
                            <p className="line-clamp-2 text-[11px] text-muted-foreground mt-1">
                              {msg.body.replace(/\[gif\d+\]/gi, " [GIF] ")}
                            </p>
                          </div>

                          {hasUnclaimedReward && (
                            <span
                              className="shrink-0 grid h-7 w-7 place-items-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-bounce"
                              title="Contém presente para resgatar!"
                            >
                              🎁
                            </span>
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2">
                          <span className="font-semibold">{msg.senderName}</span>
                          <span>
                            {new Date(msg.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Painel de Visualização da Mensagem Selecionada */}
            <div className="flex-1 flex flex-col overflow-y-auto bg-background p-4 sm:p-6">
              {activeMessage ? (
                <div className="space-y-4 max-w-2xl mx-auto w-full">
                  {/* Botão de Voltar no Mobile */}
                  <div className="flex items-center justify-between md:hidden pb-2 border-b">
                    <button
                      type="button"
                      onClick={() => setSelectedMessageId(null)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                    >
                      <ArrowLeft className="h-4 w-4" /> Voltar para a lista
                    </button>
                  </div>

                  {/* Cabeçalho da Mensagem */}
                  <div className="rounded-3xl border bg-secondary/30 p-4 sm:p-5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs font-extrabold text-primary">
                        {activeMessage.senderName}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(activeMessage.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <h2 className="font-display text-xl sm:text-2xl font-black text-foreground">
                      {activeMessage.title}
                    </h2>
                  </div>

                  {/* Corpo do Texto e GIFs */}
                  <div className="rounded-3xl border bg-card p-5 sm:p-6 shadow-xs">
                    {renderMessageBody(activeMessage.body, activeMessage.gifLinks)}
                  </div>

                  {/* Seção de Recompensa Anexa (se houver) */}
                  {activeMessage.reward && (
                    <div className="rounded-3xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent p-5 space-y-4 shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/20 text-xl">
                            🎁
                          </span>
                          <div>
                            <h3 className="font-display text-sm sm:text-base font-black text-foreground">
                              {activeMessage.reward.claimed
                                ? "Recompensa Resgatada"
                                : activeMessage.reward.isSecret
                                  ? "Presente Misterioso do ADM"
                                  : "Recompensa Especial Anexa"}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {activeMessage.reward.claimed
                                ? `Resgatada com sucesso!`
                                : activeMessage.reward.isSecret
                                  ? "Descubra qual surpresa foi enviada para você"
                                  : "Disponível para coletar na sua conta"}
                            </p>
                          </div>
                        </div>

                        {activeMessage.reward.claimed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" /> Resgatado
                          </span>
                        )}
                      </div>

                      {/* Estado: Já Resgatada */}
                      {activeMessage.reward.claimed ? (
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>
                            Você já resgatou esta recompensa em{" "}
                            <b>
                              {activeMessage.reward.claimedAt
                                ? new Date(activeMessage.reward.claimedAt).toLocaleString("pt-BR")
                                : "data recente"}
                            </b>
                            .
                          </span>
                        </div>
                      ) : activeMessage.reward.isSecret ? (
                        /* Estado: Recompensa Secreta Pendente */
                        <div className="rounded-2xl border border-dashed border-amber-500/50 bg-background/80 p-5 text-center space-y-3">
                          <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-amber-500/20 text-3xl animate-pulse">
                            ❓
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-display text-base font-black text-foreground">
                              Recompensa Secreta Oculta
                            </h4>
                            <p className="text-xs text-muted-foreground max-w-md mx-auto">
                              O administrador marcou esta recompensa como secreta. Clique abaixo para iniciar a revelação!
                            </p>
                          </div>

                          {isRevealing ? (
                            <div className="space-y-2 max-w-sm mx-auto pt-2">
                              <div className="flex justify-between text-xs font-bold text-amber-500">
                                <span>Revelando segredo...</span>
                                <span>{revealProgress}%</span>
                              </div>
                              <div className="h-3 w-full rounded-full bg-muted overflow-hidden border">
                                <div
                                  className="h-full bg-amber-500 transition-all duration-150"
                                  style={{ width: `${revealProgress}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="lg"
                              onClick={() => handleStartSecretReveal(activeMessage.reward!)}
                              className="rounded-2xl font-display font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 shadow-lg"
                            >
                              <Sparkles className="h-4 w-4 mr-2" /> Revelar Recompensa
                            </Button>
                          )}
                        </div>
                      ) : (
                        /* Estado: Recompensa Normal Visível */
                        <div className="rounded-2xl border bg-background/90 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {activeMessage.reward.type === "points" && (
                              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-2xl font-black">
                                🪙
                              </div>
                            )}
                            {activeMessage.reward.type === "medal" && (
                              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/20 text-2xl">
                                🏅
                              </div>
                            )}

                            <div>
                              <div className="font-display text-base font-black text-foreground">
                                {activeMessage.reward.type === "points" && (
                                  <span>+{activeMessage.reward.pointsAmount} Pontos Conquistados</span>
                                )}
                                {activeMessage.reward.type === "medal" && (() => {
                                  const def = allCatalogMedals.find(
                                    (m) => m.id === activeMessage.reward?.medalId
                                  );
                                  return (
                                    <span>
                                      Medalha: {def ? def.title : activeMessage.reward.medalId}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {activeMessage.reward.type === "points"
                                  ? "Pontos serão somados à sua carteira e Hall da Fama"
                                  : "Adicionada à sua galeria de troféus e medalhas"}
                              </div>
                            </div>
                          </div>

                          <Button
                            size="lg"
                            onClick={() => handleClaimReward(activeMessage.id)}
                            className="w-full sm:w-auto rounded-2xl font-display font-black bg-amber-500 text-zinc-950 hover:bg-amber-600 shadow-md"
                          >
                            <Gift className="h-4 w-4 mr-1.5" /> Resgatar Recompensa
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rodapé: Ação de Exclusão da Mensagem */}
                  <div className="pt-4 border-t flex items-center justify-between gap-2">
                    {activeMessage.reward && !activeMessage.reward.claimed ? (
                      <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>Resgate sua recompensa antes de apagar esta mensagem</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Mensagem lida e salva no seu histórico
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={Boolean(activeMessage.reward && !activeMessage.reward.claimed)}
                      onClick={() => handleDeleteMessage(activeMessage.id)}
                      className="text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" /> Apagar Mensagem
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-2">
                  <Mail className="h-12 w-12 stroke-1 text-muted-foreground/40" />
                  <p className="font-display font-bold text-foreground">
                    Selecione uma mensagem na lista ao lado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Abra para ler comunicados completos, visualizar mídias e resgatar presentes.
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Sobreposto de Comemoração ao Revelar Recompensa Secreta */}
      {revealedRewardModal && (
        <Dialog open={Boolean(revealedRewardModal)} onOpenChange={() => setRevealedRewardModal(null)}>
          <DialogContent className="max-w-md rounded-3xl border-2 border-amber-500/50 bg-card p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-amber-500/20 text-4xl shadow-inner border-2 border-amber-500/40 animate-bounce">
              🎉
            </div>

            <div className="space-y-1">
              <DialogTitle className="font-display text-2xl font-black text-foreground">
                Recompensa Revelada!
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                O segredo foi desbloqueado com sucesso! Veja o que você ganhou:
              </p>
            </div>

            <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/10 p-4 space-y-1">
              {revealedRewardModal.type === "points" && (
                <>
                  <div className="font-display text-2xl font-black text-amber-600 dark:text-amber-400">
                    🪙 +{revealedRewardModal.pointsAmount} Pontos
                  </div>
                  <div className="text-xs text-muted-foreground font-semibold">
                    Adicionados à sua carteira e ao Hall da Fama
                  </div>
                </>
              )}
              {revealedRewardModal.type === "medal" && (() => {
                const def = allCatalogMedals.find((m) => m.id === revealedRewardModal.medalId);
                const rarity = def ? RARITY_INFO[def.rarity] : RARITY_INFO.ouro;
                return (
                  <>
                    <div className="font-display text-xl font-black text-primary">
                      🏅 {def ? def.title : revealedRewardModal.medalId}
                    </div>
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">
                      Raridade: {rarity.label}
                    </div>
                    {def?.description && (
                      <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
                    )}
                  </>
                );
              })()}
            </div>

            <Button
              size="lg"
              onClick={() => activeMessage && handleClaimReward(activeMessage.id)}
              className="w-full h-12 rounded-2xl font-display font-black text-base bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-lg"
            >
              <Check className="h-5 w-5 mr-2" /> Confirmar e Receber Recompensa
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
