import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Heart, Star as StarIcon, Coins, Trophy, Flame, ChevronsUp, Play, Pause, Sword } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultPanel } from "./ResultPanel";
import { updateBest } from "@/lib/game-storage";
import {
  ENEMIES, MINI_BOSS, BOSSES, DIFFICULTY_TIME, makeChallenge, xpForNext,
  type EnemyDef, type Difficulty,
} from "@/lib/rpg-content";
import type { Question } from "@/lib/logic-questions";

interface Props {
  onExit: () => void;
  onStatsChange?: () => void;
}

/* ---------- world constants ---------- */
const WORLD_W = 3200;
const WORLD_H = 460;
const GROUND_Y = 380; // top edge of ground
const PLAYER_W = 42;
const PLAYER_H = 56;
const GRAVITY = 1400;    // px/s^2
const MOVE_SPEED = 240;  // px/s
const JUMP_V = 560;      // px/s

interface Platform { x: number; y: number; w: number; h: number }
interface Enemy {
  id: number;
  def: EnemyDef;
  x: number; y: number;
  hp: number; maxHp: number;
  patrolMin: number; patrolMax: number;
  dir: 1 | -1;
  hitFlash: number; // ms remaining
}
interface Chest { id: number; x: number; y: number; opened: boolean }
interface FloatNum { id: number; x: number; y: number; text: string; color: string; born: number }

/* ---------- level building ---------- */
function buildLevel(): { platforms: Platform[]; enemies: Enemy[]; chests: Chest[] } {
  const platforms: Platform[] = [
    { x: 0, y: GROUND_Y, w: WORLD_W, h: WORLD_H - GROUND_Y },
    { x: 320, y: 300, w: 130, h: 16 },
    { x: 560, y: 240, w: 130, h: 16 },
    { x: 820, y: 300, w: 160, h: 16 },
    { x: 1120, y: 260, w: 140, h: 16 },
    { x: 1380, y: 320, w: 120, h: 16 },
    { x: 1680, y: 260, w: 160, h: 16 },
    { x: 1980, y: 300, w: 120, h: 16 },
    { x: 2260, y: 250, w: 160, h: 16 },
    { x: 2560, y: 300, w: 140, h: 16 },
  ];
  const pool: EnemyDef[] = [
    ENEMIES[0], ENEMIES[0], ENEMIES[1], ENEMIES[2], ENEMIES[1],
    ENEMIES[2], ENEMIES[3], ENEMIES[3], ENEMIES[4], MINI_BOSS,
    ENEMIES[3], ENEMIES[4], BOSSES[0], ENEMIES[4], BOSSES[1],
  ];
  const enemies: Enemy[] = [];
  let id = 1;
  let x = 450;
  for (const def of pool) {
    enemies.push({
      id: id++,
      def,
      x,
      y: GROUND_Y - def.size,
      hp: def.hp, maxHp: def.hp,
      patrolMin: Math.max(80, x - 60),
      patrolMax: x + 60,
      dir: 1,
      hitFlash: 0,
    });
    x += def.boss ? 260 : 170;
  }
  const chests: Chest[] = [
    { id: 1, x: 700, y: GROUND_Y - 34, opened: false },
    { id: 2, x: 1500, y: GROUND_Y - 34, opened: false },
    { id: 3, x: 2380, y: GROUND_Y - 34, opened: false },
  ];
  return { platforms, enemies, chests };
}

