export interface EventoProgresso {
  tipo: string;
  conteudo: unknown;
  criado_em: string;
}

export interface TesteAoVivo {
  id: string;
  titulo?: string;
  grupo?: string;
  estado: "fatiando" | "pronto" | "falhou" | "escolhido";
  atual?: boolean;
  segundos?: number;
  gramas?: number;
  suporte_g?: number;
  imagem?: string;
  erro?: string;
}

export interface GrupoTestes {
  grupo: string;
  testes: TesteAoVivo[];
}

function registro(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

/** Incremental bridge payloads preserve earlier fields; invalid fields never erase them. */
export function testesDaFase(eventos: EventoProgresso[], fase: string): GrupoTestes[] {
  const ordenados = [...eventos].sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em));
  const marcador = fase === "aplicando" ? "aprovacao" : "pedido_outra";
  let inicio = 0;
  for (let i = ordenados.length - 1; i >= 0; i--) {
    if (ordenados[i]?.tipo === marcador) { inicio = i + 1; break; }
  }
  const testes = new Map<string, TesteAoVivo>();
  const grupos = new Map<string, true>();
  for (const evento of ordenados.slice(inicio)) {
    if (evento.tipo !== "progresso" || !registro(evento.conteudo)) continue;
    const valor = evento.conteudo["teste"];
    if (!registro(valor) || typeof valor["id"] !== "string" || !valor["id"].trim()) continue;
    const anterior = testes.get(valor["id"]);
    const estado = valor["estado"];
    const valido = estado === "fatiando" || estado === "pronto" || estado === "falhou" || estado === "escolhido";
    if (!anterior && !valido) continue;
    const teste: TesteAoVivo = anterior ? { ...anterior } : { id: valor["id"], estado: "fatiando" };
    if (valido) teste.estado = estado;
    for (const chave of ["titulo", "grupo", "erro"] as const) {
      if (typeof valor[chave] === "string" && valor[chave].trim()) teste[chave] = valor[chave].trim();
    }
    for (const chave of ["segundos", "gramas", "suporte_g"] as const) {
      const numero = valor[chave];
      if (typeof numero === "number" && Number.isFinite(numero) && numero >= 0) teste[chave] = numero;
    }
    if (typeof valor["atual"] === "boolean") teste.atual = valor["atual"];
    if (typeof valor["imagem"] === "string" && valor["imagem"].startsWith("data:image/png;base64,")) teste.imagem = valor["imagem"];
    testes.set(teste.id, teste);
    grupos.set(teste.grupo ?? "Ajustes", true);
  }
  return [...grupos.keys()].map((grupo) => ({
    grupo, testes: [...testes.values()].filter((teste) => (teste.grupo ?? "Ajustes") === grupo),
  })).filter((grupo) => grupo.testes.length > 0);
}

export function textoProgresso(evento: EventoProgresso): string | null {
  if (evento.tipo !== "progresso" || !evento.conteudo || typeof evento.conteudo !== "object") return null;
  const texto = (evento.conteudo as { texto?: unknown }).texto;
  return typeof texto === "string" && texto.trim() ? texto.trim() : null;
}

/** Percentages never become messages; the latest phase boundary excludes old values. */
export function progressoDaFase<T extends EventoProgresso>(
  eventos: T[], fase: string, inicio: string, pendenteAt?: number,
) {
  const marcador = fase === "aplicando" ? "aprovacao" : "pedido_outra";
  let inicioIndice = 0;
  let inicioMs = Date.parse(inicio);
  for (let i = eventos.length - 1; i >= 0; i--) {
    const evento = eventos[i];
    if (evento?.tipo === marcador) {
      inicioIndice = i + 1;
      inicioMs = Date.parse(evento.criado_em);
      break;
    }
  }
  if (pendenteAt != null) inicioMs = Math.max(inicioMs, pendenteAt);
  let percentual: number | null = null;
  if (fase !== "na_fila") {
    for (const evento of eventos.slice(inicioIndice)) {
      if (evento.tipo !== "progresso" || Date.parse(evento.criado_em) < inicioMs || !evento.conteudo || typeof evento.conteudo !== "object") continue;
      const valor = (evento.conteudo as { percentual?: unknown }).percentual;
      if (typeof valor === "number" && Number.isFinite(valor) && valor >= 0 && valor <= 100) percentual = valor;
    }
  }
  const mensagens = eventos.filter((evento) => textoProgresso(evento) !== null);
  return { mensagens, percentual, inicioMs };
}