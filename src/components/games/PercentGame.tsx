import { useEffect, useRef, useState } from "react";
import { Check, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameHud } from "./GameHud";
import { ResultPanel } from "./ResultPanel";
import { StartScreen } from "./StartScreen";
import { TeamSetup } from "./TeamSetup";
import { TeamScoreBar, TeamResults } from "./TeamScoreBar";
import { SessionSummary } from "./SessionSummary";
import { useSessionEnd } from "@/lib/use-session-end";
import { NORMAL_CONFIG, type TeamConfig } from "@/lib/teams";
import { Countdown } from "./Countdown";
import { useRoundClock, formatTime } from "@/lib/use-countdown";
import { GameTopBar } from "./GameTopBar";
import { BonusTimeToggle } from "./BonusTimeToggle";
import { useTeamSession } from "@/lib/use-team-session";
import { updateBest, saveLastMatch, loadLastMatch, type LastMatch } from "@/lib/game-storage";
import { PercentBar } from "./percent/PercentBar";
import { PieDiagram } from "./percent/PieDiagram";
import { ObjectGrid } from "./percent/ObjectGrid";
import {
  makeQuestion, LEVEL_LABELS, QUESTIONS_PER_LEVEL,
  type PercentLevel, type PercentQuestion,
} from "@/lib/percent-content";

const DURATION = 120;
const POINTS_CORRECT = 10;
const POINTS_WRONG = 5;
const BONUS_STEP = 10;
const BONUS_MAX = 30;
const STREAK_MARKS = [5, 10, 15];

interface Props {
  onExit: () => void;
  onStatsChange: () => void;
}

type Phase = "setup" | "countdown" | "playing";

let audioCtx: AudioContext | null = null;
function tone(freq: number, dur = 0.18, type: OscillatorType = "sine") {
  try {
    if (typeof window === "undefined") return;
    audioCtx = audioCtx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.05);
  } catch { /* ignore */ }
}
const soundCorrect = () => { tone(523.25, 0.14); setTimeout(() => tone(783.99, 0.2), 130); };
const soundWrong = () => tone(140, 0.35, "sawtooth");
const soundClick = () => tone(440, 0.08, "triangle");

const TITLE = "Desafio das Porcentagens";