/* ---------- component ---------- */
export function RpgGame({ onExit, onStatsChange }: Props) {
  const [phase, setPhase] = useState<"start" | "playing" | "gameover" | "victory">("start");
  const [tick, setTick] = useState(0); // triggers render
  const [challenge, setChallenge] = useState<null | {
    enemyId: number; q: Question; time: number; total: number; answering: boolean;
  }>(null);
  const [floatNums, setFloatNums] = useState<FloatNum[]>([]);
  const [screenShake, setScreenShake] = useState(false);
  const [levelUpBanner, setLevelUpBanner] = useState<number | null>(null);
  const [comboBanner, setComboBanner] = useState<string | null>(null);

  const worldRef = useRef(buildLevel());
  const playerRef = useRef({
    x: 60, y: GROUND_Y - PLAYER_H, vx: 0, vy: 0, onGround: true,
    hp: 100, maxHp: 100, level: 1, xp: 0, coins: 0, score: 0,
    combo: 0, maxCombo: 0, facing: 1 as 1 | -1,
    enemiesKilled: 0, bossesKilled: 0, startTime: 0,
    hitFlash: 0,
  });
  const keysRef = useRef({ left: false, right: false, jump: false });
  const cameraXRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewW, setViewW] = useState(800);
  const recentQ = useRef<string[]>([]);
  const recentA = useRef<boolean[]>([]);
  const floatId = useRef(1);

  useEffect(() => {
    if (!viewportRef.current) return;
    const el = viewportRef.current;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, [phase]);

  /* ---------- input ---------- */
  useEffect(() => {
    if (phase !== "playing") return;
    const down = (e: KeyboardEvent) => {
      if (challenge) return;
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = true;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = true;
      if (["ArrowUp", "w", "W", " "].includes(e.key)) { keysRef.current.jump = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      if (["ArrowLeft", "a", "A"].includes(e.key)) keysRef.current.left = false;
      if (["ArrowRight", "d", "D"].includes(e.key)) keysRef.current.right = false;
      if (["ArrowUp", "w", "W", " "].includes(e.key)) keysRef.current.jump = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, challenge]);

  /* ---------- game loop ---------- */
  useEffect(() => {
    if (phase !== "playing") return;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!challenge) updateWorld(dt);
      updateFloats(now);
      setTick(t => (t + 1) % 1000000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, challenge]);

  /* ---------- challenge timer ---------- */
  useEffect(() => {
    if (!challenge) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setChallenge(prev => {
        if (!prev || prev.answering) return prev;
        const t = prev.time - dt;
        if (t <= 0) {
          queueMicrotask(() => resolveAnswer(false, true));
          return { ...prev, time: 0, answering: true };
        }
        return { ...prev, time: t };
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.enemyId, challenge?.q]);

  /* ---------- helpers ---------- */
  const pushFloat = (x: number, y: number, text: string, color: string) => {
    setFloatNums(list => [...list, { id: floatId.current++, x, y, text, color, born: performance.now() }]);
  };
  const updateFloats = (now: number) => {
    setFloatNums(list => list.filter(f => now - f.born < 900));
  };

  const rectsOverlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  const updateWorld = (dt: number) => {
    const p = playerRef.current;
    const w = worldRef.current;

    // horizontal input
    let vx = 0;
    if (keysRef.current.left) { vx -= MOVE_SPEED; p.facing = -1; }
    if (keysRef.current.right) { vx += MOVE_SPEED; p.facing = 1; }
    p.vx = vx;

    // jump
    if (keysRef.current.jump && p.onGround) {
      p.vy = -JUMP_V;
      p.onGround = false;
    }

    // gravity
    p.vy += GRAVITY * dt;
    if (p.vy > 900) p.vy = 900;

    // integrate x
    p.x += p.vx * dt;
    if (p.x < 0) p.x = 0;
    if (p.x + PLAYER_W > WORLD_W) p.x = WORLD_W - PLAYER_W;

    // integrate y with platform collision (only when falling)
    const prevY = p.y;
    p.y += p.vy * dt;
    p.onGround = false;
    for (const plat of w.platforms) {
      const wasAbove = prevY + PLAYER_H <= plat.y + 0.5;
      const overlapsX = p.x + PLAYER_W > plat.x && p.x < plat.x + plat.w;
      const nowInside = p.y + PLAYER_H > plat.y && p.y + PLAYER_H < plat.y + plat.h + 20;
      if (p.vy >= 0 && wasAbove && overlapsX && nowInside) {
        p.y = plat.y - PLAYER_H;
        p.vy = 0;
        p.onGround = true;
      }
    }
    // fall guard
    if (p.y > WORLD_H) {
      p.y = GROUND_Y - PLAYER_H;
      p.hp = Math.max(0, p.hp - 10);
      pushFloat(p.x + 20, p.y, "-10", "text-destructive");
      if (p.hp <= 0) { endGame(false); return; }
    }

    // enemy patrol
    for (const e of w.enemies) {
      e.x += e.dir * 40 * dt;
      if (e.x < e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
      if (e.x > e.patrolMax) { e.x = e.patrolMax; e.dir = -1; }
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 1000);
    }
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt * 1000);

    // camera
    const target = Math.max(0, Math.min(WORLD_W - viewW, p.x + PLAYER_W / 2 - viewW / 2));
    cameraXRef.current += (target - cameraXRef.current) * Math.min(1, dt * 8);

    // chest collision
    for (const c of w.chests) {
      if (c.opened) continue;
      if (rectsOverlap(p.x, p.y, PLAYER_W, PLAYER_H, c.x, c.y, 34, 34)) {
        c.opened = true;
        const roll = Math.random();
        const heal = roll < 0.5 ? 20 : roll < 0.85 ? 50 : p.maxHp;
        p.hp = Math.min(p.maxHp, p.hp + heal);
        p.coins += 10;
        pushFloat(c.x, c.y - 10, `+${heal} HP`, "text-success");
      }
    }

    // enemy collision → start challenge
    for (const e of w.enemies) {
      if (e.hp <= 0) continue;
      if (rectsOverlap(p.x, p.y, PLAYER_W, PLAYER_H, e.x, e.y, e.def.size, e.def.size)) {
        startChallenge(e);
        break;
      }
    }
  };

  const startChallenge = (e: Enemy) => {
    const q = makeChallenge(e.def.difficulty, recentQ.current, recentA.current);
    recentQ.current = [...recentQ.current.slice(-30), q.text];
    recentA.current = [...recentA.current.slice(-8), q.answer];
    const total = DIFFICULTY_TIME[e.def.difficulty];
    setChallenge({ enemyId: e.id, q, time: total, total, answering: false });
  };

  const resolveAnswer = (answer: boolean, timeout = false) => {
    setChallenge(cur => {
      if (!cur) return cur;
      const enemy = worldRef.current.enemies.find(e => e.id === cur.enemyId);
      if (!enemy) return null;
      const p = playerRef.current;
      const correct = !timeout && answer === cur.q.answer;

      if (correct) {
        p.combo += 1;
        p.maxCombo = Math.max(p.maxCombo, p.combo);
        let dmg = 1;
        let label = "-1";
        let color = "text-primary";
        if (p.combo >= 20) { dmg = enemy.def.boss ? 3 : Math.max(3, enemy.hp); label = "DEVASTADOR!"; color = "text-accent"; setComboBanner("GOLPE DEVASTADOR!"); }
        else if (p.combo >= 10) { dmg = 3; label = "ESPECIAL x3"; color = "text-accent"; setComboBanner("ATAQUE ESPECIAL!"); }
        else if (p.combo >= 5) { dmg = 2; label = "CRÍTICO x2"; color = "text-accent"; setComboBanner("CRÍTICO!"); }
        enemy.hp = Math.max(0, enemy.hp - dmg);
        enemy.hitFlash = 400;
        p.score += 10 * dmg;
        pushFloat(enemy.x + enemy.def.size / 2, enemy.y, label, color);
        if (comboBanner) setTimeout(() => setComboBanner(null), 700);

        if (enemy.hp <= 0) {
          p.xp += enemy.def.xp;
          p.coins += enemy.def.coins;
          p.score += enemy.def.xp;
          if (enemy.def.boss) p.bossesKilled += 1; else p.enemiesKilled += 1;
          // level up?
          while (p.xp >= xpForNext(p.level)) {
            p.xp -= xpForNext(p.level);
            p.level += 1;
            p.maxHp += 20;
            p.hp = p.maxHp;
            setLevelUpBanner(p.level);
            setTimeout(() => setLevelUpBanner(null), 1400);
          }
          // nudge player past enemy so no re-collision
          if (p.x < enemy.x) p.x = enemy.x - PLAYER_W - 6;
          else p.x = enemy.x + enemy.def.size + 6;
          // last boss defeated?
          const anyBossLeft = worldRef.current.enemies.some(e => e.def === BOSSES[BOSSES.length - 1] && e.hp > 0);
          if (enemy.def === BOSSES[BOSSES.length - 1] && !anyBossLeft) {
            setTimeout(() => endGame(true), 400);
          }
          return null;
        }
        // enemy still alive → next question
        setTimeout(() => startChallenge(enemy), 350);
        return { ...cur, answering: true };
      } else {
        // wrong / timeout → enemy attacks
        p.combo = 0;
        const dmgMap: Record<Difficulty, number> = { "very-easy": 5, easy: 8, medium: 12, hard: 16, "very-hard": 22 };
        const dmg = dmgMap[enemy.def.difficulty] + (enemy.def.boss ? 6 : 0);
        p.hp = Math.max(0, p.hp - dmg);
        p.hitFlash = 400;
        pushFloat(p.x + 20, p.y, `-${dmg}`, "text-destructive");
        setScreenShake(true); setTimeout(() => setScreenShake(false), 350);
        p.score = Math.max(0, p.score - 5);
        if (p.hp <= 0) {
          setTimeout(() => endGame(false), 300);
          return null;
        }
        setTimeout(() => startChallenge(enemy), 500);
        return { ...cur, answering: true };
      }
    });
  };

  const startGame = () => {
    worldRef.current = buildLevel();
    playerRef.current = {
      x: 60, y: GROUND_Y - PLAYER_H, vx: 0, vy: 0, onGround: true,
      hp: 100, maxHp: 100, level: 1, xp: 0, coins: 0, score: 0,
      combo: 0, maxCombo: 0, facing: 1,
      enemiesKilled: 0, bossesKilled: 0, startTime: performance.now(),
      hitFlash: 0,
    };
    cameraXRef.current = 0;
    keysRef.current = { left: false, right: false, jump: false };
    recentQ.current = []; recentA.current = [];
    setChallenge(null); setFloatNums([]); setLevelUpBanner(null); setComboBanner(null);
    setPhase("playing");
  };

  const endGame = (victory: boolean) => {
    const p = playerRef.current;
    updateBest("rpg", p.score, p.level);
    onStatsChange?.();
    setPhase(victory ? "victory" : "gameover");
  };

  /* ---------- render ---------- */
  const p = playerRef.current;
  const w = worldRef.current;
  const camX = cameraXRef.current;

  // find current target enemy for right HUD (closest alive within camera+buffer)
  const currentEnemy = useMemo(() => {
    if (challenge) return w.enemies.find(e => e.id === challenge.enemyId) ?? null;
    const alive = w.enemies.filter(e => e.hp > 0 && Math.abs((e.x + e.def.size / 2) - (p.x + PLAYER_W / 2)) < 260);
    alive.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    return alive[0] ?? null;
  }, [tick, challenge, w, p.x]);

  if (phase === "start") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onExit} className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" /> Menu
          </Button>
          <div className="font-display text-lg sm:text-xl font-bold">RPG da Lógica</div>
          <div className="w-20" />
        </div>
        <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-6 sm:p-10 shadow-xl animate-pop-in">
          <div className="text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-accent to-primary text-white shadow-lg">
              <Sword className="h-10 w-10" />
            </div>
            <h2 className="mt-4 font-display text-3xl sm:text-4xl font-extrabold">RPG da Lógica</h2>
            <p className="mt-2 text-muted-foreground">
              Explore o mapa, encontre monstros e derrote-os respondendo desafios de lógica. Cuidado com o tempo!
            </p>
          </div>
          <div className="mt-6 grid sm:grid-cols-2 gap-3 text-sm">
            <Info title="Movimento" body="← → ou A/D para andar. ↑ / W / Espaço para pular. No celular use os botões." />
            <Info title="Combate" body="Ao encostar em um inimigo, uma carta de desafio aparece. Acerto ataca, erro toma dano." />
            <Info title="Combo" body="5 acertos: crítico. 10: ataque especial. 20: golpe devastador!" />
            <Info title="Recuperação" body="Abra baús para poções (+20, +50 ou HP cheio) e moedas." />
          </div>
          <div className="mt-8 flex justify-center">
            <Button size="lg" onClick={startGame} className="h-16 px-10 text-xl font-bold rounded-2xl shadow-lg">
              <Play className="mr-2 h-6 w-6 fill-current" /> Iniciar aventura
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "gameover" || phase === "victory") {
    const survived = Math.round((performance.now() - p.startTime) / 1000);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onExit} className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" /> Menu
          </Button>
          <div className="font-display text-lg sm:text-xl font-bold">
            {phase === "victory" ? "🏆 Vitória!" : "💀 Game Over"}
          </div>
          <div className="w-20" />
        </div>
        <div className="text-center text-sm text-muted-foreground">
          Monstros: {p.enemiesKilled} • Chefes: {p.bossesKilled} • Maior combo: {p.maxCombo} • XP: {p.xp} • Sobrevivência: {survived}s
        </div>
        <ResultPanel
          score={p.score}
          correct={p.enemiesKilled + p.bossesKilled}
          wrong={0}
          level={p.level}
          onReplay={startGame}
          onMenu={onExit}
        />
      </div>
    );
  }

  // playing
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onExit} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" /> Menu
        </Button>
        <div className="font-display text-lg font-bold">RPG da Lógica</div>
        <div className="w-20" />
      </div>

      {/* HUD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/15 text-destructive"><Heart className="h-5 w-5" /></div>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">HP</div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-destructive transition-all" style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />
              </div>
            </div>
            <div className="text-sm font-bold w-16 text-right">{p.hp}/{p.maxHp}</div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <MiniStat icon={<StarIcon className="h-3.5 w-3.5" />} label="Nível" value={p.level} />
            <MiniStat icon={<ChevronsUp className="h-3.5 w-3.5" />} label="XP" value={`${p.xp}/${xpForNext(p.level)}`} />
            <MiniStat icon={<Coins className="h-3.5 w-3.5" />} label="Moedas" value={p.coins} />
            <MiniStat icon={<Trophy className="h-3.5 w-3.5" />} label="Pontos" value={p.score} />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Flame className="h-3.5 w-3.5 text-accent" />
            <span className="font-semibold">Combo: {p.combo}</span>
            {p.combo >= 5 && <span className="text-accent font-bold">{p.combo >= 20 ? "DEVASTADOR" : p.combo >= 10 ? "ESPECIAL" : "CRÍTICO"}</span>}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-3 shadow-sm min-h-[92px]">
          {currentEnemy ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-lg">{currentEnemy.def.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">{currentEnemy.def.boss ? "CHEFE" : "Inimigo"}</div>
                  <div className="font-bold truncate">{currentEnemy.def.name}</div>
                </div>
                <div className="text-xs text-muted-foreground">Dificuldade: <span className="font-bold">{currentEnemy.def.difficulty}</span></div>
              </div>
              <div className={`h-3 rounded-full bg-muted overflow-hidden ${currentEnemy.def.boss ? "h-4" : ""}`}>
                <div className="h-full bg-primary transition-all" style={{ width: `${(currentEnemy.hp / currentEnemy.maxHp) * 100}%` }} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Golpes restantes: <span className="font-bold text-foreground">{currentEnemy.hp}</span> / {currentEnemy.maxHp}</div>
            </>
          ) : (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">Explore o mapa para encontrar inimigos…</div>
          )}
        </div>
      </div>

      {/* Game viewport */}
      <div
        ref={viewportRef}
        className={`relative overflow-hidden rounded-3xl border shadow-xl select-none ${screenShake ? "animate-shake-x" : ""}`}
        style={{
          height: WORLD_H,
          background: "linear-gradient(to bottom, #7dd3fc 0%, #bae6fd 60%, #a7f3d0 60%, #86efac 100%)",
        }}
      >
        {/* parallax clouds */}
        <div className="absolute inset-0 pointer-events-none">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="absolute text-4xl opacity-70"
              style={{ left: (i * 600 - camX * 0.3) % (WORLD_W + 600), top: 30 + (i % 2) * 40 }}>
              ☁️
            </div>
          ))}
        </div>

        {/* world layer */}
        <div className="absolute inset-0" style={{ transform: `translateX(${-camX}px)`, width: WORLD_W }}>
          {/* platforms */}
          {w.platforms.map((pl, i) => (
            i === 0 ? (
              <div key={i} className="absolute"
                style={{ left: pl.x, top: pl.y, width: pl.w, height: pl.h,
                  background: "linear-gradient(to bottom, #65a30d, #4d7c0f 20%, #78350f 22%, #92400e)" }}>
                {/* grass tufts */}
                {Array.from({ length: Math.ceil(pl.w / 80) }).map((_, k) => (
                  <div key={k} className="absolute text-xl" style={{ left: k * 80 + 10, top: -12 }}>🌿</div>
                ))}
              </div>
            ) : (
              <div key={i} className="absolute rounded-md shadow"
                style={{ left: pl.x, top: pl.y, width: pl.w, height: pl.h,
                  background: "linear-gradient(to bottom, #a3e635, #4d7c0f)" }} />
            )
          ))}
          {/* decorations */}
          {[280, 900, 1500, 2100, 2800].map((x, i) => (
            <div key={i} className="absolute text-4xl" style={{ left: x, top: GROUND_Y - 44 }}>🌳</div>
          ))}
          {[500, 1300, 2500].map((x, i) => (
            <div key={i} className="absolute text-2xl" style={{ left: x, top: GROUND_Y - 24 }}>🪨</div>
          ))}
          {/* chests */}
          {w.chests.map(c => (
            <div key={c.id} className="absolute text-3xl transition-transform"
              style={{ left: c.x, top: c.y, transform: c.opened ? "scale(0.8) rotate(-10deg)" : "scale(1)" }}>
              {c.opened ? "📭" : "🎁"}
            </div>
          ))}
          {/* enemies */}
          {w.enemies.filter(e => e.hp > 0).map(e => (
            <div key={e.id}
              className={`absolute grid place-items-center rounded-2xl shadow-md ${e.hitFlash > 0 ? "animate-hit-flash" : ""}`}
              style={{
                left: e.x, top: e.y, width: e.def.size, height: e.def.size,
                background: `radial-gradient(circle at 30% 30%, ${e.def.color}, color-mix(in oklab, ${e.def.color} 60%, black))`,
                border: e.def.boss ? "3px solid #fbbf24" : "2px solid rgba(0,0,0,0.2)",
                fontSize: e.def.size * 0.55,
                transform: `scaleX(${e.dir === -1 ? -1 : 1})`,
              }}>
              {e.def.emoji}
            </div>
          ))}
          {/* player */}
          <div className={`absolute ${p.hitFlash > 0 ? "animate-hit-flash" : ""}`}
            style={{ left: p.x, top: p.y, width: PLAYER_W, height: PLAYER_H }}>
            <div className="w-full h-full rounded-xl shadow-lg grid place-items-center text-3xl"
              style={{
                background: "linear-gradient(to bottom, #60a5fa, #1d4ed8)",
                border: "2px solid #1e3a8a",
                transform: `scaleX(${p.facing})`,
              }}>
              🧙
            </div>
          </div>
          {/* floating numbers */}
          {floatNums.map(f => (
            <div key={f.id} className={`absolute font-display font-extrabold text-lg animate-float-up ${f.color}`}
              style={{ left: f.x, top: f.y }}>
              {f.text}
            </div>
          ))}
        </div>

        {/* touch controls */}
        <div className="absolute bottom-3 left-3 flex gap-2 md:hidden">
          <TouchBtn onDown={() => keysRef.current.left = true} onUp={() => keysRef.current.left = false} label="◀" />
          <TouchBtn onDown={() => keysRef.current.right = true} onUp={() => keysRef.current.right = false} label="▶" />
        </div>
        <div className="absolute bottom-3 right-3 md:hidden">
          <TouchBtn onDown={() => keysRef.current.jump = true} onUp={() => keysRef.current.jump = false} label="⤒" big />
        </div>

        {/* Level up banner */}
        {levelUpBanner !== null && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="rounded-2xl bg-accent text-accent-foreground px-6 py-4 font-display text-3xl font-extrabold shadow-2xl animate-level-up">
              ⭐ Nível {levelUpBanner}!
            </div>
          </div>
        )}
        {comboBanner && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-accent text-accent-foreground px-4 py-1 font-bold shadow animate-pop-in">
            {comboBanner}
          </div>
        )}

        {/* Challenge overlay */}
        {challenge && (
          <ChallengeCard
            question={challenge.q}
            timeLeft={challenge.time}
            total={challenge.total}
            answering={challenge.answering}
            enemy={w.enemies.find(e => e.id === challenge.enemyId)!}
            onAnswer={(v) => {
              setChallenge(cur => cur ? { ...cur, answering: true } : cur);
              resolveAnswer(v);
            }}
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Controles: ← → mover • ↑ / Espaço pular • Encoste em inimigos para iniciar o desafio
      </p>
    </div>
  );
}

