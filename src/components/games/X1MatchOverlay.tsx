import { useCallback, useEffect, useRef, useState } from "react";
import {
  Swords,
  Trophy,
  Timer,
  Zap,
  Sparkles,
  Check,
  X,
  LogOut,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GAME_NAMES, loadLastMatch, saveLastMatch, updateBest } from "@/lib/game-storage";
import { usePlayerAuth } from "@/lib/player-auth";
import { generateClashQuestion, type ClashQuestion } from "@/lib/rpg-content";
import { playCorrect, playTone, playWrong } from "@/lib/sound";
import {
  closeX1Room,
  finishX1RoomByTimeout,
  getX1Room,
  subscribeX1Updates,
  submitX1RobotClashAnswer,
  syncX1WithPlayFabCloud,
  updateX1PlayerProgress,
  type X1Room,
} from "@/lib/x1-challenge";

interface Props {
  initialRoom: X1Room;
  onExitX1: () => void;
}

export function X1MatchOverlay({ initialRoom, onExitX1 }: Props) {
  const auth = usePlayerAuth();
  const myId = auth.profile?.id ?? initialRoom.host.playerId;

  const [room, setRoom] = useState<X1Room>(initialRoom);
  const [secondsLeft, setSecondsLeft] = useState(initialRoom.durationSec);
  const [question, setQuestion] = useState<ClashQuestion>(() => generateClashQuestion(2));
  const [stunned, setStunned] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const rewardSavedRef = useRef(false);
  const recentTextsRef = useRef<string[]>([]);
  const recentAnsRef = useRef<boolean[]>([]);

  const isHost = room.host.playerId === myId;
  const me = isHost ? room.host : (room.guest ?? room.host);
  const opponent = isHost ? room.guest : room.host;

  // Subscribe to real-time updates (BroadcastChannel, localStorage, PlayFab SharedGroup)
  useEffect(() => {
    const refresh = () => {
      const latest = getX1Room(initialRoom.code);
      if (latest) setRoom({ ...latest });
    };
    const unsub = subscribeX1Updates(refresh);
    const cloudInterval = window.setInterval(() => {
      void syncX1WithPlayFabCloud(initialRoom.code).then(refresh);
    }, 2000);

    return () => {
      unsub();
      window.clearInterval(cloudInterval);
    };
  }, [initialRoom.code]);

  // Countdown timer + Trainer Bot simulation (if opponent is a simulated bot)
  useEffect(() => {
    if (room.status !== "playing") return;

    const timer = window.setInterval(() => {
      const start = room.startedAt ?? room.createdAt;
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const rem = Math.max(0, room.durationSec - elapsed);
      setSecondsLeft(rem);

      if (rem <= 0) {
        const finishedRoom = finishX1RoomByTimeout(room.code);
        if (finishedRoom) setRoom({ ...finishedRoom });
        return;
      }

      // If playing against the Trainer Bot (`guest.isBot`), simulate periodic bot progress
      if (room.guest?.isBot && isHost) {
        if (room.gameId === "rpg") {
          // Bot answers every ~3.5 seconds with 72% accuracy
          if (elapsed > 0 && elapsed % 4 === 0) {
            const botCorrect = Math.random() < 0.72;
            const res = submitX1RobotClashAnswer({
              code: room.code,
              playerId: room.guest.playerId,
              isCorrect: botCorrect,
            });
            if (res.room) setRoom({ ...res.room });
          }
        } else if (elapsed > 0 && elapsed % 3 === 0) {
          // Score-race bot gains points steadily
          const gain = Math.random() < 0.75 ? 10 : 0;
          const updated = updateX1PlayerProgress({
            code: room.code,
            playerId: room.guest.playerId,
            score: room.guest.score + gain,
            correct: room.guest.correct + (gain > 0 ? 1 : 0),
            wrong: room.guest.wrong + (gain === 0 ? 1 : 0),
          });
          if (updated) setRoom({ ...updated });
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [room, isHost]);

  // For Score-Race games (non-RPG), poll `loadLastMatch(room.gameId)` so when the player finishes the underlying game, it syncs immediately to the X1 room!
  useEffect(() => {
    if (room.gameId === "rpg" || room.status !== "playing") return;
    const matchStart = room.startedAt ?? room.createdAt;

    const checkMatch = window.setInterval(() => {
      const last = loadLastMatch(room.gameId);
      if (last && last.at >= matchStart) {
        const updated = updateX1PlayerProgress({
          code: room.code,
          playerId: myId,
          score: last.score,
          correct: last.correct,
          wrong: last.wrong,
          finished: true,
        });
        if (updated) setRoom({ ...updated });
      }
    }, 800);

    return () => window.clearInterval(checkMatch);
  }, [room.gameId, room.status, room.code, room.startedAt, room.createdAt, myId]);

  // Save XP / victory reward once when the X1 match finishes
  useEffect(() => {
    if (room.status !== "finished" || rewardSavedRef.current) return;
    rewardSavedRef.current = true;

    const wonX1 = room.winnerId === myId;
    const finalScore = Math.max(me.score, wonX1 ? me.score + 40 : me.score);
    updateBest(room.gameId, finalScore, 2);
    saveLastMatch(room.gameId, {
      score: finalScore,
      level: 2,
      correct: Math.max(wonX1 ? 4 : 1, me.correct),
      wrong: me.wrong,
      mode: "x1_online",
    });
  }, [room.status, room.winnerId, room.gameId, myId, me.score, me.correct, me.wrong]);

  const handleRobotAnswer = useCallback(
    (chosen: boolean) => {
      if (room.status !== "playing" || stunned) return;
      const isCorrect = chosen === question.answer;
      recentAnsRef.current = [...recentAnsRef.current.slice(-8), question.answer];

      if (!isCorrect) {
        playWrong();
        setStunned(true);
        window.setTimeout(() => setStunned(false), 900);
      } else {
        playCorrect();
      }

      const res = submitX1RobotClashAnswer({
        code: room.code,
        playerId: myId,
        isCorrect,
      });

      if (res.isSuperHit) {
        playTone(980, 0.2, "sawtooth");
        setBanner("⚡ SUPER RAIO 100%! Você tirou 3 de vida do oponente de uma vez!");
        window.setTimeout(() => setBanner(null), 2200);
      }

      if (res.room) setRoom({ ...res.room });

      const nextQ = generateClashQuestion(
        2,
        recentTextsRef.current,
        recentAnsRef.current,
      );
      recentTextsRef.current = [...recentTextsRef.current.slice(-12), nextQ.text];
      setQuestion(nextQ);
    },
    [room.status, room.code, stunned, question, myId],
  );

  const redShare = Math.max(0, 100 - room.blueShare);
  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, "0");

  // 1. TELA DE RESULTADO DO X1 (QUANDO A PARTIDA TERMINA)
  if (room.status === "finished") {
    const iWon = room.winnerId === myId;
    const isDraw = room.winnerId === "draw";

    return (
      <div className="mx-auto max-w-2xl rounded-3xl border-2 bg-card p-6 sm:p-8 shadow-2xl space-y-6 animate-pop-in">
        <div className="text-center space-y-2">
          <div
            className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${
              iWon
                ? "bg-success/15 text-success"
                : isDraw
                  ? "bg-accent/15 text-accent"
                  : "bg-destructive/15 text-destructive"
            }`}
          >
            <Trophy className="h-9 w-9" />
          </div>
          <h2 className="font-display text-3xl font-extrabold">
            {iWon
              ? "🏆 Você Venceu o Desafio X1!"
              : isDraw
                ? "🤝 Empate Épico no X1!"
                : `💪 ${opponent?.nick ?? "Oponente"} venceu este duelo!`}
          </h2>
          <p className="text-sm text-muted-foreground">
            Sala <b>#{room.code}</b> • {GAME_NAMES[room.gameId]}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Card Anfitrião (Azul) */}
          <div
            className={`rounded-2xl border-2 p-4 text-center ${
              room.winnerId === room.host.playerId
                ? "border-sky-500 bg-sky-500/10"
                : "bg-secondary/40"
            }`}
          >
            <span className="text-[11px] font-extrabold uppercase text-sky-500">
              Lado Azul {isHost ? "(Você)" : ""}
            </span>
            <p className="mt-1 font-display text-lg font-extrabold truncate">{room.host.nick}</p>
            <p className="text-xs text-muted-foreground truncate">{room.host.school}</p>
            <p className="mt-3 font-display text-2xl font-extrabold text-sky-500">
              {room.host.score} pts
            </p>
            <p className="text-xs text-muted-foreground">
              {room.host.correct} acertos •{" "}
              {room.gameId === "rpg" ? `${room.host.hp} HP restante` : `${room.host.wrong} erros`}
            </p>
          </div>

          {/* Card Desafiante (Vermelho) */}
          <div
            className={`rounded-2xl border-2 p-4 text-center ${
              room.winnerId === room.guest?.playerId
                ? "border-red-500 bg-red-500/10"
                : "bg-secondary/40"
            }`}
          >
            <span className="text-[11px] font-extrabold uppercase text-red-500">
              Lado Vermelho {!isHost ? "(Você)" : ""}
            </span>
            <p className="mt-1 font-display text-lg font-extrabold truncate">
              {room.guest?.nick ?? "Oponente"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{room.guest?.school ?? ""}</p>
            <p className="mt-3 font-display text-2xl font-extrabold text-red-500">
              {room.guest?.score ?? 0} pts
            </p>
            <p className="text-xs text-muted-foreground">
              {room.guest?.correct ?? 0} acertos •{" "}
              {room.gameId === "rpg"
                ? `${room.guest?.hp ?? 0} HP restante`
                : `${room.guest?.wrong ?? 0} erros`}
            </p>
          </div>
        </div>

        <Button
          size="lg"
          onClick={() => {
            closeX1Room(room.code);
            onExitX1();
          }}
          className="h-14 w-full rounded-2xl font-display text-base font-extrabold"
        >
          Voltar para a Plataforma
        </Button>
      </div>
    );
  }

  // 2. MODO CABO DE GUERRA 1V1 NA BATALHA DE ROBÔS (`gameId === "rpg"`)
  if (room.gameId === "rpg") {
    return (
      <div className="rounded-3xl border-2 bg-card p-4 sm:p-6 shadow-xl space-y-5">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-secondary/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-sky-500/15 px-3 py-1 font-display text-xs font-extrabold text-sky-500">
              🔵 {room.host.nick} ({room.host.hp} HP)
            </span>
            <span className="font-display text-xs font-extrabold text-muted-foreground">VS</span>
            <span className="rounded-xl bg-red-500/15 px-3 py-1 font-display text-xs font-extrabold text-red-500">
              🔴 {room.guest?.nick ?? "Oponente"} ({room.guest?.hp ?? 10} HP)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 font-mono text-xs font-extrabold border">
              <Timer className="h-3.5 w-3.5 text-accent" /> {mins}:{secs}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onExitX1}
              className="h-8 rounded-xl text-xs"
            >
              <LogOut className="mr-1 h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </div>

        {banner && (
          <div className="animate-pop-in rounded-2xl bg-accent/15 px-4 py-2 text-center font-display text-xs sm:text-sm font-extrabold">
            {banner}
          </div>
        )}

        {/* Questão Acima da Barra */}
        <div className="rounded-3xl border-2 border-primary/30 bg-gradient-to-b from-secondary/60 to-card p-5 text-center space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-0.5 text-[11px] font-extrabold uppercase text-primary">
            <Swords className="h-3.5 w-3.5" /> Desafio X1 • Você é o Robô{" "}
            {isHost ? "AZUL (Esquerda)" : "VERMELHO (Direita)"}
          </span>
          <p className="font-display text-2xl sm:text-3xl font-extrabold">{question.text}</p>
        </div>

        {/* Barra de Cabo de Guerra com Faíscas */}
        <div className="rounded-3xl border-2 bg-slate-950 p-5 text-white space-y-3">
          <div className="flex items-center justify-between text-xs font-extrabold">
            <span className="text-sky-400 flex items-center gap-1">
              <Zap className="h-4 w-4" /> {room.host.nick}: {room.host.hp}/{room.host.maxHp} Vida (
              {room.blueShare}%)
            </span>
            <span className="text-red-400 flex items-center gap-1">
              {room.guest?.nick}: {room.guest?.hp}/{room.guest?.maxHp} Vida ({redShare}%){" "}
              <Flame className="h-4 w-4" />
            </span>
          </div>

          <div className="relative h-12 w-full rounded-2xl border-2 border-white/20 bg-slate-900 overflow-visible">
            <div
              className="absolute inset-y-0 left-0 rounded-l-xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-300 shadow-[0_0_20px_rgba(56,189,248,0.8)] transition-all duration-150"
              style={{ width: `${room.blueShare}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 rounded-r-xl bg-gradient-to-l from-red-800 via-red-600 to-orange-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] transition-all duration-150"
              style={{ width: `${redShare}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${Math.max(4, Math.min(96, room.blueShare))}%` }}
            >
              <div className="relative flex items-center justify-center">
                <div className="h-14 w-5 rounded-full bg-white blur-[2px] animate-pulse shadow-[0_0_24px_#fff,0_0_40px_#facc15]" />
                <Sparkles className="absolute h-8 w-8 text-yellow-200 animate-bounce" />
              </div>
            </div>
          </div>
        </div>

        {/* Botões Verdadeiro / Falso Abaixo da Barra */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            type="button"
            size="lg"
            disabled={stunned}
            onClick={() => handleRobotAnswer(true)}
            className="h-16 sm:h-20 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-display text-xl sm:text-2xl font-extrabold shadow-lg"
          >
            <Check className="mr-2 h-7 w-7 stroke-[3]" /> VERDADEIRO
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={stunned}
            onClick={() => handleRobotAnswer(false)}
            className="h-16 sm:h-20 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-display text-xl sm:text-2xl font-extrabold shadow-lg"
          >
            <X className="mr-2 h-7 w-7 stroke-[3]" /> FALSO
          </Button>
        </div>
      </div>
    );
  }

  // 3. BARRA COMPACTA AO VIVO PARA OS DEMAIS 9 JOGOS (CORRIDA DE PONTOS X1)
  return (
    <div className="mb-4 rounded-3xl border-2 border-accent/50 bg-slate-950 p-3.5 text-white shadow-lg space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] text-amber-300">
            <Swords className="h-3.5 w-3.5" /> X1 AO VIVO • Sala #{room.code}
          </span>
          <span className="text-sky-400">
            🔵 {room.host.nick}: <b>{room.host.score} pts</b>
          </span>
          <span className="text-slate-400">vs</span>
          <span className="text-red-400">
            🔴 {room.guest?.nick ?? "Oponente"}: <b>{room.guest?.score ?? 0} pts</b>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-800 px-3 py-0.5 font-mono text-xs text-amber-300 border border-white/10">
            ⏱️ {mins}:{secs}
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              const finished = finishX1RoomByTimeout(room.code);
              if (finished) setRoom({ ...finished });
            }}
            className="h-7 rounded-xl px-2.5 text-[11px] font-bold"
          >
            Concluir Duelo
          </Button>
        </div>
      </div>

      {/* Mini barra de vantagem Azul vs Vermelho com faísca */}
      <div className="relative h-3 w-full rounded-full bg-slate-900 overflow-visible">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300"
          style={{ width: `${room.blueShare}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full bg-gradient-to-l from-red-700 to-orange-500 transition-all duration-300"
          style={{ width: `${redShare}%` }}
        />
        <Sparkles
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 text-yellow-300"
          style={{ left: `${room.blueShare}%` }}
        />
      </div>
    </div>
  );
}
