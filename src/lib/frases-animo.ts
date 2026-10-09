export const FRASES_ANIMO: readonly string[] = [
  "Calma que vai valer a pena: peça bem fatiada é peça bem impressa.",
  "Testando cada ajuste no seu fatiador para você não desperdiçar filamento.",
  "Enquanto isso, a FatiaProAI está fazendo as contas que você faria na mão.",
  "Cada minuto aqui pode economizar horas na impressora.",
  "Melhor esperar um pouquinho agora do que tirar uma peça torta da mesa depois.",
  "Seu filamento agradece: estamos procurando o jeito mais esperto de imprimir.",
  "Quase lá! A FatiaProAI está conferindo os detalhes que fazem a diferença.",
  "Paciência de maker: a peça perfeita começa no fatiamento.",
  "Comparando os testes para escolher o melhor resultado para a sua peça.",
  "Pode pegar um café: quando você voltar, a sugestão vai estar pronta.",
];

export const INICIO_ANIMO_MS = 20_000;
export const TROCA_ANIMO_MS = 30_000;

export function podeMostrarAnimo(estado: string, interrompida: boolean): boolean {
  return !interrompida && ["na_fila", "analisando", "aplicando"].includes(estado);
}

/** Each bag exhausts every phrase; its first item cannot match the last bag's final item. */
export function criarSequenciaAnimo(random: () => number = Math.random): () => string {
  let fila: string[] = [];
  let anterior: string | undefined;
  return () => {
    if (fila.length === 0) {
      fila = [...FRASES_ANIMO];
      for (let i = fila.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const atual = fila[i];
        const outra = fila[j];
        if (atual !== undefined && outra !== undefined) {
          fila[i] = outra;
          fila[j] = atual;
        }
      }
      if (fila[0] === anterior && fila.length > 1) {
        const primeira = fila.shift();
        if (primeira !== undefined) fila.push(primeira);
      }
    }
    const frase = fila.shift() ?? "";
    anterior = frase;
    return frase;
  };
}