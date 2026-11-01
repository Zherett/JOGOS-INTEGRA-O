import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Megaphone, Sparkles } from "lucide-react";
import integracaoPreto from "@/assets/integracao-preto.asset.json";
import semed from "@/assets/semed.asset.json";

const NEW_URL = "https://zherett.github.io/JOGOS-INTEGRA-O/";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estamos de mudança — Desafios de Lógica" },
      { name: "description", content: "A plataforma Desafios de Lógica está migrando para um novo endereço. Clique e continue jogando!" },
      { property: "og:title", content: "Estamos de mudança — Desafios de Lógica" },
      { property: "og:description", content: "A plataforma Desafios de Lógica está migrando para um novo endereço. Clique e continue jogando!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MigrationAnnouncement,
});

function MigrationAnnouncement() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-8 text-center animate-pop-in">
        <div className="flex items-start justify-center gap-6 sm:gap-10">
          <img
            src={integracaoPreto.url}
            alt="Logo do Projeto INTEGRAÇÃO"
            width={160}
            height={80}
            className="h-12 w-auto sm:h-16 rounded-lg object-contain"
          />
          <img
            src={semed.url}
            alt="Logo da SEMED Coari"
            width={160}
            height={80}
            className="h-12 w-auto sm:h-16 rounded-lg object-contain"
          />
        </div>

        <div className="rounded-3xl border bg-card p-8 sm:p-12 shadow-xl space-y-6">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
            <Megaphone className="h-10 w-10" />
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> Aviso importante
            </div>
            <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight">
              Estamos <span className="text-primary">mudando de plataforma!</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto">
              Os Desafios de Lógica agora têm um novo endereço. Todos os jogos estão esperando por você lá!
            </p>
          </div>

          <a
            href={NEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl bg-primary px-10 py-6 font-display text-2xl sm:text-3xl font-extrabold text-primary-foreground shadow-lg transition-all hover:scale-[1.03] hover:shadow-2xl active:scale-95"
          >
            Clique aqui para acessar
            <ArrowRight className="h-8 w-8 transition-transform group-hover:translate-x-1" />
          </a>

          <p className="text-sm text-muted-foreground break-all">
            Novo endereço: <span className="font-semibold text-foreground">{NEW_URL}</span>
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Projeto INTEGRAÇÃO — SEMED-COARI • Idealizado para alunos do 5º ao 9º ano.
        </p>
      </div>
    </main>
  );
}