/* ---------- subcomponents ---------- */
function Info({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="font-display font-bold">{title}</div>
      <div className="text-sm text-muted-foreground">{body}</div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1">
      <span className="text-primary">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-bold ml-auto">{value}</span>
    </div>
  );
}

function TouchBtn({ onDown, onUp, label, big }: { onDown: () => void; onUp: () => void; label: string; big?: boolean }) {
  const size = big ? "h-16 w-16 text-3xl" : "h-14 w-14 text-2xl";
  return (
    <button
      className={`${size} rounded-full bg-primary/85 text-primary-foreground font-bold shadow-lg active:scale-95 backdrop-blur`}
      onTouchStart={(e) => { e.preventDefault(); onDown(); }}
      onTouchEnd={(e) => { e.preventDefault(); onUp(); }}
      onMouseDown={onDown}
      onMouseUp={onUp}
      onMouseLeave={onUp}
    >
      {label}
    </button>
  );
}

function ChallengeCard({
  question, timeLeft, total, answering, enemy, onAnswer,
}: {
  question: Question; timeLeft: number; total: number; answering: boolean;
  enemy: Enemy; onAnswer: (v: boolean) => void;
}) {
  const pct = Math.max(0, Math.min(100, (timeLeft / total) * 100));
  const urgent = timeLeft < 5;
  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm grid place-items-center p-4 z-10">
      <div className="w-full max-w-md rounded-3xl border-4 border-accent bg-card p-6 shadow-2xl animate-card-reveal">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{enemy.def.emoji}</span>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Encontro</div>
              <div className="font-bold">{enemy.def.name}</div>
            </div>
          </div>
          <div className={`font-display text-2xl font-extrabold ${urgent ? "text-destructive animate-pulse" : "text-primary"}`}>
            {Math.ceil(timeLeft)}s
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
          <div className={`h-full transition-all ${urgent ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="rounded-2xl bg-muted p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Verdadeiro ou Falso?</div>
          <div className="font-display text-3xl sm:text-4xl font-extrabold break-words">{question.text}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            size="lg"
            disabled={answering}
            className="h-14 text-lg font-bold bg-success hover:bg-success/90 text-success-foreground"
            onClick={() => onAnswer(true)}
          >
            ✓ Verdadeiro
          </Button>
          <Button
            size="lg"
            disabled={answering}
            variant="destructive"
            className="h-14 text-lg font-bold"
            onClick={() => onAnswer(false)}
          >
            ✗ Falso
          </Button>
        </div>
        <div className="mt-3 text-center text-xs text-muted-foreground">
          {answering ? <span className="inline-flex items-center gap-1"><Pause className="h-3 w-3" /> Resolvendo…</span> : "Escolha antes que o tempo acabe!"}
        </div>
      </div>
    </div>
  );
}
