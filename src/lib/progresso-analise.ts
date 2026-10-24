export interface EventoProgresso {
  tipo: string;
  conteudo: unknown;
  criado_em: string;
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