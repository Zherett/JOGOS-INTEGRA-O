import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowLeft, Clock, Trophy, Star, Heart, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StartScreen, OptionChip } from "./StartScreen";
import { Countdown } from "./Countdown";
import { ResultPanel } from "./ResultPanel";
import { useCountdown, formatTime } from "@/lib/use-countdown";
import { generateVariableQuestion, type VarQuestion } from "@/lib/variable-questions";
import { updateBest, saveLastMatch, loadLastMatch, type LastMatch } from "@/lib/game-storage";

const DURATION = 120;
const START_LIVES = 5;
const LEVEL_UP_HITS = 5;
const MAX_LEVEL = 5;
const POINTS_CORRECT = 10;
const POINTS_WRONG = 5;

interface Props {
  onExit: () => void;
  onStatsChange: () => void;
}

const BALL_COLORS = [
  "from-sky-400 to-blue-600",
  "from-emerald-400 to-green-600",
  "from-amber-300 to-orange-500",
  "from-rose-400 to-red-500",
  "from-fuchsia-400 to-purple-600",
  "from-teal-300 to-cyan-600",
  "from-lime-300 to-lime-600",
  "from-indigo-300 to-indigo-600",
];

// Small audio helper via WebAudio (no assets).
function beep(freq: number, dur = 0.12, type: OscillatorType = "sine", vol = 0.06) {
  try {
    const AC = (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
    o.onended = () => ctx.close();
  } catch { /* silent */ }
}
const playCorrect = () => { beep(660, 0.09, "triangle", 0.08); setTimeout(() => beep(990, 0.14, "triangle", 0.08), 90); };
const playWrong = () => { beep(180, 0.22, "sawtooth", 0.05); };

export function VariableHuntGame({ onExit, onStatsChange }: Props) {
  const [phase, setPhase] = useState<"setup" | "countdown" | "playing">("setup");
  const [startLevel, setStartLevel] = useState(1);
  const [lastMatch, setLastMatch] = useState<LastMatch | null>(null);

  useEffect(() => { setLastMatch(loadLastMatch("variaveis")); }, []);

  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelHits, setLevelHits] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [question, setQuestion] = useState<VarQuestion | null>(null);
  const [boxState, setBoxState] = useState<"idle" | "hover" | "correct" | "wrong">("idle");
  const [snapValue, setSnapValue] = useState<number | null>(null);
  const [sparkles, setSparkles] = useState<{ id: number; dx: number; dy: number; color: string }[]>([]);
  const [showLevelUp, setShowLevelUp] = useState<number | null>(null);
  const [timeAtEnd, setTimeAtEnd] = useState(0);
  const prevSigRef = useRef<string | undefined>(undefined);
  const lockRef = useRef(false);

  const time = useCountdown(DURATION, running, () => {
    setTimeAtEnd(0);
    endGame(0);
  });

  function endGame(remaining: number) {
    setRunning(false);
    setTimeAtEnd(remaining);
    setFinished(true);
  }

  useEffect(() => {
    if (finished) {
      updateBest("variaveis", score, level);
      const m: LastMatch = { score, correct, wrong, level, at: Date.now() };
      saveLastMatch("variaveis", m);
      setLastMatch(m);
      onStatsChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function newQuestion(lvl: number) {
    const q = generateVariableQuestion(lvl, prevSigRef.current);
    prevSigRef.current = `${q.left}${q.op}${q.right}=${q.result}`;
    setQuestion(q);
    setBoxState("idle");
    setSnapValue(null);
  }

  function startGame() {
    setScore(0); setCorrect(0); setWrong(0);
    setLevel(startLevel); setLevelHits(0);
    setStreak(0); setBestStreak(0);
    setLives(START_LIVES);
    setFinished(false);
    prevSigRef.current = undefined;
    newQuestion(startLevel);
    setPhase("playing");
    setRunning(true);
  }

  function replayWithCountdown() {
    setFinished(false);
    setRunning(false);
    setPhase("countdown");
  }

  function backToSetup() {
    setRunning(false);
    setFinished(false);
    setPhase("setup");
  }

  function spawnSparkles() {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: Date.now() + i,
      dx: Math.round((Math.random() - 0.5) * 160),
      dy: Math.round((Math.random() - 0.7) * 140),
      color: ["#fbbf24", "#f472b6", "#60a5fa", "#34d399", "#a78bfa"][i % 5],
    }));
    setSparkles(items);
    setTimeout(() => setSparkles([]), 900);
  }

  function onDrop(value: number) {
    if (!question || lockRef.current) return;
    const ok = value === question.answer;
    if (ok) {
      lockRef.current = true;
      playCorrect();
      spawnSparkles();
      setBoxState("correct");
      setSnapValue(value);
      setScore((s) => s + POINTS_CORRECT);
      setCorrect((c) => c + 1);
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));

      const nextHits = levelHits + 1;
      if (nextHits >= LEVEL_UP_HITS && level < MAX_LEVEL) {
        const newLevel = level + 1;
        setLevel(newLevel);
        setLevelHits(0);
        setShowLevelUp(newLevel);
        setTimeout(() => {
          setShowLevelUp(null);
          newQuestion(newLevel);
          lockRef.current = false;
        }, 1100);
      } else {
        setLevelHits(nextHits);
        setTimeout(() => {
          newQuestion(level);
          lockRef.current = false;
        }, 900);
      }
    } else {
      playWrong();
      setBoxState("wrong");
      setScore((s) => Math.max(0, s - POINTS_WRONG));
      setWrong((w) => w + 1);
      setStreak(0);
      const nextLives = lives - 1;
      setLives(nextLives);
      setTimeout(() => setBoxState("idle"), 500);
      if (nextLives <= 0) {
        setTimeout(() => endGame(time), 550);
      }
    }
  }

  if (phase === "setup") {
    return (
      <StartScreen
        title="Caça às Variáveis"
        description="Arraste a bola com o valor correto até a caixa. Acerto: +10 • Erro: −5 (perde 1 vida)"
        onStart={startGame}
        onExit={onExit}
        lastMatch={lastMatch}
      >
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
            Nível inicial
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <OptionChip key={n} active={startLevel === n} onClick={() => setStartLevel(n)}>
                {n}
              </OptionChip>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs text-muted-foreground text-center">
            <div>1: só soma</div>
            <div>2: soma e subtração</div>
            <div>3: multiplicação</div>
            <div>4: divisão</div>
            <div>5: misto</div>
          </div>
        </div>
      </StartScreen>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="space-y-4">
        <TopBar onExit={onExit} />
        <Countdown onDone={startGame} />
      </div>
    );
  }

  if (finished) {
    return (
      <div className="space-y-4">
        <TopBar onExit={onExit} />
        <ResultPanel
          score={score} correct={correct} wrong={wrong} level={level}
          onReplay={replayWithCountdown} onMenu={onExit} onChangeSettings={backToSetup}
        />
        <div className="mx-auto max-w-2xl grid grid-cols-2 gap-3">
          <ExtraStat icon={<Clock className="h-5 w-5" />} label="Tempo restante" value={formatTime(timeAtEnd)} />
          <ExtraStat icon={<Flame className="h-5 w-5" />} label="Maior sequência" value={String(bestStreak)} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TopBar onExit={onExit} />
      <HudBar time={time} score={score} level={level} lives={lives} streak={streak} />
      <PlayArea
        question={question!}
        boxState={boxState}
        snapValue={snapValue}
        sparkles={sparkles}
        onDrop={onDrop}
        showLevelUp={showLevelUp}
      />
    </div>
  );
}