export function PercentGame({ onExit, onStatsChange }: Props) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [teamConfig, setTeamConfig] = useState<TeamConfig>(NORMAL_CONFIG);
  const team = useTeamSession();
  const [bonusOn, setBonusOn] = useState(true);
  const [runId, setRunId] = useState(0);
  const [lastMatch, setLastMatch] = useState<LastMatch | null>(null);

  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [level, setLevel] = useState<PercentLevel>(1);
  const [done, setDone] = useState(0); // questions answered in the current level
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [question, setQuestion] = useState<PercentQuestion | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"ok" | "bad" | null>(null);
  const [slices, setSlices] = useState<boolean[]>([]);
  const [bonusFlash, setBonusFlash] = useState(0);

  const timersRef = useRef<number[]>([]);
  const markRef = useRef(0);

  const score = Math.max(0, correct * POINTS_CORRECT - wrong * POINTS_WRONG);

  const clock = useRoundClock(DURATION, running, () => {
    setRunning(false);
    setFinished(true);
    clearTimers();
  }, BONUS_STEP, BONUS_MAX);

  const usedTime = Math.max(0, DURATION + clock.bonus - clock.time);

  function clearTimers() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }

  useEffect(() => { setLastMatch(loadLastMatch("porcentagem")); }, []);
  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!finished) return;
    updateBest("porcentagem", score, level);
    const m: LastMatch = { score, correct, wrong, level, at: Date.now() };
    saveLastMatch("porcentagem", m);
    setLastMatch(m);
    onStatsChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function loadNext(lvl: PercentLevel, prev?: PercentQuestion) {
    const q = makeQuestion(lvl, prev);
    setQuestion(q);
    setPicked(null);
    setFeedback(null);
    setSlices(q.kind === "pie-build" ? Array.from({ length: q.parts }, () => false) : []);
  }

  function startGame() {
    clearTimers();
    team.begin(teamConfig);
    setCorrect(0); setWrong(0); setStreak(0); setBestStreak(0);
    setLevel(1); setDone(0);
    markRef.current = 0;
    setFinished(false);
    setRunId((r) => r + 1);
    setPhase("playing");
    setRunning(true);
    loadNext(1);
  }

  function replayWithCountdown() {
    team.advance();
    clearTimers();
    setFinished(false);
    setRunning(false);
    setPhase("countdown");
  }

  function backToSetup() {
    clearTimers();
    setRunning(false);
    setFinished(false);
    setPhase("setup");
  }

  const sessionEnd = useSessionEnd(team, backToSetup);

  function register(isRight: boolean) {
    if (isRight) {
      setCorrect((c) => c + 1);
      soundCorrect();
      setStreak((s) => {
        const n = s + 1;
        setBestStreak((b) => Math.max(b, n));
        if (bonusOn && STREAK_MARKS.includes(n) && clock.bonus < BONUS_MAX) {
          clock.addBonus(BONUS_STEP);
          setBonusFlash(Date.now());
        }
        return n;
      });
    } else {
      setWrong((w) => w + 1);
      setStreak(0);
      soundWrong();
    }
    setFeedback(isRight ? "ok" : "bad");

    const t = window.setTimeout(() => {
      const nextDone = done + 1;
      let nextLevel = level;
      if (level < 5 && nextDone >= QUESTIONS_PER_LEVEL) {
        nextLevel = (level + 1) as PercentLevel;
        setLevel(nextLevel);
        setDone(0);
      } else {
        setDone(level === 5 ? (nextDone % QUESTIONS_PER_LEVEL) : nextDone);
      }
      loadNext(nextLevel, question ?? undefined);
    }, isRight ? 950 : 1500);
    timersRef.current.push(t);
  }

  function answer(opt: string) {
    if (!running || !question || question.kind === "pie-build" || picked) return;
    soundClick();
    setPicked(opt);
    register(opt === question.answer);
  }

  function toggleSlice(i: number) {
    if (!running || !question || question.kind !== "pie-build" || feedback) return;
    soundClick();
    setSlices((s) => s.map((v, idx) => (idx === i ? !v : v)));
  }

  function confirmBuild() {
    if (!running || !question || question.kind !== "pie-build" || feedback) return;
    const count = slices.filter(Boolean).length;
    register(count === question.target);
  }

  /* --------------------------------- Views --------------------------------- */

  if (sessionEnd.showing) {
    return (
      <div className="space-y-4">
        <GameTopBar title={TITLE} onExit={onExit} />
        <SessionSummary title={TITLE} session={team} onClose={sessionEnd.close} />
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <StartScreen
        title={TITLE}
        description="Porcentagem de forma visual: barras, diagramas, quantidades e situações do dia a dia. Acerto: +10 • Erro: −5"
        onStart={startGame}
        onExit={onExit}
        lastMatch={lastMatch}
        sessionActive={team.activeSession}
        onFinishSession={sessionEnd.request}
        bonusTime={bonusOn}
        onBonusTimeChange={setBonusOn}
      >
        <div className="space-y-4">
          <TeamSetup value={teamConfig} onChange={setTeamConfig} locked={team.activeSession} />
          <div className="rounded-2xl border bg-secondary/40 p-4 text-sm text-secondary-foreground">
            <p className="font-semibold mb-1">Como jogar</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Cada nível tem {QUESTIONS_PER_LEVEL} questões: barras e bateria, diagramas, quantidades e cotidiano.</li>
              <li>Depois do nível 4 começa o <b>Modo Desafio</b>, com todos os tipos misturados.</li>
              <li>A cada 5 acertos seguidos você ganha <b>+10 segundos</b> (até 2:30).</li>
              <li>Foque em 10%, 25%, 50%, 75% e 100%.</li>
            </ul>
          </div>
        </div>
      </StartScreen>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="space-y-4">
        <GameTopBar title={TITLE} onExit={onExit} sessionActive={team.activeSession} onFinishSession={sessionEnd.request} />
        <Countdown onDone={startGame} />
      </div>
    );
  }

  if (finished) {
    const total = correct + wrong;
    const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
    return (
      <div className="space-y-4">
        <GameTopBar title={TITLE} onExit={onExit} sessionActive={team.activeSession} onFinishSession={sessionEnd.request} />
        <ResultPanel
          score={score} correct={correct} wrong={wrong} level={level}
          onReplay={replayWithCountdown} onMenu={onExit} onChangeSettings={backToSetup}
        />
        <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-4 text-center shadow-sm">
          <p className="font-display text-lg font-bold">Você dominou {pct}% dos desafios.</p>
          <p className="text-sm text-muted-foreground">
            Maior sequência: <b>{bestStreak}</b> • Tempo utilizado: <b>{formatTime(usedTime)}</b> • Nível: <b>{LEVEL_LABELS[level]}</b>
          </p>
        </div>
        <TeamResults session={team} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <GameTopBar title={TITLE} onExit={onExit} sessionActive={team.activeSession} onFinishSession={sessionEnd.request} />
      <GameHud time={clock.time} score={score} level={level} streak={streak} />
      <BonusTimeToggle value={bonusOn} onChange={setBonusOn} earned={clock.bonus} />
      <TeamScoreBar key={runId} session={team} score={score} />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-2 text-sm shadow-sm">
        <span className="font-display font-bold">
          Nível {level} — {LEVEL_LABELS[level]}
        </span>
        <span className="text-muted-foreground">
          {level === 5 ? "Questões misturadas" : `Questões: ${done}/${QUESTIONS_PER_LEVEL}`}
        </span>
      </div>

      {bonusFlash > 0 && Date.now() - bonusFlash < 1600 && (
        <div key={bonusFlash} className="pointer-events-none fixed left-1/2 top-24 z-40 -translate-x-1/2 animate-pop-in rounded-2xl bg-success px-5 py-2 font-display text-xl font-extrabold text-white shadow-xl">
          +{BONUS_STEP} SEGUNDOS!
        </div>
      )}

      <div
        className={`rounded-3xl border-4 bg-card p-4 sm:p-6 shadow-lg transition-colors ${
          feedback === "ok" ? "border-success" : feedback === "bad" ? "border-destructive animate-shake-x" : "border-transparent"
        }`}
      >
        {question && (
          <>
            <div className="text-center">
              <h2 className="font-display text-xl sm:text-2xl font-extrabold">{question.prompt}</h2>
              {question.highlight && (
                <div className="mx-auto mt-2 inline-block rounded-2xl bg-primary/10 px-5 py-2 font-display text-2xl sm:text-3xl font-extrabold text-primary">
                  {question.highlight}
                </div>
              )}
            </div>

            <div className="mt-5 grid place-items-center">
              {question.kind === "bar" && (
                <PercentBar variant={question.variant} parts={question.parts} filled={question.filled} />
              )}
              {question.kind === "pie" && (
                <PieDiagram parts={question.parts} filled={question.filled} />
              )}
              {question.kind === "pie-build" && (
                <div className="flex flex-col items-center gap-3">
                  <PieDiagram parts={question.parts} filled={0} selected={slices} onToggle={toggleSlice} />
                  <p className="text-sm text-muted-foreground">
                    Toque nas partes • selecionadas: <b className="text-foreground">{slices.filter(Boolean).length}</b> de {question.parts}
                  </p>
                  <Button
                    size="lg"
                    className="h-14 rounded-2xl px-8 text-base font-bold"
                    onClick={confirmBuild}
                    disabled={!!feedback}
                  >
                    Confirmar
                  </Button>
                </div>
              )}
              {question.kind === "objects" && (
                <ObjectGrid emoji={question.emoji} count={question.count} />
              )}
              {question.kind === "word" && (
                <div className="text-6xl sm:text-7xl">{question.emoji}</div>
              )}
            </div>

            {question.kind !== "pie-build" && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {question.options.map((opt) => {
                  const isAnswer = opt === question.answer;
                  const isPicked = opt === picked;
                  const state = !feedback
                    ? "bg-card hover:bg-secondary border-border"
                    : isAnswer
                      ? "bg-success/15 border-success text-success"
                      : isPicked
                        ? "bg-destructive/15 border-destructive text-destructive"
                        : "bg-card border-border opacity-60";
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => answer(opt)}
                      disabled={!!feedback}
                      className={`flex h-16 items-center justify-center gap-2 rounded-2xl border-2 font-display text-2xl font-extrabold shadow-sm transition-all hover:scale-[1.02] active:scale-95 ${state}`}
                    >
                      {feedback && isAnswer && <Check className="h-5 w-5" />}
                      {feedback && isPicked && !isAnswer && <X className="h-5 w-5" />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {feedback && (
              <div
                className={`mt-4 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-center font-semibold animate-pop-in ${
                  feedback === "ok" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                }`}
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>
                  {feedback === "ok" ? "Muito bem! " : "Quase! "}
                  {question.tip}
                  {feedback === "bad" && question.kind !== "pie-build" && ` Resposta: ${question.answer}.`}
                  {feedback === "bad" && question.kind === "pie-build" && ` Eram ${question.target} de ${question.parts} partes.`}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
