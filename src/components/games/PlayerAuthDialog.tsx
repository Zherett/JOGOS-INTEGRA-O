import { useState } from "react";
import { LogIn, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlayerAuth } from "@/lib/player-auth";
import { SCHOOLS, GRADES, schoolNeedsGrade } from "@/lib/player-profile";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PlayerAuthDialog({ open, onOpenChange }: Props) {
  const auth = usePlayerAuth();
  const [tab, setTab] = useState<"entrar" | "criar">("entrar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState<string>(SCHOOLS[1].name);
  const [grade, setGrade] = useState<string>(GRADES[0]);
  const [birthdate, setBirthdate] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res =
      tab === "entrar"
        ? await auth.signIn(nick, password)
        : await auth.signUp({
            nick,
            password,
            fullName,
            school,
            grade: schoolNeedsGrade(school) ? grade : null,
            birthdate,
          });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setPassword("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-extrabold">
            {tab === "entrar" ? "Entrar na sua conta" : "Criar seu perfil"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
          {(["entrar", "criar"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setError(null); }}
              className={`rounded-xl py-2 text-sm font-bold transition-colors ${
                tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "entrar" ? "Já tenho conta" : "Criar perfil"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nick">Apelido (nick)</Label>
            <Input
              id="nick"
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="ex: joao_logica"
              autoComplete="username"
              required
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === "entrar" ? "current-password" : "new-password"}
              required
              minLength={6}
              className="rounded-xl"
            />
          </div>

          {tab === "criar" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome verdadeiro</Label>
                <Input
                  id="nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="escola">Escola</Label>
                <select
                  id="escola"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  {SCHOOLS.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.range ? `${s.name} (${s.range})` : s.name}
                    </option>
                  ))}
                </select>
              </div>

              {schoolNeedsGrade(school) && (
                <div className="space-y-1.5">
                  <Label htmlFor="serie">Série</Label>
                  <select
                    id="serie"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="nascimento">Data de nascimento</Label>
                <Input
                  id="nascimento"
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
            </>
          )}

          {error && (
            <p className="rounded-xl bg-destructive/15 px-3 py-2 text-sm font-semibold text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={busy} className="h-12 w-full rounded-2xl text-base font-bold">
            {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : tab === "entrar" ? <LogIn className="mr-2 h-5 w-5" /> : <UserPlus className="mr-2 h-5 w-5" />}
            {tab === "entrar" ? "Entrar e jogar" : "Criar perfil"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Não pedimos e-mail. Guarde bem o seu apelido e a sua senha.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