/* ----------------------------- UI subcomponents ---------------------------- */

function TopBar({ onExit }: { onExit: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" onClick={onExit} className="rounded-xl">
        <ArrowLeft className="mr-2 h-4 w-4" /> Menu
      </Button>
      <div className="font-display text-lg sm:text-xl font-bold">Caça às Variáveis</div>
      <div className="w-20" />
    </div>
  );
}

function HudBar({ time, score, level, lives, streak }: {
  time: number; score: number; level: number; lives: number; streak: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <Stat icon={<Clock className="h-5 w-5" />} label="Tempo" value={formatTime(time)} tone="primary" />
      <Stat icon={<Trophy className="h-5 w-5" />} label="Pontos" value={String(score)} tone="accent" />
      <Stat icon={<Star className="h-5 w-5" />} label="Nível" value={String(level)} tone="primary" />
      <Stat
        icon={<Heart className="h-5 w-5" />}
        label="Vidas"
        value={"♥".repeat(lives) + "♡".repeat(Math.max(0, 5 - lives))}
        tone="destructive"
      />
      <Stat icon={<Flame className="h-5 w-5" />} label="Sequência" value={String(streak)} tone="accent" />
    </div>
  );
}

function Stat({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: string; tone: "primary" | "accent" | "destructive";
}) {
  const bg =
    tone === "primary" ? "bg-primary/10 text-primary"
    : tone === "accent" ? "bg-accent/15 text-accent"
    : "bg-destructive/15 text-destructive";
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${bg}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-lg font-bold font-display">{value}</div>
      </div>
    </div>
  );
}

function ExtraStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-lg font-bold font-display">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------ Drag & drop ------------------------------- */

