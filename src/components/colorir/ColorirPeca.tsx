import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Download,
  ArrowRight,
  Undo2,
  Redo2,
  Focus,
  ScanFace,
  Palette,
  Columns2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  IMPRESSORAS,
  PALETA,
  lerMemoria,
  guardarMemoria,
  validarEntrada,
} from "@/lib/colorir/paleta";
import type { CorSlot } from "@/lib/colorir/paleta";
import type { Semente } from "@/lib/colorir/watershed";
import { useColorir } from "./useColorir";
import { useSaidaColorida } from "./useSaidaColorida";
import { Cena } from "./Cena";
import type { CliquePeca, Vista } from "./Cena";
import { Paleta } from "./Paleta";
import { Ferramentas, Medida, FORMA_INICIAL } from "./Ferramentas";
import type { Ferramenta } from "./Ferramentas";
import { FotoReferencia } from "./FotoReferencia";
import { espelharForma, planoDaSuperficie } from "@/lib/colorir/formas";
import type { EixosCamera, Forma } from "@/lib/colorir/formas";
export interface ColorirPecaProps {
  userId: string;
}
export function ColorirPeca({ userId }: ColorirPecaProps) {
  const api = useColorir(),
    input = useRef<HTMLInputElement>(null),
    [nome, setNome] = useState(""),
    [impressora, setImpressora] = useState("u1"),
    [paleta, setPaleta] = useState<CorSlot[]>(PALETA.map((c) => ({ ...c }))),
    [memoriaLida, setMemoriaLida] = useState(false),
    [ativo, setAtivo] = useState(1),
    [tool, setTool] = useState<Ferramenta>("balde"),
    [sens, setSens] = useState(6),
    [raio, setRaio] = useState(2),
    [regioes, setRegioes] = useState(false),
    [foto, setFoto] = useState<string | null>(null),
    [comparar, setComparar] = useState(false),
    [seeds, setSeeds] = useState<Semente[]>([]),
    [forma, setForma] = useState(FORMA_INICIAL),
    [posicionada, setPosicionada] = useState(false),
    [espelho, setEspelho] = useState(false),
    [vista, setVista] = useState<Vista>({ id: 0, nome: "frente", face: null });
  const ultimo = useRef<number | null>(null),
    traco = useRef(false),
    ultimoPincel = useRef(0),
    eixosCamera = useRef<EixosCamera | null>(null),
    seedId = useRef(0);
  const n = IMPRESSORAS.find((i) => i.id === impressora)?.slots ?? 4,
    disabled = !api.dados || api.ocupado,
    saida = useSaidaColorida(userId, nome, api.exportar);
  useEffect(() => {
    const m = lerMemoria();
    setImpressora(m.impressora);
    setPaleta(m.paleta);
    setMemoriaLida(true);
  }, []);
  useEffect(() => {
    if (memoriaLida) guardarMemoria(impressora, paleta);
  }, [memoriaLida, impressora, paleta]);
  useEffect(
    () => () => {
      if (foto) URL.revokeObjectURL(foto);
    },
    [foto],
  );
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        !(e.ctrlKey || e.metaKey) ||
        e.key.toLowerCase() !== "z" ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        api.ocupado
      )
        return;
      e.preventDefault();
      api.enviar({ tipo: "historico", refazer: e.shiftKey });
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [api.enviar, api.ocupado]);
  function cor(index: number, c: CorSlot) {
    setPaleta((p) => p.map((old, i) => (i === index ? c : old)));
  }
  function mudarImpressora(id: string) {
    const count = IMPRESSORAS.find((i) => i.id === id)?.slots ?? 4;
    if (api.usadas.some((s) => s > count) || seeds.some((s) => s.slot > count)) {
      toast.error("Junte as cores dos slots extras antes de reduzir a quantidade de filamentos.");
      return;
    }
    setImpressora(id);
    if (ativo > count) setAtivo(1);
  }
  function finalizar() {
    if (traco.current) {
      traco.current = false;
      api.enviar({ tipo: "fimTraco" });
    }
  }
  function hit(c: CliquePeca) {
    ultimo.current = c.face;
    if (c.arrasto && tool !== "pincel") return;
    if (tool === "conta-gotas") {
      setAtivo(c.slot);
      return;
    }
    if (tool === "balde") {
      api.enviar({ tipo: "balde", face: c.face, slot: ativo }, true);
      return;
    }
    if (tool === "pincel") {
      const now = performance.now();
      if (c.arrasto && now - ultimoPincel.current < 100) return;
      ultimoPincel.current = now;
      if (!traco.current) {
        api.enviar({ tipo: "inicioTraco" });
        traco.current = true;
      }
      api.enviar({ tipo: "pincel", ponto: c.ponto, camera: c.camera, raio, slot: ativo });
      return;
    }
    if (tool === "sementes") {
      setSeeds((s) => [...s, { id: ++seedId.current, face: c.face, slot: ativo, ponto: c.ponto }]);
      return;
    }
    if (tool === "forma") {
      eixosCamera.current = c;
      const dados = api.dados;
      if (!dados) return;
      setForma((f) => planoDaSuperficie(dados.posicoes, { ...f, centro: c.ponto }, c));
      setPosicionada(true);
    }
  }
  function mudarForma(f: Forma) {
    const view = eixosCamera.current;
    const dados = api.dados;
    const mudouPlano =
      f.largura !== forma.largura ||
      f.altura !== forma.altura ||
      f.centro.some((v, i) => v !== forma.centro[i]);
    setForma(
      posicionada && mudouPlano && dados && view ? planoDaSuperficie(dados.posicoes, f, view) : f,
    );
  }
  function aplicar() {
    const d = api.dados;
    if (!d) return;
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < d.posicoes.length; i += 3) {
      min = Math.min(min, d.posicoes[i] ?? 0);
      max = Math.max(max, d.posicoes[i] ?? 0);
    }
    api.enviar(
      {
        tipo: "forma",
        formas: espelho ? [forma, espelharForma(forma, (min + max) / 2)] : [forma],
        slot: ativo,
      },
      true,
    );
  }
  async function abrir(file: File) {
    const erro = validarEntrada(file);
    if (erro) {
      toast.error(erro);
      return;
    }
    if (api.dados && !window.confirm("Trocar a peça descarta a pintura atual. Continuar?")) return;
    setNome(file.name);
    setSeeds([]);
    setPosicionada(false);
    setEspelho(false);
    eixosCamera.current = null;
    setVista((v) => ({ id: v.id + 1, nome: "frente", face: null }));
    ultimo.current = null;
    traco.current = false;
    await api.abrir(file, sens);
  }
  function ver(nomeVista: string) {
    setVista((v) => ({ id: v.id + 1, nome: nomeVista, face: ultimo.current }));
  }
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Palette className="size-6 text-primary-ink" />
            Colorir peça
          </h1>
          {nome && <p className="mt-1 max-w-xl break-all text-sm text-muted-foreground">{nome}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={api.ocupado} onClick={() => input.current?.click()}>
            <Upload />
            {api.dados ? "Trocar STL" : "Enviar STL"}
          </Button>
          <Button
            variant="outline"
            disabled={disabled || saida.salvando}
            onClick={() => void saida.analisar()}
          >
            <ArrowRight />
            {saida.salvando ? "Enviando…" : "Enviar para uma análise"}
          </Button>
          <Button disabled={disabled || saida.salvando} onClick={() => void saida.baixar()}>
            <Download />
            Baixar 3MF
          </Button>
        </div>
      </header>
      <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground md:hidden">
        Funciona melhor no computador: peças grandes usam muita memória.
      </p>
      <input
        ref={input}
        type="file"
        accept=".stl"
        aria-label="Arquivo STL"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void abrir(f);
          e.target.value = "";
        }}
      />
      {api.progresso && (
        <div className="flex items-center gap-3">
          <span className="min-w-24 text-sm font-medium">{api.progresso.etapa}</span>
          <Progress value={api.progresso.percentual} className="flex-1" />
          <span className="text-xs tabular-nums">{Math.round(api.progresso.percentual)}%</span>
          <Button variant="ghost" size="sm" onClick={api.cancelar}>
            <X />
            Cancelar
          </Button>
        </div>
      )}
      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <aside className="space-y-5 lg:order-last lg:max-h-[calc(100dvh-210px)] lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
          <section className="space-y-2">
            <Label htmlFor="colorir-impressora">Impressora / cores</Label>
            <select
              id="colorir-impressora"
              className="w-full rounded-xl border border-border bg-card p-3 text-sm"
              value={impressora}
              onChange={(e) => mudarImpressora(e.target.value)}
            >
              {IMPRESSORAS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </section>
          <Medida
            nome="Sensibilidade"
            valor={sens}
            min={2}
            max={20}
            step={1}
            unidade="°"
            onChange={(v) => {
              setSens(v);
              if (api.dados) api.enviar({ tipo: "segmentar", sensibilidade: v }, true);
            }}
          />
          <Ferramentas
            tool={tool}
            onTool={(t) => {
              finalizar();
              setTool(t);
            }}
            raio={raio}
            onRaio={setRaio}
            forma={forma}
            onForma={mudarForma}
            posicionada={posicionada}
            espelho={espelho}
            onEspelho={() => setEspelho(!espelho)}
            onAplicar={aplicar}
            seeds={seeds}
            onRemoveSeed={(id) => setSeeds((s) => s.filter((v) => v.id !== id))}
            onDistribuir={() => api.enviar({ tipo: "sementes", sementes: seeds }, true)}
            disabled={disabled}
          />
          <Paleta
            cores={paleta}
            quantidade={n}
            ativo={ativo}
            onAtivo={setAtivo}
            usadas={api.usadas}
            onCor={cor}
            onJuntar={(a, b) => {
              api.enviar({ tipo: "juntar", a, b }, true);
              setSeeds((s) =>
                s.map((seed) => ({ ...seed, slot: seed.slot === b ? a : seed.slot })),
              );
            }}
            disabled={disabled}
          />
          {!comparar && (
            <FotoReferencia
              url={foto}
              onUrl={setFoto}
              onCor={(c) => cor(ativo - 1, { nome: paleta[ativo - 1]?.nome ?? "", cor: c })}
              comparar={false}
            />
          )}
        </aside>
        <section className="order-first min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              title="Desfazer"
              aria-label="Desfazer"
              disabled={!api.undo || api.ocupado}
              onClick={() => api.enviar({ tipo: "historico", refazer: false })}
            >
              <Undo2 />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Refazer"
              aria-label="Refazer"
              disabled={!api.redo || api.ocupado}
              onClick={() => api.enviar({ tipo: "historico", refazer: true })}
            >
              <Redo2 />
            </Button>
            {["Frente", "Costas", "Esquerda", "Direita", "Topo"].map((v) => (
              <Button
                key={v}
                variant="ghost"
                size="sm"
                disabled={!api.dados}
                onClick={() => ver(v.toLowerCase())}
              >
                {v}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="icon"
              title="Enquadrar"
              aria-label="Enquadrar"
              disabled={!api.dados}
              onClick={() => ver("enquadrar")}
            >
              <Focus />
            </Button>
            <Button variant="outline" size="sm" disabled={!api.dados} onClick={() => ver("close")}>
              <ScanFace />
              Rosto em close
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Label className="flex items-center gap-2">
              <Switch checked={regioes} onCheckedChange={setRegioes} />
              Ver regiões
            </Label>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={comparar}
              onClick={() => {
                setComparar(!comparar);
                if (!comparar) ver("close");
              }}
            >
              <Columns2 />
              Comparar com a foto
            </Button>
            {api.dados && (
              <span className="text-xs text-muted-foreground">
                {api.dados.slots.length.toLocaleString("pt-BR")} triângulos
              </span>
            )}
          </div>
          <div
            className={cn(
              "h-[520px] min-w-0 overflow-hidden border border-border bg-card md:h-[640px] lg:h-[calc(100dvh-330px)] lg:min-h-96",
              comparar && "grid grid-cols-2",
            )}
          >
            {api.dados ? (
              <Cena
                dados={api.dados}
                paleta={paleta}
                tool={tool}
                verRegioes={regioes}
                vista={vista}
                onHit={hit}
                onFim={finalizar}
                forma={forma}
                onForma={mudarForma}
                posicionada={posicionada}
                espelho={espelho}
                seeds={seeds}
                disabled={api.ocupado}
              />
            ) : (
              <div
                className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f && !api.ocupado) void abrir(f);
                }}
              >
                <Upload className="size-12 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Escolha a peça</h2>
                <p className="text-sm text-muted-foreground">STL · até 100 MB</p>
                <Button
                  variant="outline"
                  disabled={api.ocupado}
                  onClick={() => input.current?.click()}
                >
                  Selecionar STL
                </Button>
              </div>
            )}
            {comparar && (
              <FotoReferencia
                url={foto}
                onUrl={setFoto}
                onCor={(c) => cor(ativo - 1, { nome: paleta[ativo - 1]?.nome ?? "", cor: c })}
                comparar
              />
            )}
          </div>
          {saida.aviso !== null && (
            <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              Abra no fatiador com sua impressora já selecionada e pelo menos {saida.aviso}{" "}
              filamentos. Se ele perguntar, escolha 'Importar apenas a geometria'. As cores dos
              filamentos você escolhe no fatiador: a pintura diz só qual filamento vai em cada
              parte.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
