import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameHud } from "./GameHud";
import { ResultPanel } from "./ResultPanel";
import { CartesianPlane } from "./CartesianPlane";
import { StartScreen, OptionChip } from "./StartScreen";
import { Countdown } from "./Countdown";
import { useCountdown } from "@/lib/use-countdown";
import { generateCartQuestion, type CartQuestion } from "@/lib/cart-questions";
import { updateBest, saveLastMatch, loadLastMatch, type LastMatch } from "@/lib/game-storage";

const DURATION = 120;
const LEVEL_UP_STREAK = 4;
const MAX_LEVEL = 2;

interface Props {
  onExit: () => void;
  onStatsChange: () => void;
}

type PlaneSize = 8 | 10 | 15;
const SIZE_OPTIONS: PlaneSize[] = [8, 10, 15];
// interpretation: NxN => eixos de -N a +N
const sizeToRange = (n: PlaneSize) => n;

export function CartesianGame({ onExit, onStatsChange }: Props) {
  const [phase, setPhase] = useState<"setup" | "countdown" | "playing">("setup");
  const [planeSize, setPlaneSize] = useState<PlaneSize>(8);
  const [lastMatch, setLastMatch] = useState<LastMatch | null>(null);
  const range = sizeToRange(planeSize);

  useEffect(() => {
    setLastMatch(loadLastMatch("cartesiano"));
  }, []);

  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState<CartQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showLevelUp, setShowLevelUp] = useState<number | null>(null);
  const lockRef = useRef(false);

  const time = useCountdown(DURATION, running, () => {
    setRunning(false);
    setFinished(true);
  });

  useEffect(() => {
    if (finished) {
      updateBest("cartesiano", score, level);
      const m: LastMatch = { score, correct, wrong, level, at: Date.now() };
      saveLastMatch("cartesiano", m);
      setLastMatch(m);
      onStatsChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function startGame() {
    setScore(0); setCorrect(0); setWrong(0); setLevel(1); setStreak(0);
    setSelected(null); setFinished(false);
    setQuestion(generateCartQuestion(1, range));
    setPhase("playing");
    setRunning(true);
  }

  function replayWithCountdown() {
    setFinished(false);
    setRunning(false);
    setPhase("countdown");
  }

  function backToSetup() {
    setRunning(false); setFinished(false); setPhase("setup");
  }

  function nextQuestion(lvl: number) {
    setSelected(null);
    setQuestion(generateCartQuestion(lvl, range));
  }

  function answer(idx: number) {
    if (lockRef.current || !running || !question) return;
    lockRef.current = true;
    setSelected(idx);
    const ok = idx === question.correctIndex;
    if (ok) {
      setScore((s) => s + 10);
      setCorrect((c) => c + 1);
      setStreak((s) => {
        const next = s + 1;
        if (next >= LEVEL_UP_STREAK && level < MAX_LEVEL) {
          const nl = level + 1;
          setLevel(nl);
          setShowLevelUp(nl);
          setTimeout(() => setShowLevelUp(null), 1100);
          setTimeout(() => { nextQuestion(nl); lockRef.current = false; }, 700);
          return 0;
        }
        setTimeout(() => { nextQuestion(level); lockRef.current = false; }, 700);
        return next;
      });
    } else {
      setScore((s) => Math.max(0, s - 5));
      setWrong((w) => w + 1);
      setStreak(0);
      setTimeout(() => { nextQuestion(level); lockRef.current = false; }, 800);
    }
  }

  if (phase === "setup") {
    return (
      <StartScreen
        title="Plano Cartesiano"
        description="Interprete posições no plano. Acerto: +10 • Erro: −5"
        onStart={startGame}
        onExit={onExit}
        lastMatch={lastMatch}
      >
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
            Tamanho do plano
          </div>
          <div className="grid grid-cols-3 gap-3">
            {SIZE_OPTIONS.map((s) => (
              <OptionChip key={s} active={planeSize === s} onClick={() => setPlaneSize(s)}>
                {s}x{s}
              </OptionChip>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Eixos de −{sizeToRange(planeSize)} a +{sizeToRange(planeSize)}
          </p>
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
      </div>
    );
  }


  const target = question?.points.find((p) => p.label === question.targetLabel);

  return (
    <div className="space-y-4">
      <TopBar onExit={onExit} />
      <GameHud time={time} score={score} level={level} streak={streak} />

      <div className="relative rounded-3xl border bg-card p-4 sm:p-6 shadow-lg overflow-hidden">
        {showLevelUp && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/85 backdrop-blur-sm">
            <div className="animate-level-up text-center">
              <div className="font-display text-5xl sm:text-7xl font-extrabold text-accent">Nível {showLevelUp}!</div>
              <div className="mt-2 text-muted-foreground">Mandou bem! 🎯</div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6 items-center">
          {question && (
            <CartesianPlane
              points={question.points}
              range={range}
              highlightLabel={question.mode === "findPosition" ? question.targetLabel : null}
            />
          )}

          <div>
            <div className="rounded-2xl bg-secondary p-4 sm:p-6 text-center">
              {question?.mode === "findLetter" ? (
                <>
                  <p className="text-sm uppercase tracking-wider text-muted-foreground">Qual letra está em</p>
                  <div key={`${target?.x},${target?.y}`} className="animate-pop-in mt-2 font-display text-4xl sm:text-5xl font-extrabold text-primary">
                    ({target?.x}, {target?.y})?
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm uppercase tracking-wider text-muted-foreground">Em qual posição está a letra</p>
                  <div key={question?.targetLabel} className="animate-pop-in mt-2 font-display text-5xl sm:text-6xl font-extrabold text-primary">
                    {question?.targetLabel}?
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {question?.options.map((opt, i) => {
                const isCorrect = selected !== null && i === question.correctIndex;
                const isWrongChoice = selected === i && i !== question.correctIndex;
                const cls = isCorrect
                  ? "bg-success text-success-foreground border-success"
                  : isWrongChoice
                  ? "bg-destructive text-destructive-foreground border-destructive"
                  : "bg-card hover:bg-secondary border-border";
                return (
                  <button
                    key={i}
                    onClick={() => answer(i)}
                    disabled={selected !== null}
                    className={`h-16 rounded-2xl border-2 font-display text-xl sm:text-2xl font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed ${cls}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBar({ onExit }: { onExit: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" onClick={onExit} className="rounded-xl">
        <ArrowLeft className="mr-2 h-4 w-4" /> Menu
      </Button>
      <div className="font-display text-lg sm:text-xl font-bold">Plano Cartesiano</div>
      <div className="w-20" />
    </div>
  );
}
