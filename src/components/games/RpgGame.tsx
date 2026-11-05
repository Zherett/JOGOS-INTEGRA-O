import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  X,
  Zap,
  Heart,
  ShieldAlert,
  Sparkles,
  Trophy,
  Flame,
  Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameTopBar } from "./GameTopBar";
import { Countdown } from "./Countdown";
import { ResultPanel } from "./ResultPanel";
import { saveLastMatch, updateBest } from "@/lib/game-storage";
import { playCorrect, playTone, playWrong } from "@/lib/sound";
import {
  applyClashTick,
  evaluateClashAnswer,
  generateClashQuestion,
  getRobotBoss,
  INITIAL_BLUE_SHARE,
  ROBOT_BOSSES,
  SUPER_HIT_DAMAGE,
  type ClashQuestion,
  type RobotShapeTheme,
} from "@/lib/rpg-content";

interface Props {
  onExit: () => void;
  onStatsChange?: () => void;
}

const MAX_PLAYER_LIVES = 3;

export function RpgGame({ onExit, onStatsChange }: Props) {
  const [phase, setPhase] = useState<"countdown" | "playing" | "victory" | "gameover">("countdown");
  const [stage, setStage] = useState(1);
  const boss = getRobotBoss(stage);

  const [enemyHp, setEnemyHp] = useState(boss.maxHp);
  const [playerLives, setPlayerLives] = useState(MAX_PLAYER_LIVES);
  const [blueShare, setBlueShare] = useState(INITIAL_BLUE_SHARE);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  const [question, setQuestion] = useState<ClashQuestion>(() => generateClashQuestion(1));
  const [stunnedUntil, setStunnedUntil] = useState(0);
  const [isStunned, setIsStunned] = useState(false);

  // Visual combat feedback states
  const [enemyHitKind, setEnemyHitKind] = useState<null | "normal" | "super">(null);
  const [playerHitFlash, setPlayerHitFlash] = useState(false);
  const [clashBanner, setClashBanner] = useState<string | null>(null);

  const recentTextsRef = useRef<string[]>([]);
  const recentAnsRef = useRef<boolean[]>([]);
  const blueShareRef = useRef(INITIAL_BLUE_SHARE);
  const stageRef = useRef(1);
  const livesRef = useRef(MAX_PLAYER_LIVES);
  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);

  blueShareRef.current = blueShare;
  stageRef.current = stage;
  livesRef.current = playerLives;
  scoreRef.current = score;
  correctRef.current = correctCount;
  wrongRef.current = wrongCount;

  const nextQuestion = useCallback((targetStage: number) => {
    const q = generateClashQuestion(
      targetStage,
      recentTextsRef.current,
      recentAnsRef.current,
    );
    recentTextsRef.current = [...recentTextsRef.current.slice(-12), q.text];
    setQuestion(q);
  }, []);

  const finishMatch = useCallback(
    (finalPhase: "victory" | "gameover", finalScore: number, reachedStage: number) => {
      const safeScore = Math.max(0, finalScore);
      updateBest("rpg", safeScore, reachedStage);
      saveLastMatch("rpg", {
        score: safeScore,
        level: reachedStage,
        correct: correctRef.current,
        wrong: wrongRef.current,
        mode: "padrao",
      });
      onStatsChange?.();
      setPhase(finalPhase);
    },
    [onStatsChange],
  );

  const startBattle = () => {
    const firstBoss = getRobotBoss(1);
    recentTextsRef.current = [];
    recentAnsRef.current = [];
    setStage(1);
    setEnemyHp(firstBoss.maxHp);
    setPlayerLives(MAX_PLAYER_LIVES);
    setBlueShare(INITIAL_BLUE_SHARE);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setCorrectCount(0);
    setWrongCount(0);
    setStunnedUntil(0);
    setIsStunned(false);
    setClashBanner(null);
    nextQuestion(1);
    setPhase("playing");
  };

  // Continuous time loop: red side pushes from the middle toward the left
  useEffect(() => {
    if (phase !== "playing") return;

    let lastTime = performance.now();
    let frameId = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      setIsStunned(now < stunnedUntil);

      const currentBoss = getRobotBoss(stageRef.current);
      const tickRes = applyClashTick(blueShareRef.current, dt, currentBoss);

      if (tickRes.redOvertookAll) {
        // Red bar reached 100% on the left! Player robot suffers an overload shock
        playWrong();
        setPlayerHitFlash(true);
        window.setTimeout(() => setPlayerHitFlash(false), 550);

        const nextLives = livesRef.current - 1;
        setPlayerLives(nextLives);
        setStreak(0);

        if (nextLives <= 0) {
          setBlueShare(0);
          finishMatch("gameover", scoreRef.current, stageRef.current);
          return;
        }

        setClashBanner("⚠️ SOBRECARGA VERMELHA! Você perdeu 1 escudo!");
        window.setTimeout(() => setClashBanner(null), 1800);
        setBlueShare(INITIAL_BLUE_SHARE);
        blueShareRef.current = INITIAL_BLUE_SHARE;
      } else {
        setBlueShare(tickRes.blueShare);
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [phase, stunnedUntil, finishMatch]);

  const handleAnswer = useCallback(
    (chosen: boolean) => {
      if (phase !== "playing") return;
      if (performance.now() < stunnedUntil) return;

      const currentBoss = getRobotBoss(stage);
      const outcome = evaluateClashAnswer({
        question,
        chosenAnswer: chosen,
        currentBlueShare: blueShare,
        currentEnemyHp: enemyHp,
        boss: currentBoss,
      });

      recentAnsRef.current = [...recentAnsRef.current.slice(-8), question.answer];

      if (!outcome.isCorrect) {
        playWrong();
        setWrongCount((w) => w + 1);
        setStreak(0);
        setScore((s) => Math.max(0, s + outcome.scoreDelta));
        setPlayerHitFlash(true);
        window.setTimeout(() => setPlayerHitFlash(false), 450);

        // Stun for 0.9s to prevent button mashing
        const until = performance.now() + 900;
        setStunnedUntil(until);
        setIsStunned(true);

        if (outcome.redOvertookAll) {
          const nextLives = playerLives - 1;
          setPlayerLives(nextLives);
          if (nextLives <= 0) {
            setBlueShare(0);
            finishMatch("gameover", Math.max(0, score + outcome.scoreDelta), stage);
            return;
          }
          setClashBanner("⚠️ ERRO CRÍTICO! O raio vermelho atingiu seu robô (-1 escudo)!");
          window.setTimeout(() => setClashBanner(null), 1800);
          setBlueShare(INITIAL_BLUE_SHARE);
        } else {
          setBlueShare(outcome.nextBlueShare);
        }

        nextQuestion(stage);
        return;
      }

      // Correct answer!
      if (outcome.isSuperHit) {
        playTone(880, 0.12, "triangle");
        window.setTimeout(() => playTone(1175, 0.22, "sawtooth"), 90);
        setEnemyHitKind("super");
        setClashBanner(
          `⚡ SUPER RAIO AZUL (100%)! Golpe Triplo causou -${SUPER_HIT_DAMAGE} de vida no inimigo!`,
        );
      } else {
        playCorrect();
        setEnemyHitKind("normal");
        setClashBanner(null);
      }

      window.setTimeout(() => setEnemyHitKind(null), 500);
      if (outcome.isSuperHit) {
        window.setTimeout(() => setClashBanner(null), 2200);
      }

      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
      setCorrectCount((c) => c + 1);

      const comboBonus = Math.min(15, Math.floor(nextStreak / 3) * 5);
      const nextScore = Math.max(0, score + outcome.scoreDelta + comboBonus);

      if (outcome.enemyDefeated) {
        const stageClearScore = nextScore + currentBoss.rewardPoints;
        setScore(stageClearScore);

        if (stage >= ROBOT_BOSSES.length) {
          // Defeated all 5 geometric robot bosses!
          setEnemyHp(0);
          setBlueShare(100);
          finishMatch("victory", stageClearScore, stage);
          return;
        }

        // Advance to next geometric robot boss!
        const nextStage = stage + 1;
        const nextBoss = getRobotBoss(nextStage);
        setStage(nextStage);
        setEnemyHp(nextBoss.maxHp);
        setBlueShare(INITIAL_BLUE_SHARE);
        setClashBanner(
          `🏆 ${currentBoss.name} derrotado! (+${currentBoss.rewardPoints} pts) • Prepare-se para a Fase ${nextStage}!`,
        );
        window.setTimeout(() => setClashBanner(null), 2500);
        nextQuestion(nextStage);
        return;
      }

      setScore(nextScore);
      setEnemyHp(outcome.nextEnemyHp);
      setBlueShare(outcome.nextBlueShare);
      nextQuestion(stage);
    },
    [
      phase,
      stunnedUntil,
      stage,
      question,
      blueShare,
      enemyHp,
      playerLives,
      score,
      streak,
      finishMatch,
      nextQuestion,
    ],
  );

  // Keyboard shortcuts: V / ArrowLeft = Verdadeiro, F / ArrowRight = Falso
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "v" || e.key === "ArrowLeft") {
        e.preventDefault();
        handleAnswer(true);
      } else if (k === "f" || e.key === "ArrowRight") {
        e.preventDefault();
        handleAnswer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, handleAnswer]);

  const redShare = Math.max(0, 100 - blueShare);

  return (
    <div className="space-y-5">
      <GameTopBar title="Batalha de Robôs" onExit={onExit} />

      {/* CONTAGEM REGRESSIVA 3, 2, 1 */}
      {phase === "countdown" && (
        <div className="space-y-4">
          <Countdown onDone={startBattle} />
        </div>
      )}

      {/* ARENA DE BATALHA */}
      {phase === "playing" && (
        <div className="rounded-3xl border bg-card p-4 sm:p-6 shadow-xl space-y-5">
          {/* HUD Superior: Escudos do Jogador, Fase Atual e Vida do Robô Inimigo */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-secondary/40 px-4 py-3">
            {/* Player Shields */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Seus Escudos:
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: MAX_PLAYER_LIVES }).map((_, idx) => (
                  <Heart
                    key={idx}
                    className={`h-5 w-5 transition-all ${
                      idx < playerLives
                        ? "fill-sky-500 text-sky-500 scale-100"
                        : "text-muted-foreground/30 scale-90"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Stage Indicator & Score */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-card px-3.5 py-1 text-xs font-extrabold border shadow-sm">
                Fase {stage}/{ROBOT_BOSSES.length} •{" "}
                <span className="text-destructive">{boss.name}</span>
              </div>
              <div className="rounded-full bg-primary/15 px-3 py-1 text-xs font-extrabold text-primary flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" /> {score} pts
              </div>
              {streak >= 2 && (
                <div className="rounded-full bg-accent/15 px-3 py-1 text-xs font-extrabold text-accent">
                  🔥 Sequência {streak}x
                </div>
              )}
            </div>

            {/* Enemy HP Bar */}
            <div className="flex items-center gap-2.5 min-w-[180px]">
              <span className="text-xs font-extrabold uppercase tracking-wider text-red-600 dark:text-red-400">
                Vida Inimiga:
              </span>
              <div className="flex-1 h-4 rounded-full bg-red-950/30 border border-red-500/40 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-600 transition-all duration-300"
                  style={{ width: `${Math.max(0, (enemyHp / boss.maxHp) * 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs font-extrabold text-red-600 dark:text-red-400">
                {enemyHp}/{boss.maxHp}
              </span>
            </div>
          </div>

          {/* Banner de Evento (Super Raio / Chefe Derrotado / Alerta) */}
          {clashBanner && (
            <div className="animate-pop-in rounded-2xl border border-accent/40 bg-accent/15 px-4 py-2 text-center font-display text-xs sm:text-sm font-extrabold text-foreground">
              {clashBanner}
            </div>
          )}

          {/* QUESTÃO ACIMA DA BARRA DE DISPUTA */}
          <div className="rounded-3xl border-2 border-primary/30 bg-gradient-to-b from-secondary/60 to-card p-5 text-center shadow-md space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> {question.categoryLabel} • Questão para Golpear
            </div>
            <p className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {question.text}
            </p>
          </div>

          {/* CENTRO: ROBÔ COLORIDO (ESQUERDA) + BARRA DE PODER COM FAÍSCAS + ROBÔ VERMELHO (DIREITA) */}
          <div className="relative rounded-3xl border-2 bg-slate-950 px-3 py-6 sm:px-6 sm:py-8 text-white shadow-inner overflow-hidden">
            {/* Ambient background glow */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-sky-500/15 blur-2xl transition-all duration-150"
              style={{ width: `${blueShare}%` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 bg-red-600/20 blur-2xl transition-all duration-150"
              style={{ width: `${redShare}%` }}
            />

            <div className="relative z-10 flex items-center justify-between gap-2 sm:gap-4">
              {/* LADO ESQUERDO: ROBÔ COLORIDO DE FORMAS GEOMÉTRICAS (JOGADOR) */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`transition-transform duration-200 ${
                    playerHitFlash
                      ? "-translate-x-2 scale-95 brightness-150"
                      : enemyHitKind
                        ? "translate-x-1.5 scale-105"
                        : ""
                  }`}
                >
                  <PlayerGeoRobot hit={playerHitFlash} superCharging={blueShare >= 75} />
                </div>
                <span className="mt-1.5 font-display text-[11px] sm:text-xs font-extrabold text-sky-400">
                  ROBÔ PRISMA
                </span>
                <span className="font-mono text-[10px] font-bold text-sky-300/80">
                  {Math.round(blueShare)}% AZUL
                </span>
              </div>

              {/* BARRA CENTRAL DE DISPUTA DE PODER COM FAÍSCAS */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider">
                  <span className="text-sky-400 flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" /> Poder Azul ({Math.round(blueShare)}%)
                  </span>
                  <span className="hidden sm:inline text-amber-300">
                    Encha 100% = Super Golpe (-{SUPER_HIT_DAMAGE} Vida)!
                  </span>
                  <span className="text-red-400 flex items-center gap-1">
                    Poder Vermelho ({Math.round(redShare)}%) <Flame className="h-3.5 w-3.5" />
                  </span>
                </div>

                {/* A Barra de Energia com Brilho Pulsante e Alternância de Cor */}
                <div className="relative h-11 sm:h-13 w-full rounded-2xl border-2 border-white/20 bg-slate-950 shadow-[0_0_30px_rgba(0,0,0,0.9)] overflow-visible">
                  {/* Lado Azul (Jogador - Esquerda) com alternância contínua de tons de azul e brilho neon */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-l-xl transition-[width] duration-75 overflow-hidden"
                    style={{
                      width: `${blueShare}%`,
                      boxShadow: "0 0 25px rgba(56,189,248,0.85), inset 0 0 15px rgba(255,255,255,0.4)",
                      background: "linear-gradient(90deg, #1e3a8a, #2563eb, #0284c7, #38bdf8, #67e8f9)",
                      backgroundSize: "200% 100%",
                      animation: "blueEnergyPulse 2.2s ease-in-out infinite alternate",
                    }}
                  />

                  {/* Lado Vermelho (Inimigo - Direita) com alternância contínua de tons de vermelho e brilho neon */}
                  <div
                    className="absolute inset-y-0 right-0 rounded-r-xl transition-[width] duration-75 overflow-hidden"
                    style={{
                      width: `${redShare}%`,
                      boxShadow: "0 0 25px rgba(239,68,68,0.85), inset 0 0 15px rgba(255,255,255,0.4)",
                      background: "linear-gradient(270deg, #7f1d1d, #b91c1c, #dc2626, #ef4444, #f97316)",
                      backgroundSize: "200% 100%",
                      animation: "redEnergyPulse 2.2s ease-in-out infinite alternate",
                    }}
                  />

                  {/* EFEITO DE CHOQUE CENTRAL COM FAÍSCAS GEOMÉTRICAS (SEM EMOJIS/ÍCONES) ESCONDENDO A LINHA DIVISÓRIA */}
                  <div
                    className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
                    style={{ left: `${Math.max(2, Math.min(98, blueShare))}%` }}
                  >
                    <div className="relative flex items-center justify-center">
                      {/* Barreira de Plasma Central (cobre verticalmente toda a linha divisória) */}
                      <div className="h-16 sm:h-20 w-5 rounded-full bg-white blur-[1.5px] shadow-[0_0_20px_#ffffff,0_0_35px_#38bdf8,0_0_35px_#ef4444] animate-pulse" />

                      {/* Faíscas Geométricas 1: Losangos, Triângulos e Formas Angulares Rotativas (Horário) */}
                      <svg
                        viewBox="0 0 100 100"
                        className="absolute h-24 w-24 overflow-visible animate-spin"
                        style={{ animationDuration: "1.2s" }}
                        aria-hidden="true"
                      >
                        {/* Losangos Brilhantes */}
                        <polygon points="50,6 56,22 50,38 44,22" fill="#ffffff" />
                        <polygon points="50,94 56,78 50,62 44,78" fill="#38bdf8" />
                        <polygon points="6,50 22,44 38,50 22,56" fill="#38bdf8" />
                        <polygon points="94,50 78,44 62,50 78,56" fill="#f87171" />
                        
                        {/* Triângulos e Diamantes Diagonais */}
                        <polygon points="18,18 36,24 24,36" fill="#fef08a" />
                        <polygon points="82,82 64,76 76,64" fill="#fb7185" />
                        <polygon points="82,18 76,36 64,24" fill="#facc15" />
                        <polygon points="18,82 24,64 36,76" fill="#67e8f9" />
                      </svg>

                      {/* Faíscas Geométricas 2: Quadrados Giratórios e Cristais Geométricos (Anti-horário) */}
                      <svg
                        viewBox="0 0 100 100"
                        className="absolute h-20 w-20 overflow-visible"
                        style={{
                          animation: "spinReverse 0.85s linear infinite",
                        }}
                        aria-hidden="true"
                      >
                        {/* Quadrados concêntricos rotacionados (formando estrelas de 8 e 12 pontas geométricas) */}
                        <rect x="42" y="42" width="16" height="16" fill="#ffffff" transform="rotate(45 50 50)" opacity="0.95" />
                        <rect x="44" y="44" width="12" height="12" fill="#fef08a" transform="rotate(22.5 50 50)" />
                        <polygon points="50,20 54,34 50,48 46,34" fill="#67e8f9" />
                        <polygon points="50,80 54,66 50,52 46,66" fill="#f87171" />
                        <polygon points="20,50 34,46 48,50 34,54" fill="#bae6fd" />
                        <polygon points="80,50 66,46 52,50 66,54" fill="#fca5a5" />
                      </svg>

                      {/* Flash central em Losango Branco/Dourado pulsante */}
                      <svg viewBox="0 0 40 40" className="absolute h-8 w-8 animate-ping" aria-hidden="true">
                        <polygon points="20,0 40,20 20,40 0,20" fill="#ffffff" opacity="0.75" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Injeção inline de keyframes para alternância vibrante de cor das barras */}
                <style>{`
                  @keyframes blueEnergyPulse {
                    0% { background-position: 0% 50%; filter: brightness(1) saturate(1.1); }
                    50% { background-position: 100% 50%; filter: brightness(1.25) saturate(1.4); }
                    100% { background-position: 0% 50%; filter: brightness(1.05) saturate(1.2); }
                  }
                  @keyframes redEnergyPulse {
                    0% { background-position: 0% 50%; filter: brightness(1) saturate(1.1); }
                    50% { background-position: 100% 50%; filter: brightness(1.25) saturate(1.4); }
                    100% { background-position: 0% 50%; filter: brightness(1.05) saturate(1.2); }
                  }
                  @keyframes spinReverse {
                    from { transform: rotate(360deg); }
                    to { transform: rotate(0deg); }
                  }
                  @keyframes robotIdleFloatBlue {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-4px) rotate(0.8deg); }
                  }
                  @keyframes robotIdleFloatRed {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-3.5px) rotate(-1deg); }
                  }
                  @keyframes prismEyeBlink {
                    0%, 82%, 90%, 100% { transform: scaleY(1); opacity: 1; }
                    86% { transform: scaleY(0.08); opacity: 0.2; }
                  }
                  @keyframes prismCoreGlow {
                    0%, 100% { filter: drop-shadow(0 0 3px #10b981) brightness(1); }
                    50% { filter: drop-shadow(0 0 10px #34d399) drop-shadow(0 0 16px #facc15) brightness(1.35); }
                  }
                  @keyframes prismAntennaGlow {
                    0%, 100% { filter: drop-shadow(0 0 2px #38bdf8) brightness(1); }
                    50% { filter: drop-shadow(0 0 8px #67e8f9) drop-shadow(0 0 14px #ffffff) brightness(1.4); }
                  }
                  @keyframes prismShoulderGlow {
                    0%, 100% { filter: brightness(1); }
                    50% { filter: drop-shadow(0 0 6px #f43f5e) brightness(1.3); }
                  }
                  @keyframes redEyeBlinkAngry {
                    0%, 78%, 88%, 100% { transform: scaleY(1); opacity: 1; }
                    83% { transform: scaleY(0.1); opacity: 0.25; }
                  }
                  @keyframes angryMouthGrimace {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.08) translateY(-0.5px); }
                  }
                  @keyframes angryHornsTremble {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-1.5deg); }
                    75% { transform: rotate(1.5deg); }
                  }
                  @keyframes redCorePulseAngry {
                    0%, 100% { filter: drop-shadow(0 0 4px #ef4444) brightness(1); }
                    50% { filter: drop-shadow(0 0 14px #dc2626) drop-shadow(0 0 22px #f97316) brightness(1.4); }
                  }
                `}</style>

                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>← Se chegar a 0% você perde 1 escudo</span>
                  <span>100% Azul = Golpe Triplo (-{SUPER_HIT_DAMAGE} HP) →</span>
                </div>
              </div>

              {/* LADO DIREITO: ROBÔ INIMIGO VERMELHO DE FORMAS GEOMÉTRICAS */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`relative transition-transform duration-200 ${
                    enemyHitKind === "super"
                      ? "translate-x-3 scale-90 brightness-150"
                      : enemyHitKind === "normal"
                        ? "translate-x-2 scale-95 brightness-125"
                        : ""
                  }`}
                >
                  <EnemyGeoRobot theme={boss.shapeTheme} hit={enemyHitKind} />
                  {enemyHitKind && (
                    <span
                      className={`animate-pop-in absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 font-display text-xs font-extrabold shadow-lg ${
                        enemyHitKind === "super"
                          ? "bg-yellow-400 text-slate-950"
                          : "bg-sky-400 text-slate-950"
                      }`}
                    >
                      {enemyHitKind === "super" ? `💥 -${SUPER_HIT_DAMAGE} VIDA!` : "⚡ -1 VIDA!"}
                    </span>
                  )}
                </div>
                <span className="mt-1.5 font-display text-[11px] sm:text-xs font-extrabold text-red-400">
                  {boss.name.toUpperCase()}
                </span>
                <span className="font-mono text-[10px] font-bold text-red-300/80">
                  {enemyHp} {enemyHp === 1 ? "GOLPE RESTANTE" : "GOLPES RESTANTES"}
                </span>
              </div>
            </div>
          </div>

          {/* ALTERNATIVAS ABAIXO DA BARRA (VERDADEIRO OU FALSO) */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <Button
                type="button"
                size="lg"
                disabled={isStunned}
                onClick={() => handleAnswer(true)}
                className="h-16 sm:h-20 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-display text-xl sm:text-2xl font-extrabold shadow-lg active:scale-95 transition-all"
              >
                <Check className="mr-2 h-7 w-7 stroke-[3]" />
                VERDADEIRO
              </Button>

              <Button
                type="button"
                size="lg"
                disabled={isStunned}
                onClick={() => handleAnswer(false)}
                className="h-16 sm:h-20 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-display text-xl sm:text-2xl font-extrabold shadow-lg active:scale-95 transition-all"
              >
                <X className="mr-2 h-7 w-7 stroke-[3]" />
                FALSO
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {isStunned ? (
                <span className="font-bold text-destructive">
                  ⚡ Curto-circuito por resposta errada! Aguarde um instante...
                </span>
              ) : (
                <>
                  Atalhos do teclado: <b>V</b> (ou Seta ←) para Verdadeiro • <b>F</b> (ou Seta →)
                  para Falso
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* TELA DE VITÓRIA OU FIM DE JOGO */}
      {(phase === "victory" || phase === "gameover") && (
        <div className="space-y-4">
          <div
            className={`rounded-3xl border p-5 text-center ${
              phase === "victory"
                ? "border-success/40 bg-success/10 text-foreground"
                : "border-destructive/40 bg-destructive/10 text-foreground"
            }`}
          >
            <h3 className="font-display text-xl sm:text-2xl font-extrabold">
              {phase === "victory"
                ? "🎉 Vitória Total! Todos os 5 Robôs Vermelhos Derrotados!"
                : "💥 Sobrecarga! O Raio Vermelho Venceu Desta Vez"}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              {phase === "victory"
                ? `Seu Robô Prisma dominou a disputa de poder do início ao fim! (Melhor sequência: ${bestStreak}x)`
                : `Você chegou até a Fase ${stage} (${boss.name}). Tente novamente para derrotar todos os 5 chefes!`}
            </p>
          </div>
          <ResultPanel
            score={score}
            correct={correctCount}
            wrong={wrongCount}
            level={stage}
            onReplay={() => setPhase("countdown")}
            onMenu={onExit}
          />
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * ROBÔ COLORIDO DO JOGADOR (ESQUERDA) — FEITO DE FORMAS GEOMÉTRICAS
 * ========================================================================== */
function PlayerGeoRobot({
  hit,
  superCharging,
}: {
  hit: boolean;
  superCharging: boolean;
}) {
  return (
    <svg
      viewBox="0 0 130 150"
      className="h-24 w-24 sm:h-32 sm:w-32 drop-shadow-[0_0_12px_rgba(56,189,248,0.55)]"
      style={{
        animation: hit ? "none" : "robotIdleFloatBlue 2.6s ease-in-out infinite",
        transformOrigin: "bottom center",
      }}
      aria-label="Robô colorido de formas geométricas do jogador"
    >
      {/* Antena Circular + Triângulo Dourado (brilhando e pulsando luz) */}
      <g style={{ animation: "prismAntennaGlow 2s ease-in-out infinite" }}>
        <circle
          cx="55"
          cy="12"
          r="7"
          fill={superCharging ? "#facc15" : "#38bdf8"}
          stroke="#fff"
          strokeWidth="2"
        />
        <polygon points="55,19 45,32 65,32" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
        {/* Ponto focal de brilho da antena */}
        <circle cx="53" cy="10" r="2.5" fill="#ffffff" opacity="0.9" />
      </g>

      {/* Cabeça Hexagonal / Retangular Colorida */}
      <polygon
        points="32,32 78,32 86,48 78,64 32,64 24,48"
        fill={hit ? "#f43f5e" : "#6366f1"}
        stroke="#e0f2fe"
        strokeWidth="2.5"
      />
      {/* Visor Luminoso Ciano com brilho suave */}
      <rect
        x="38"
        y="41"
        width="38"
        height="12"
        rx="4"
        fill="#22d3ee"
        style={{ filter: "drop-shadow(0 0 4px #38bdf8)" }}
      />
      
      {/* Olhos do Robô Prisma que piscam dinamicamente */}
      <g
        style={{
          animation: "prismEyeBlink 3.2s infinite",
          transformOrigin: "55px 47px",
        }}
      >
        {/* Olho Esquerdo */}
        <circle cx="48" cy="47" r="3.5" fill="#0f172a" />
        <circle cx="47" cy="46" r="1.3" fill="#67e8f9" />
        <circle cx="49" cy="48" r="0.7" fill="#ffffff" />
        {/* Olho Direito */}
        <circle cx="66" cy="47" r="3.5" fill="#0f172a" />
        <circle cx="65" cy="46" r="1.3" fill="#67e8f9" />
        <circle cx="67" cy="48" r="0.7" fill="#ffffff" />
      </g>

      {/* Tronco de Formas Geométricas (Quadrado + Losango Esmeralda + Triângulos) */}
      <rect
        x="26"
        y="68"
        width="58"
        height="48"
        rx="6"
        fill="#0ea5e9"
        stroke="#e0f2fe"
        strokeWidth="2.5"
      />
      {/* Losango Central Verde/Amarelo com pulso contínuo de brilho neon (partes do corpo brilhando) */}
      <g
        style={{
          animation: "prismCoreGlow 1.8s ease-in-out infinite",
          transformOrigin: "55px 92px",
        }}
      >
        <polygon
          points="55,73 73,92 55,111 37,92"
          fill="#10b981"
          stroke="#fef08a"
          strokeWidth="2"
        />
        <circle cx="55" cy="92" r="7" fill="#facc15" />
        <polygon points="55,87 59,92 55,97 51,92" fill="#ffffff" opacity="0.9" />
      </g>

      {/* Ombro Esquerdo (Triângulo Roxo/Rosa com brilho pulsante) */}
      <polygon
        points="10,70 26,68 26,94"
        fill="#ec4899"
        stroke="#fff"
        strokeWidth="1.5"
        style={{ animation: "prismShoulderGlow 2.4s ease-in-out infinite" }}
      />

      {/* Braço Direito Disparador do Raio Azul (Polígonos + Círculo Emissor) */}
      <rect x="84" y="78" width="24" height="14" rx="4" fill="#a855f7" stroke="#fff" strokeWidth="1.5" />
      <polygon
        points="108,74 124,85 108,96"
        fill="#38bdf8"
        stroke="#fff"
        strokeWidth="1.5"
        style={{ filter: "drop-shadow(0 0 5px #38bdf8)" }}
      />
      <circle
        cx="123"
        cy="85"
        r="6"
        fill="#e0f2fe"
        className="animate-ping"
        style={{ animationDuration: "1.4s" }}
      />

      {/* Pernas Geométricas (Trapézio Laranja e Verde) */}
      <polygon points="32,116 50,116 46,144 28,144" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
      <polygon points="60,116 78,116 82,144 64,144" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

/* ============================================================================
 * ROBÔ INIMIGO VERMELHO (DIREITA) — FEITO DE FORMAS GEOMÉTRICAS VERMELHAS
 * ========================================================================== */
function EnemyGeoRobot({
  theme,
  hit,
}: {
  theme: RobotShapeTheme;
  hit: null | "normal" | "super";
}) {
  return (
    <svg
      viewBox="0 0 130 150"
      className="h-24 w-24 sm:h-32 sm:w-32 drop-shadow-[0_0_14px_rgba(239,68,68,0.65)]"
      style={{
        animation: hit ? "none" : "robotIdleFloatRed 2.3s ease-in-out infinite",
        transformOrigin: "bottom center",
      }}
      aria-label="Robô inimigo vermelho de formas geométricas"
    >
      {/* Chifres / Crista Geométrica Vermelha com tremor agressivo */}
      <g style={{ animation: "angryHornsTremble 2.8s ease-in-out infinite", transformOrigin: "65px 32px" }}>
        <polygon points="48,14 36,32 54,32" fill="#ef4444" stroke="#fecaca" strokeWidth="1.5" />
        <polygon points="82,14 76,32 94,32" fill="#dc2626" stroke="#fecaca" strokeWidth="1.5" />
      </g>

      {/* Cabeça Geométrica Vermelha */}
      {theme === "triangle" ? (
        <polygon
          points="65,24 100,64 30,64"
          fill={hit ? "#fde047" : "#b91c1c"}
          stroke="#fca5a5"
          strokeWidth="2.5"
        />
      ) : (
        <polygon
          points="40,30 90,30 100,48 90,64 40,64 30,48"
          fill={hit ? "#fde047" : "#991b1b"}
          stroke="#fca5a5"
          strokeWidth="2.5"
        />
      )}

      {/* Sobrancelhas Angulares de Bravo (fechadas, agressivas) */}
      <polygon points="40,38 64,44 64,41 40,35" fill="#fecaca" opacity="0.9" />
      <polygon points="90,38 66,44 66,41 90,35" fill="#fecaca" opacity="0.9" />

      {/* Visor / Olhos Vermelho/Amarelos Agressivos com piscar dinâmico de cara de bravo */}
      <g
        style={{
          animation: "redEyeBlinkAngry 2.8s infinite",
          transformOrigin: "65px 49px",
        }}
      >
        {/* Olho Esquerdo Agressivo (losango/triângulo inclinado com pupila de fúria) */}
        <polygon points="43,43 62,49 45,55" fill="#fef08a" stroke="#dc2626" strokeWidth="1" />
        <polygon points="50,47 58,49 52,51" fill="#7f1d1d" />

        {/* Olho Direito Agressivo (inclinado em direção oposta) */}
        <polygon points="87,43 68,49 85,55" fill="#fef08a" stroke="#dc2626" strokeWidth="1" />
        <polygon points="80,47 72,49 78,51" fill="#7f1d1d" />
      </g>

      {/* Boca com Expressão de Bravo (boca metálica cerrando dentes pontudos geométricos) */}
      <g style={{ animation: "angryMouthGrimace 2s ease-in-out infinite", transformOrigin: "65px 59px" }}>
        <polygon points="50,58 80,58 76,62 54,62" fill="#1e1b4b" stroke="#fca5a5" strokeWidth="1" />
        {/* Dentes metálicos afiados */}
        <polygon points="54,58 57,60 60,58" fill="#fef08a" />
        <polygon points="61,58 64,60 67,58" fill="#ffffff" />
        <polygon points="68,58 71,60 74,58" fill="#fef08a" />
        <polygon points="57,62 60,60 63,62" fill="#ffffff" />
        <polygon points="64,62 67,60 70,62" fill="#ffffff" />
      </g>

      {/* Corpo de Formas Geométricas em Tons de Vermelho */}
      <polygon
        points="32,68 98,68 106,94 92,118 38,118 24,94"
        fill={hit === "super" ? "#fff" : "#dc2626"}
        stroke="#fca5a5"
        strokeWidth="2.5"
      />
      {/* Núcleo Geométrico Interno Vermelho-Escuro / Carmesim com pulso de fogo */}
      <g
        style={{
          animation: "redCorePulseAngry 1.6s ease-in-out infinite",
          transformOrigin: "65px 93px",
        }}
      >
        <polygon
          points="65,73 85,93 65,113 45,93"
          fill="#7f1d1d"
          stroke="#f87171"
          strokeWidth="2"
        />
        <polygon points="65,81 75,93 65,105 55,93" fill="#ef4444" />
        <polygon points="65,86 70,93 65,100 60,93" fill="#facc15" />
      </g>

      {/* Canhão Esquerdo Apontado para a Barra Central (Disparando o Raio Vermelho) */}
      <rect x="18" y="78" width="22" height="14" rx="3" fill="#991b1b" stroke="#fca5a5" strokeWidth="1.5" />
      <polygon points="22,74 4,85 22,96" fill="#ef4444" stroke="#fecaca" strokeWidth="1.5" />
      <circle
        cx="7"
        cy="85"
        r="6"
        fill="#fca5a5"
        className="animate-ping"
        style={{ animationDuration: "1.2s" }}
      />

      {/* Braço Direito de Espinhos Vermelhos */}
      <polygon points="98,72 120,82 102,98" fill="#b91c1c" stroke="#fca5a5" strokeWidth="1.5" />

      {/* Pernas Geométricas Vermelhas */}
      <polygon points="42,118 58,118 52,145 34,145" fill="#991b1b" stroke="#fca5a5" strokeWidth="1.5" />
      <polygon points="72,118 88,118 96,145 78,145" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="1.5" />
    </svg>
  );
}
