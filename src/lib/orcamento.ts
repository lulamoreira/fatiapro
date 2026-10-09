/**
 * Pure quote (orçamento) rules. The customer-facing text is built here so tests can prove
 * it never leaks internal numbers (cost, margin, minimum price).
 */

export interface FaixaDesconto { a_partir_de: number; desconto_pct?: number | undefined; preco_unitario: number }
export interface Precos {
  quantidade: number;
  /** Internal only — used to warn the user, never printed. */
  custo_unitario: number | null;
  minimo: number | null;
  justo: number | null;
  premium: number | null;
  descontos: FaixaDesconto[];
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** "R$ 1.234,56" → 1234.56; null when no money value is found. */
export function lerReais(txt: unknown): number | null {
  if (typeof txt === "number") return num(txt);
  if (typeof txt !== "string") return null;
  const m = txt.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/);
  if (!m) return null;
  const v = Number(m[1]!.replace(/\./g, "") + "." + (m[2] ?? "0"));
  return num(v);
}

/** Reads `conteudo.precos`, falling back to the text table of older analyses. */
export function lerPrecos(conteudo: unknown): Precos | null {
  if (!conteudo || typeof conteudo !== "object") return null;
  const c = conteudo as { precos?: unknown; tabela?: { linhas?: unknown } };
  if (c.precos && typeof c.precos === "object") {
    const p = c.precos as Record<string, unknown>;
    const descontos = Array.isArray(p["descontos"])
      ? (p["descontos"] as Record<string, unknown>[])
          .map((d) => ({ a_partir_de: Number(d["a_partir_de"]), desconto_pct: num(d["desconto_pct"]) ?? undefined, preco_unitario: num(d["preco_unitario"]) ?? 0 }))
          .filter((d) => Number.isInteger(d.a_partir_de) && d.a_partir_de > 0 && d.preco_unitario > 0)
      : [];
    return {
      quantidade: Math.max(1, Math.floor(num(p["quantidade"]) ?? 1)),
      custo_unitario: num(p["custo_unitario"]), minimo: num(p["minimo"]), justo: num(p["justo"]), premium: num(p["premium"]), descontos,
    };
  }
  const linhas = c.tabela?.linhas;
  if (!Array.isArray(linhas)) return null;
  const r: Precos = { quantidade: 1, custo_unitario: null, minimo: null, justo: null, premium: null, descontos: [] };
  for (const l of linhas) {
    if (!Array.isArray(l) || l.length < 2) continue;
    const rot = String(l[0]).toLowerCase();
    const v = lerReais(l[1]);
    if (v == null) continue;
    if (rot.includes("preço mínimo") || rot.includes("preco minimo")) r.minimo = v;
    else if (rot.includes("preço justo") || rot.includes("preco justo")) r.justo = v;
    else if (rot.includes("preço premium") || rot.includes("preco premium")) r.premium = v;
    else {
      const m = rot.match(/a partir de\s+(\d+)/);
      if (m) r.descontos.push({ a_partir_de: Number(m[1]), preco_unitario: v });
    }
  }
  return r.minimo || r.justo || r.premium || r.descontos.length ? r : null;
}

/** Largest discount tier whose threshold is ≤ quantity. */
export function faixaDesconto(descontos: FaixaDesconto[], quantidade: number): FaixaDesconto | null {
  let melhor: FaixaDesconto | null = null;
  for (const d of descontos) if (d.a_partir_de <= quantidade && (!melhor || d.a_partir_de > melhor.a_partir_de)) melhor = d;
  return melhor;
}

export const paraCentavos = (reais: number) => Math.round(reais * 100);
export const totalCentavos = (quantidade: number, unitarioCentavos: number) => quantidade * unitarioCentavos;
export const brl = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const numeroOrc = (n: number) => `ORC-${String(n).padStart(4, "0")}`;
export const dataBR = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

export function slugCliente(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "cliente";
}
export const nomeArquivoOrc = (numero: number, cliente: string) => `${numeroOrc(numero)}-${slugCliente(cliente)}.pdf`;

export const FORMAS_PAGAMENTO = ["Pix", "Cartão", "Dinheiro", "Boleto", "A combinar"] as const;

export interface NegocioDados { nome: string; documento: string | null; email: string | null; whatsapp: string | null; cidade: string | null }
export interface OrcamentoDados {
  numero: number; criado_em: string; cliente_nome: string; cliente_contato: string | null; descricao: string;
  quantidade: number; preco_unitario_centavos: number; total_centavos: number; prazo_entrega: string | null;
  validade_dias: number; forma_pagamento: string | null; observacoes: string | null;
}

/** Everything the PDF prints, as plain text blocks. Only final prices — by construction. */
export function conteudoPdf(n: NegocioDados, o: OrcamentoDados) {
  const emissao = new Date(o.criado_em);
  const validade = new Date(emissao.getTime() + o.validade_dias * 86400000);
  return {
    negocio: [n.nome, n.documento, n.email, n.whatsapp, n.cidade].filter((x): x is string => !!x && !!x.trim()),
    titulo: `ORÇAMENTO ${numeroOrc(o.numero)}`,
    emissao: `Emissão: ${dataBR(emissao)}`,
    valido: `Válido até ${dataBR(validade)}`,
    para: [o.cliente_nome, o.cliente_contato].filter((x): x is string => !!x),
    cabecalho: ["Descrição", "Qtd", "Valor unitário", "Total"],
    linha: [o.descricao, String(o.quantidade), brl(o.preco_unitario_centavos), brl(o.total_centavos)],
    total: `TOTAL ${brl(o.total_centavos)}`,
    condicoes: [
      o.prazo_entrega ? `Prazo de entrega: ${o.prazo_entrega}` : null,
      o.forma_pagamento ? `Forma de pagamento: ${o.forma_pagamento}` : null,
      `Validade: ${o.validade_dias} ${o.validade_dias === 1 ? "dia" : "dias"} (até ${dataBR(validade)})`,
      o.observacoes ? `Observações: ${o.observacoes}` : null,
    ].filter((x): x is string => !!x),
    rodape: "Orçamento gerado com FatiaPro",
  };
}