function PlayArea({
  question, boxState, snapValue, sparkles, onDrop, showLevelUp,
}: {
  question: VarQuestion;
  boxState: "idle" | "hover" | "correct" | "wrong";
  snapValue: number | null;
  sparkles: { id: number; dx: number; dy: number; color: string }[];
  onDrop: (value: number) => void;
  showLevelUp: number | null;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 6 } }),
  );
  const [activeValue, setActiveValue] = useState<number | null>(null);
  const [overBox, setOverBox] = useState(false);

  // Randomize ball colors + positions per question
  const decorated = useMemo(
    () => question.options.map((v, i) => ({
      value: v,
      color: BALL_COLORS[(i + Math.floor(Math.random() * BALL_COLORS.length)) % BALL_COLORS.length],
      rot: (Math.random() - 0.5) * 12,
      offY: Math.round(Math.random() * 14),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question],
  );

  function handleStart(e: DragStartEvent) {
    setActiveValue(Number(e.active.id));
  }
  function handleEnd(e: DragEndEvent) {
    const value = Number(e.active.id);
    if (e.over?.id === "var-box") onDrop(value);
    setActiveValue(null);
    setOverBox(false);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragOver={(e) => setOverBox(e.over?.id === "var-box")}
      onDragCancel={() => { setActiveValue(null); setOverBox(false); }}
    >
      <div className="relative rounded-3xl border bg-card p-6 sm:p-10 shadow-lg overflow-hidden">
        {showLevelUp && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-background/85 backdrop-blur-sm">
            <div className="animate-level-up text-center">
              <div className="font-display text-5xl sm:text-7xl font-extrabold text-accent">Nível {showLevelUp}!</div>
              <div className="mt-2 text-muted-foreground">Você está indo muito bem 🚀</div>
            </div>
          </div>
        )}

        {/* Expression */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 font-display text-4xl sm:text-6xl font-extrabold">
          <Token>{question.left === "?" ? (
            <VarBox state={boxState} hover={overBox} snapValue={snapValue} sparkles={sparkles} />
          ) : question.left}</Token>
          <Token muted>{question.op}</Token>
          <Token>{question.right === "?" ? (
            <VarBox state={boxState} hover={overBox} snapValue={snapValue} sparkles={sparkles} />
          ) : question.right}</Token>
          <Token muted>=</Token>
          <Token>{question.result}</Token>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Arraste a bola com o valor correto até a caixa
        </p>
      </div>

      {/* Balls tray */}
      <div className="relative rounded-3xl border bg-card p-4 sm:p-6 shadow-md min-h-[180px]">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {decorated.map((b) => (
            <Ball
              key={b.value}
              value={b.value}
              color={b.color}
              rot={b.rot}
              offY={b.offY}
              hidden={snapValue === b.value}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.2,.9,.3,1.3)" }}>
        {activeValue !== null && (
          <BallVisual
            value={activeValue}
            color={
              decorated.find((d) => d.value === activeValue)?.color
              ?? BALL_COLORS[0]
            }
            dragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Token({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={muted ? "text-muted-foreground" : "text-foreground"}>
      {children}
    </span>
  );
}

function VarBox({
  state, hover, snapValue, sparkles,
}: {
  state: "idle" | "hover" | "correct" | "wrong";
  hover: boolean;
  snapValue: number | null;
  sparkles: { id: number; dx: number; dy: number; color: string }[];
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "var-box" });
  const active = isOver || hover;

  const base = "relative inline-grid place-items-center h-20 w-20 sm:h-28 sm:w-28 rounded-2xl border-4 border-dashed transition-all";
  const tone =
    state === "correct" ? "border-success bg-success/15 text-success animate-snap-in"
    : state === "wrong" ? "border-destructive bg-destructive/15 text-destructive animate-shake-x"
    : active ? "border-primary bg-primary/15 text-primary scale-110 animate-glow-pulse"
    : "border-primary/50 bg-primary/5 text-primary/70";

  return (
    <span ref={setNodeRef} className={`${base} ${tone}`}>
      {snapValue !== null ? (
        <span className="font-extrabold">{snapValue}</span>
      ) : (
        <span className="text-primary/60 font-black">?</span>
      )}
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 rounded-full animate-sparkle"
          style={{
            background: s.color,
            // @ts-expect-error CSS custom props
            "--dx": `${s.dx}px`,
            "--dy": `${s.dy}px`,
          }}
        />
      ))}
    </span>
  );
}

function Ball({ value, color, rot, offY, hidden }: {
  value: number; color: string; rot: number; offY: number; hidden: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: value });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 rounded-full"
      style={{
        transform: `translateY(${offY}px) rotate(${rot}deg)`,
        opacity: hidden || isDragging ? 0 : 1,
        touchAction: "none",
      }}
      aria-label={`Bola ${value}`}
    >
      <BallVisual value={value} color={color} />
    </button>
  );
}

function BallVisual({ value, color, dragging }: { value: number; color: string; dragging?: boolean }) {
  return (
    <span
      className={`grid place-items-center h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br ${color} text-white font-display font-extrabold text-2xl sm:text-3xl shadow-lg select-none ${
        dragging ? "scale-125 shadow-2xl ring-4 ring-white/40" : "hover:scale-105 active:scale-95 transition-transform"
      }`}
    >
      {value}
    </span>
  );
}
