import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock, Trophy, Target, XCircle, LayoutGrid, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StartScreen } from "./StartScreen";
import { Countdown } from "./Countdown";
import { ResultPanel } from "./ResultPanel";
import { TeamSetup } from "./TeamSetup";
import { TeamScoreBar, TeamResults } from "./TeamScoreBar";
import { ShapeSvg } from "./ShapeSvg";
import { NORMAL_CONFIG, type TeamConfig } from "@/lib/teams";
import { updateBest, saveLastMatch, loadLastMatch, type LastMatch } from "@/lib/game-storage";
import {
  buildBoard,
  ANSWER_SECONDS,
  POINTS_CORRECT,
  POINTS_WRONG,
  COLS,
  type MineCard,
} from "@/lib/minefield-content";

interface Props {
  onExit: () => void;
  onStatsChange: () => void;
}

function beep(freq: number, dur = 0.14, type: OscillatorType = "sine", vol = 0.07) {
  try {
    const AC = (window as unknown as { AudioContext: typeof AudioContext }).AudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
    o.onended = () => ctx.close();
  } catch { /* silent */ }
}

export function MinefieldGame({ onExit, onStatsChange }: Props) {
  const [phase, setPhase] = useState<"setup" | "countdown" | "playing">("setup");
  const [teamConfig, setTeamConfig] = useState<TeamConfig>(NORMAL_CONFIG);
  const [activeTeam, setActiveTeam] = useState(0);
  const [teamScores, setTeamScores] = useState<number[]>([]);
  const [lastMatch, setLastMatch] = useState<LastMatch | null>(null);
  const [runId, setRunId] = useState(0);

  useEffect(() => { setLastMatch(loadLastMatch("minado")); }, []);

  const [board, setBoard] = useState<MineCard[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [flipping, setFlipping] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<MineCard | null>(null);
  const [answered, setAnswered] = useState<{ chosen: string; ok: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState(ANSWER_SECONDS);
  const [toast, setToast] = useState<string | null>(null);

  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [finished, setFinished] = useState(false);

  const timerRef = useRef<number | null>(null);
  const teamCount = teamConfig.mode === "equipes" ? teamConfig.teams.length : 0;

  function clearTimer() {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  }
  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (finished) {
      updateBest("minado", score, 1);
      const m: LastMatch = { score, correct, wrong, level: 1, at: Date.now() };
      saveLastMatch("minado", m);
      setLastMatch(m);
      onStatsChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function startGame() {
    clearTimer();
    setBoard(buildBoard());
    setRevealed(new Set());
    setOpenCard(null); setAnswered(null); setFlipping(null);
    setScore(0); setCorrect(0); setWrong(0);
    setTeamScores([]);
    setActiveTeam(0);
    setFinished(false);
    setRunId((r) => r + 1);
    setPhase("playing");
  }

  function nextTeam() {
    if (teamCount > 1) setActiveTeam((t) => (t + 1) % teamCount);
  }

  function openCell(card: MineCard) {
    if (openCard || revealed.has(card.id) || finished) return;
    beep(520, 0.1, "triangle");
    setFlipping(card.id);
    window.setTimeout(() => {
      setFlipping(null);
      setRevealed((r) => new Set(r).add(card.id));
      if (card.kind === "bonus") {
        setScore((s) => s + card.points);
        if (card.points >= 0) { setCorrect((c) => c + 1); beep(760, 0.16, "triangle"); }
        else { setWrong((w) => w + 1); beep(180, 0.2, "sawtooth"); }
        setToast(`${card.label}: ${card.points > 0 ? "+" : ""}${card.points} pontos`);
        window.setTimeout(() => setToast(null), 1600);
        nextTeam();
      } else {
        setOpenCard(card);
        setAnswered(null);
        setTimeLeft(ANSWER_SECONDS);
        clearTimer();
        timerRef.current = window.setInterval(() => {
          setTimeLeft((t) => {
            if (t <= 1) { clearTimer(); handleTimeout(); return 0; }
            return t - 1;
          });
        }, 1000);
      }
    }, 420);
  }

  function handleTimeout() {
    setAnswered({ chosen: "", ok: false });
    setWrong((w) => w + 1);
    setScore((s) => s - POINTS_WRONG);
    beep(160, 0.3, "sawtooth");
    window.setTimeout(closeCard, 1800);
  }

  function answer(option: string) {
    if (!openCard || openCard.kind === "bonus" || answered) return;
    clearTimer();
    const ok = option === openCard.answer;
    setAnswered({ chosen: option, ok });
    if (ok) {
      setScore((s) => s + POINTS_CORRECT);
      setCorrect((c) => c + 1);
      beep(660, 0.1, "triangle");
      window.setTimeout(() => beep(990, 0.16, "triangle"), 90);
    } else {
      setScore((s) => s - POINTS_WRONG);
      setWrong((w) => w + 1);
      beep(170, 0.28, "sawtooth");
    }
    window.setTimeout(closeCard, 1500);
  }

  function closeCard() {
    clearTimer();
    setOpenCard(null);
    setAnswered(null);
    nextTeam();
  }

  const allDone = board.length > 0 && revealed.size >= board.length;
  useEffect(() => { if (allDone && !finished) setFinished(true); }, [allDone, finished]);

  function replayWithCountdown() {
    setFinished(false);
    setPhase("countdown");
  }
  function backToSetup() {
    clearTimer();
    setFinished(false);
    setPhase("setup");
  }

  const remainingCards = useMemo(() => board.length - revealed.size, [board, revealed]);

  if (phase === "setup") {
    return (
      <StartScreen
        title="Campo Minado Lógico"
        description="Escolha uma carta do tabuleiro e responda o desafio. Acerto: +5 • Erro: −3"
        onStart={startGame}
        onExit={onExit}
        lastMatch={lastMatch}
      >
        <div className="space-y-4">
          <TeamSetup value={teamConfig} onChange={setTeamConfig} />
          <div className="rounded-2xl border bg-secondary/40 p-4 text-sm">
            <p className="font-semibold mb-1">Como jogar</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Tabuleiro 8×8 com colunas A–H e linhas 1–8.</li>
              <li>Ao clicar, a carta vira e revela um desafio (V ou F, conta misteriosa ou forma geométrica).</li>
              <li>Você tem 30 segundos para responder cada questão.</li>
              <li>Algumas cartas são bônus: valem de +1 a +3 ou de −1 a −3 pontos, sem pergunta.</li>
              <li>No modo equipes, a vez passa automaticamente para a próxima equipe.</li>
            </ul>
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
          score={score} correct={correct} wrong={wrong} level={1}
          onReplay={replayWithCountdown} onMenu={onExit} onChangeSettings={backToSetup}
        />
        <TeamResults config={teamConfig} scores={teamScores} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TopBar onExit={onExit} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat icon={<Trophy className="h-4 w-4" />} label="Pontos" value={String(score)} />
        <Stat icon={<Target className="h-4 w-4" />} label="Acertos" value={String(correct)} />
        <Stat icon={<XCircle className="h-4 w-4" />} label="Erros" value={String(wrong)} />
        <Stat icon={<LayoutGrid className="h-4 w-4" />} label="Cartas" value={String(remainingCards)} />
      </div>

      <TeamScoreBar
        key={runId}
        config={teamConfig}
        score={score}
        activeIndex={activeTeam}
        onActiveChange={setActiveTeam}
        onScoresChange={setTeamScores}
      />

      <div className="rounded-3xl border bg-card p-2 sm:p-4 shadow-lg">
        <div className="mx-auto w-full max-w-[560px]">
          <div className="grid gap-1" style={{ gridTemplateColumns: "1.25rem repeat(8, minmax(0,1fr))" }}>
            <div />
            {COLS.map((c) => (
              <div key={c} className="text-center text-[10px] sm:text-xs font-bold text-muted-foreground">{c}</div>
            ))}
            {board.length > 0 && Array.from({ length: 8 }, (_, row) => (
              <FragmentRow
                key={row}
                row={row}
                board={board}
                revealed={revealed}
                flipping={flipping}
                disabled={!!openCard}
                onOpen={openCell}
              />
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div className="animate-pop-in rounded-2xl border bg-accent/15 px-4 py-3 text-center font-display font-bold text-accent">
          {toast}
        </div>
      )}

      {openCard && openCard.kind !== "bonus" && (
        <div className="animate-card-reveal rounded-3xl border-2 border-primary bg-card p-4 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Carta {openCard.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
              timeLeft <= 10 ? "bg-destructive/15 text-destructive" : "bg-secondary text-secondary-foreground"
            }`}>
              <Clock className="h-4 w-4" /> {timeLeft}s
            </span>
          </div>

          {openCard.kind === "shape" && openCard.shape && (
            <div className="mt-4 grid place-items-center">
              <ShapeSvg shape={openCard.shape} color="azul" size={3} />
            </div>
          )}

          <p className="mt-4 text-center font-display text-2xl sm:text-3xl font-extrabold">
            {openCard.prompt}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {openCard.options.map((o) => {
              const chosen = answered?.chosen === o;
              const isRight = answered && o === openCard.answer;
              const tone = isRight
                ? "border-success bg-success/15 text-success"
                : chosen
                  ? "border-destructive bg-destructive/15 text-destructive animate-shake-x"
                  : "border-border bg-background hover:bg-secondary";
              return (
                <button
                  key={o}
                  type="button"
                  disabled={!!answered}
                  onClick={() => answer(o)}
                  className={`rounded-2xl border-2 px-4 py-4 font-display text-lg font-bold transition-all active:scale-95 ${tone}`}
                >
                  {o}
                </button>
              );
            })}
          </div>

          {answered && (
            <p className="mt-4 text-center font-bold">
              {answered.ok
                ? `Correto! +${POINTS_CORRECT} pontos`
                : `Resposta certa: ${openCard.answer} (−${POINTS_WRONG} pontos)`}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-center">
        <Button variant="outline" className="rounded-2xl" onClick={() => setFinished(true)}>
          <Flag className="mr-2 h-4 w-4" /> Encerrar partida
        </Button>
      </div>
    </div>
  );
}

function FragmentRow({ row, board, revealed, flipping, disabled, onOpen }: {
  row: number;
  board: MineCard[];
  revealed: Set<string>;
  flipping: string | null;
  disabled: boolean;
  onOpen: (c: MineCard) => void;
}) {
  return (
    <>
      <div className="grid place-items-center text-[10px] sm:text-xs font-bold text-muted-foreground">{row + 1}</div>
      {Array.from({ length: 8 }, (_, col) => {
        const card = board[row * 8 + col];
        const isRevealed = revealed.has(card.id);
        const isFlipping = flipping === card.id;
        return (
          <button
            key={card.id}
            type="button"
            disabled={disabled || isRevealed}
            onClick={() => onOpen(card)}
            aria-label={`Carta ${card.label}`}
            className={`aspect-square rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
              isFlipping ? "animate-card-flip" : ""
            } ${
              isRevealed
                ? "bg-muted text-muted-foreground/60 border border-border"
                : "bg-primary text-primary-foreground shadow-sm hover:brightness-110 hover:-translate-y-0.5 active:scale-95"
            }`}
            style={{ transformStyle: "preserve-3d" }}
          >
            {isRevealed ? "✓" : card.label}
          </button>
        );
      })}
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-sm">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate font-display text-base font-bold">{value}</div>
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
      <div className="font-display text-lg sm:text-xl font-bold">Campo Minado Lógico</div>
      <div className="w-20" />
    </div>
  );
}
