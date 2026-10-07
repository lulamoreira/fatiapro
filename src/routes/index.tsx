import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Cpu, ShieldCheck, Activity } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FatiaPro — análises de fatiamento 3D no seu computador" },
      { name: "description", content: "Peça análises de fatiamento, acompanhe ao vivo, aprove as mudanças e guarde o histórico. Tudo roda na ponte do seu computador." },
      { property: "og:title", content: "FatiaPro — análises de fatiamento 3D" },
      { property: "og:description", content: "Peça, acompanhe e aprove análises de fatiamento feitas no seu próprio computador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const PONTOS = [
  { icon: Cpu, t: "Roda no seu computador", d: "A ponte FatiaPro usa os fatiadores que você já tem instalados." },
  { icon: Activity, t: "Acompanhe ao vivo", d: "Veja cada passo e aprove só as mudanças que quiser." },
  { icon: ShieldCheck, t: "Nada vai pra impressora", d: "O FatiaPro analisa e sugere. Imprimir continua com você." },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-bold">
          Fatia<span className="text-primary">Pro</span>
        </span>
        <Button asChild variant="outline">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12 md:pt-24">
        <p className="mb-4 inline-flex rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">Fatiamento 3D sem chute</p>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.05] md:text-6xl">
          A peça certa, no tempo certo, com o filamento que você tem.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Escolha o objetivo, o FatiaPro testa as opções no seu fatiador e você aprova linha por linha.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Começar agora</Link>
          </Button>
        </div>
        <div className="mt-20 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PONTOS.map((p) => (
            <div key={p.t} className="rounded-2xl border bg-card p-6">
              <p.icon className="size-6 text-primary" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">{p.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
