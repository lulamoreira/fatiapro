/**
 * Central de Ajuda — catálogo (dados puros, sem I/O). Para atualizar a ajuda,
 * edite só este arquivo. Imagens ficam em /public/ajuda/.
 */

export type IconeCategoria = "rocket" | "laptop" | "smartphone" | "wand" | "wallet" | "file" | "history" | "lifebuoy" | "shield";

export interface CategoriaAjuda { id: string; titulo: string; icone: IconeCategoria }

export type RotaAjuda = "/app/baixar" | "/app/configuracoes" | "/app/nova-analise" | "/app/plano" | "/app/orcamentos" | "/termos" | "/privacidade";

export interface ArtigoAjuda {
  slug: string;
  categoria: string;
  titulo: string;
  resumo: string;
  passos: string[];
  imagem?: { src: string; alt: string; legenda: string };
  dica?: string;
  relacionados?: string[];
  botao?: { texto: string; para: RotaAjuda };
}

const img = (arquivo: string, alt: string, legenda: string) => ({ src: `/ajuda/${arquivo}`, alt, legenda });

export const CATEGORIAS_AJUDA: CategoriaAjuda[] = [
  { id: "primeiros-passos", titulo: "Primeiros passos", icone: "rocket" },
  { id: "ponte", titulo: "Instalar a ponte", icone: "laptop" },
  { id: "celular", titulo: "Usar no celular", icone: "smartphone" },
  { id: "analise", titulo: "Fazer uma análise", icone: "wand" },
  { id: "creditos", titulo: "Créditos e planos", icone: "wallet" },
  { id: "orcamentos", titulo: "Orçamentos", icone: "file" },
  { id: "historico", titulo: "Início e Histórico", icone: "history" },
  { id: "problemas", titulo: "Problemas comuns", icone: "lifebuoy" },
  { id: "privacidade", titulo: "Privacidade e segurança", icone: "shield" },
];

export const ARTIGOS_AJUDA: ArtigoAjuda[] = [
  // A. Primeiros passos
  {
    slug: "o-que-e", categoria: "primeiros-passos", titulo: "O que é o FatiaPro",
    resumo: "Ele analisa sua peça e sugere ajustes de fatiamento, testando no seu próprio fatiador.",
    passos: [
      "Você escolhe a peça e o que quer melhorar.",
      "A FatiaProAI sugere ajustes de fatiamento.",
      "Cada ajuste é testado de verdade no SEU fatiador: Bambu Studio, OrcaSlicer, Snapmaker Orca ou Anycubic Slicer Next.",
      "Você vê o resultado e decide o que usar.",
    ],
    dica: "O FatiaPro nunca envia nada para a impressora. Você decide se e quando imprimir.",
    imagem: img("como-funciona.webp", "Esquema do FatiaPro: você, a nuvem e a ponte no computador", "Como o FatiaPro trabalha"),
    relacionados: ["como-funciona", "criar-conta-teste-gratis"],
  },
  {
    slug: "como-funciona", categoria: "primeiros-passos", titulo: "Como funciona: as 3 partes",
    resumo: "Você, a nuvem do FatiaPro e a ponte no seu computador.",
    passos: [
      "Você: usa o site no celular, tablet ou computador.",
      "A nuvem do FatiaPro: guarda sua conta, créditos, histórico e recados.",
      "A ponte no seu computador: roda os fatiadores, testa e salva o arquivo.",
      "A ponte busca os pedidos na nuvem. Por isso o computador precisa estar ligado e com internet.",
    ],
    imagem: img("como-funciona.webp", "Você, a nuvem do FatiaPro e a ponte no computador", "As 3 partes do FatiaPro"),
    relacionados: ["baixar-instalar-mac", "computador-ligado"],
  },
  {
    slug: "criar-conta-teste-gratis", categoria: "primeiros-passos", titulo: "Criar conta e teste grátis",
    resumo: "Conta com e-mail e senha e 14 dias de teste grátis.",
    passos: [
      "Crie sua conta com e-mail e senha.",
      "Você ganha um teste grátis de 14 dias.",
      "No teste, dá para fazer 1 otimização por dia.",
      "A partir da 2ª otimização aparece um questionário rápido sobre a anterior.",
    ],
    imagem: img("plano-creditos.webp", "Tela Plano e créditos com o teste grátis", "O teste grátis aparece em Plano e créditos"),
    relacionados: ["o-que-e-credito"],
  },
  {
    slug: "tela-inicio", categoria: "primeiros-passos", titulo: "A tela Início",
    resumo: "Os quadrinhos mostram seus números.",
    passos: [
      "Cada quadrinho mostra um número seu.",
      "Clique em qualquer quadrinho para abrir a lista detalhada.",
      "Exemplo: \"Arquivos otimizados\" abre o Histórico já filtrado.",
    ],
    imagem: img("inicio.webp", "Tela Início com os quadrinhos", "Tela Início"),
    relacionados: ["historico-filtros"],
  },
  // B. Ponte
  {
    slug: "baixar-instalar-mac", categoria: "ponte", titulo: "Baixar e instalar no Mac",
    resumo: "Instale a ponte no seu Mac em poucos cliques.",
    passos: [
      "Vá em Configurações → \"Baixar a ponte\".",
      "Clique em \"Baixar para Mac\".",
      "Abra o arquivo baixado (pasta Downloads).",
      "Clique em Continuar e Instalar.",
      "Digite a senha do Mac quando pedir.",
    ],
    dica: "A ponte é assinada e verificada pela Apple: instala sem aviso de segurança. Ela liga sozinha quando o computador liga.",
    imagem: img("baixar-ponte.webp", "Tela Baixar a ponte", "Tela Baixar a ponte"),
    botao: { texto: "Baixar a ponte", para: "/app/baixar" },
    relacionados: ["conectar-computador", "windows"],
  },
  {
    slug: "conectar-computador", categoria: "ponte", titulo: "Conectar o computador",
    resumo: "Use o código de 6 dígitos para ligar a ponte à sua conta.",
    passos: [
      "Depois de instalar, a ponte pede um código.",
      "No site, vá em Configurações → \"Conectar computador\".",
      "Aparece um código de 6 dígitos. Ele vale 10 minutos.",
      "Digite o código na janela da ponte.",
      "Pronto: o computador aparece como Conectado.",
    ],
    imagem: img("conectar-computador.webp", "Código de 6 dígitos para conectar o computador", "Código para conectar"),
    botao: { texto: "Ir para Configurações", para: "/app/configuracoes" },
    relacionados: ["computador-conectado", "computador-desconectado"],
  },
  {
    slug: "computador-conectado", categoria: "ponte", titulo: "Seu computador em Configurações",
    resumo: "Veja a ponte, os fatiadores, a pasta dos arquivos e escolha suas impressoras.",
    passos: [
      "Em Configurações você vê o computador e a versão da ponte.",
      "Veja os fatiadores que a ponte encontrou.",
      "Veja a pasta onde os arquivos otimizados são salvos. O padrão é Documentos/FatiaPro, e dá para trocar.",
      "Em \"Minhas impressoras\", marque as suas. Só elas aparecem na Nova análise.",
    ],
    imagem: img("computador-conectado.webp", "Computador conectado em Configurações", "Computador conectado"),
    relacionados: ["atualizacoes-automaticas", "desinstalar"],
  },
  {
    slug: "atualizacoes-automaticas", categoria: "ponte", titulo: "Atualizações automáticas",
    resumo: "A ponte se atualiza sozinha.",
    passos: [
      "A ponte procura versão nova sozinha, a cada 15 minutos.",
      "Ela se atualiza sem você fazer nada.",
      "Nunca atualiza no meio de uma análise.",
    ],
    relacionados: ["chaves-no-seu-computador"],
  },
  {
    slug: "windows", categoria: "ponte", titulo: "E no Windows?",
    resumo: "Em breve.",
    passos: ["A ponte para Windows está chegando.", "Por enquanto, a ponte é só para Mac."],
    relacionados: ["baixar-instalar-mac"],
  },
  {
    slug: "desinstalar", categoria: "ponte", titulo: "Desinstalar a ponte",
    resumo: "Desconecte no site e apague o app do Mac.",
    passos: [
      "No site, vá em Configurações.",
      "No menu \"⋯\" do computador, escolha \"Desconectar computador\".",
      "No Mac, apague \"FatiaPro Ponte\" da pasta Aplicativos.",
    ],
    relacionados: ["conectar-computador"],
  },
  // C. Celular
  {
    slug: "instalar-tela-inicio", categoria: "celular", titulo: "Colocar o FatiaPro na tela do celular",
    resumo: "Use como um app, direto da tela de início.",
    passos: [
      "iPhone ou iPad: abra o site no Safari.",
      "Toque em Compartilhar → \"Adicionar à Tela de Início\".",
      "Android: no Chrome, toque em \"Instalar app\".",
      "Na primeira vez, entre de novo com e-mail e senha.",
    ],
    imagem: img("celular.webp", "FatiaPro aberto no celular", "FatiaPro no celular"),
    relacionados: ["computador-ligado"],
  },
  {
    slug: "computador-ligado", categoria: "celular", titulo: "O computador precisa estar ligado",
    resumo: "O celular é o controle remoto. Quem trabalha é o computador.",
    passos: [
      "Quem faz a análise é o computador com a ponte.",
      "Ele precisa estar ligado, acordado e com internet.",
      "Confira a bolinha verde \"Conectado\".",
      "Se o computador estiver dormindo, o pedido espera e roda quando ele acordar.",
    ],
    relacionados: ["computador-desconectado", "como-funciona"],
  },
  {
    slug: "mandar-peca-pelo-celular", categoria: "celular", titulo: "Mandar a peça pelo celular",
    resumo: "Envie um arquivo ou escolha da Biblioteca.",
    passos: [
      "Envie um arquivo .stl, .3mf ou .step do celular (até 100 MB).",
      "Ou escolha uma peça da Biblioteca.",
      "\"Usar a peça aberta no fatiador\" pega a peça aberta na tela do COMPUTADOR.",
    ],
    relacionados: ["escolher-peca"],
  },
  {
    slug: "onde-fica-o-arquivo", categoria: "celular", titulo: "Onde fica o arquivo otimizado",
    resumo: "No computador, na pasta escolhida.",
    passos: [
      "O arquivo otimizado é salvo no computador, na pasta escolhida.",
      "Pelo celular, você vê o resultado.",
      "Se guardou na Biblioteca, pode baixar a cópia.",
    ],
    imagem: img("analise-resultado.webp", "Resultado de uma análise", "Resultado da análise"),
    relacionados: ["resultado-arquivo", "repetir-e-modelos"],
  },
  // D. Análise
  {
    slug: "escolher-roteiro", categoria: "analise", titulo: "Escolher o que fazer",
    resumo: "Quatro opções, cada uma para um objetivo.",
    passos: [
      "Configurar a peça: orientação, suporte, paredes e camada.",
      "Reduzir tempo: sem piorar o que o cliente vê.",
      "Conferir antes de imprimir: checklist de ok e atenção. Grátis.",
      "Preço de venda: custos e 3 sugestões de preço. Grátis.",
    ],
    imagem: img("nova-analise-roteiro.webp", "Escolha do roteiro na Nova análise", "Nova análise: escolher o roteiro"),
    botao: { texto: "Nova análise", para: "/app/nova-analise" },
    relacionados: ["escolher-peca", "impressora-material-objetivo"],
  },
  {
    slug: "escolher-peca", categoria: "analise", titulo: "Escolher a peça",
    resumo: "Envie um arquivo, use a peça aberta no fatiador ou escolha da Biblioteca.",
    passos: [
      "Enviar arquivo: escolha o arquivo da peça.",
      "Usar a peça aberta no fatiador: deixe a peça aberta e SALVA (⌘S).",
      "Escolher da biblioteca: use uma peça que você já guardou.",
    ],
    dica: "Salve no fatiador (⌘S) antes de pedir: assim a análise usa a versão mais nova.",
    imagem: img("nova-analise-roteiro.webp", "Escolha da peça na Nova análise", "Nova análise: escolher a peça"),
    relacionados: ["peca-aberta-nao-encontrada", "mandar-peca-pelo-celular"],
  },
  {
    slug: "impressora-material-objetivo", categoria: "analise", titulo: "Impressora, material e objetivo",
    resumo: "Diga onde vai imprimir, com o quê e para quê.",
    passos: [
      "Escolha o fatiador, a impressora e o bico.",
      "Escolha o filamento: tipo, marca e linha.",
      "Diga para que serve: Decorativa, Uso mecânico ou Venda em lote.",
      "Escolha até 2 prioridades: Tempo, Acabamento ou Resistência.",
    ],
    dica: "Análise Premium: mais caprichada. Usa 2 créditos.",
    imagem: img("nova-analise-impressora.webp", "Impressora e material na Nova análise", "Impressora e material"),
    relacionados: ["o-que-e-credito", "computador-conectado"],
  },
  {
    slug: "acompanhar-e-aprovar", categoria: "analise", titulo: "Acompanhar e aprovar",
    resumo: "Veja cada teste e aprove só o que quiser.",
    passos: [
      "A linha do tempo mostra cada teste que a ponte faz no fatiador.",
      "No fim aparece a PROPOSTA com as mudanças.",
      "Cada mudança mostra o tempo e o material.",
      "Você aprova (ou não). Só então a ponte aplica e salva o arquivo.",
      "Dá para cancelar antes.",
    ],
    imagem: img("analise-andamento.webp", "Análise em andamento com a linha do tempo", "Análise em andamento"),
    relacionados: ["resultado-arquivo", "credito-volta"],
  },
  {
    slug: "resultado-arquivo", categoria: "analise", titulo: "O resultado e o arquivo",
    resumo: "Tempo e gramas reais, mudanças e riscos.",
    passos: [
      "Veja o resultado real: tempo e gramas.",
      "Veja a tabela das mudanças, aplicadas ou não.",
      "Veja os riscos.",
      "Use os botões Abrir pasta, Abrir no fatiador ou Copiar caminho.",
    ],
    imagem: img("analise-resultado.webp", "Resultado de uma análise", "Resultado da análise"),
    relacionados: ["repetir-e-modelos", "onde-fica-o-arquivo"],
  },
  {
    slug: "repetir-e-modelos", categoria: "analise", titulo: "Repetir, modelos e biblioteca",
    resumo: "Reaproveite escolhas e peças.",
    passos: [
      "\"Repetir\" refaz com as mesmas escolhas.",
      "\"Salvar como modelo\" guarda as escolhas. Depois, use \"Usar um modelo\".",
      "\"Salvar na biblioteca\" guarda a peça.",
    ],
    relacionados: ["escolher-peca"],
  },
  // E. Créditos
  {
    slug: "o-que-e-credito", categoria: "creditos", titulo: "O que é um crédito",
    resumo: "1 crédito = 1 otimização.",
    passos: [
      "1 crédito = 1 otimização (Configurar a peça ou Reduzir tempo).",
      "A análise Premium usa 2 créditos.",
      "Checklist e Preço de venda são grátis, com limite por dia.",
      "Os créditos que vencem antes são usados primeiro.",
    ],
    imagem: img("plano-creditos.webp", "Tela Plano e créditos", "Plano e créditos"),
    botao: { texto: "Ver Plano e créditos", para: "/app/plano" },
    relacionados: ["comprar-creditos", "validade-e-cupom", "credito-volta"],
  },
  {
    slug: "comprar-creditos", categoria: "creditos", titulo: "Comprar créditos",
    resumo: "Pacotes pagos pelo Mercado Pago.",
    passos: [
      "Vá em Plano e créditos e escolha um pacote.",
      "Pague pelo Mercado Pago com Pix, cartão ou saldo Mercado Pago. Não tem boleto.",
      "O crédito entra sozinho quando o pagamento é aprovado.",
    ],
    imagem: img("comprar-creditos.webp", "Pacotes de créditos", "Comprar créditos"),
    botao: { texto: "Comprar créditos", para: "/app/plano" },
    relacionados: ["pagamento-nao-apareceu", "vendas-pausadas"],
  },
  {
    slug: "validade-e-cupom", categoria: "creditos", titulo: "Validade e cupom",
    resumo: "Quanto tempo os créditos valem e como usar cupom.",
    passos: [
      "Créditos comprados valem 12 meses.",
      "Créditos de cupom ou cortesia valem o prazo informado (em geral 90 dias).",
      "Para usar um cupom, digite o código em \"Tenho um cupom\".",
    ],
    relacionados: ["o-que-e-credito"],
  },
  {
    slug: "credito-volta", categoria: "creditos", titulo: "Quando o crédito volta",
    resumo: "Em caso de erro do sistema ou cancelamento antes da proposta.",
    passos: [
      "Se a análise falhar por erro do sistema, o crédito volta sozinho.",
      "Se você cancelar antes da proposta, o crédito também volta.",
    ],
    relacionados: ["analise-com-erro"],
  },
  {
    slug: "vendas-pausadas", categoria: "creditos", titulo: "Vendas pausadas",
    resumo: "Às vezes as compras podem ficar pausadas.",
    passos: [
      "Os pacotes aparecem apagados, com um aviso.",
      "Seus créditos, cupons e o teste grátis continuam valendo.",
    ],
    relacionados: ["validade-e-cupom"],
  },
  {
    slug: "reembolso", categoria: "creditos", titulo: "Reembolso",
    resumo: "Até 7 dias da compra.",
    passos: [
      "Você pode pedir reembolso até 7 dias depois da compra, se os créditos não foram usados.",
      "Se usou parte, o reembolso é proporcional.",
      "Peça pelo e-mail de contato que está nos Termos de uso.",
    ],
    botao: { texto: "Ver os Termos", para: "/termos" },
    relacionados: ["comprar-creditos"],
  },
  // F. Orçamentos
  {
    slug: "meu-negocio", categoria: "orcamentos", titulo: "Dados do seu negócio",
    resumo: "Eles aparecem no cabeçalho do orçamento.",
    passos: [
      "Vá em Configurações → Meu negócio.",
      "Preencha nome, CPF/CNPJ, e-mail, WhatsApp e cidade.",
      "Envie seu logo.",
      "Tudo isso aparece no cabeçalho do orçamento.",
    ],
    imagem: img("meu-negocio.webp", "Formulário Meu negócio", "Meu negócio"),
    relacionados: ["gerar-orcamento"],
  },
  {
    slug: "preco-de-venda", categoria: "orcamentos", titulo: "Preço de venda",
    resumo: "Seu custo por unidade e sugestões de preço.",
    passos: [
      "O roteiro Preço de venda calcula seu custo por unidade.",
      "Ele sugere preço mínimo, justo e premium.",
      "Também mostra descontos por quantidade.",
    ],
    imagem: img("preco-resultado.webp", "Resultado do Preço de venda", "Preço de venda"),
    relacionados: ["gerar-orcamento"],
  },
  {
    slug: "gerar-orcamento", categoria: "orcamentos", titulo: "Gerar orçamento em PDF",
    resumo: "A partir do resultado do Preço de venda.",
    passos: [
      "No resultado do Preço de venda, clique em \"Gerar orçamento em PDF\".",
      "Preencha cliente, quantidade e preço. O desconto por quantidade entra sozinho.",
      "Preencha prazo, validade e forma de pagamento.",
      "Se quiser, adicione uma foto.",
    ],
    dica: "Se o preço ficar abaixo do seu custo, aparece um aviso. Ele só aparece na tela, nunca no PDF.",
    imagem: img("orcamento-formulario.webp", "Formulário do orçamento", "Formulário do orçamento"),
    relacionados: ["pdf-e-status", "meu-negocio"],
  },
  {
    slug: "pdf-e-status", categoria: "orcamentos", titulo: "O PDF e o status",
    resumo: "Mande ao cliente e marque o andamento.",
    passos: [
      "O PDF mostra só o preço final. Nunca mostra custo ou margem.",
      "Os orçamentos são numerados: ORC-0001, ORC-0002…",
      "Mande ao cliente pelo WhatsApp ou e-mail.",
      "Na tela Orçamentos, marque Enviado, Aprovado ou Recusado.",
    ],
    imagem: img("orcamento-pdf.webp", "Orçamento em PDF", "Orçamento em PDF"),
    botao: { texto: "Ver orçamentos", para: "/app/orcamentos" },
    relacionados: ["gerar-orcamento"],
  },
  // G. Histórico
  {
    slug: "historico-filtros", categoria: "historico", titulo: "Histórico e filtros",
    resumo: "Todas as suas análises, com filtros.",
    passos: [
      "Cada linha mostra a peça e o que você pediu: roteiro, para que serve, prioridades, impressora e material.",
      "Clicar nos quadrinhos do Início abre o Histórico filtrado.",
      "\"Limpar filtros\" volta a mostrar tudo.",
    ],
    imagem: img("historico.webp", "Tela Histórico", "Histórico"),
    relacionados: ["tela-inicio"],
  },
  // H. Problemas
  {
    slug: "computador-desconectado", categoria: "problemas", titulo: "Computador desconectado",
    resumo: "O que fazer quando a bolinha não está verde.",
    passos: [
      "Verifique se o computador está ligado e com internet.",
      "Se a ponte foi fechada, ela volta ao reiniciar o computador.",
      "Ainda desconectado? Conecte de novo com o código.",
    ],
    relacionados: ["conectar-computador", "computador-ligado"],
  },
  {
    slug: "peca-aberta-nao-encontrada", categoria: "problemas", titulo: "Peça aberta não encontrada",
    resumo: "Quando a ponte não acha a peça no fatiador.",
    passos: [
      "Abra o fatiador com a peça na mesa.",
      "Salve o projeto.",
      "Ou envie o arquivo pela Nova análise.",
    ],
    relacionados: ["escolher-peca"],
  },
  {
    slug: "analise-com-erro", categoria: "problemas", titulo: "Análise com erro",
    resumo: "Veja a mensagem e tente de novo.",
    passos: [
      "Abra a análise.",
      "Leia a última mensagem da linha do tempo.",
      "Tente de novo.",
      "Se foi erro do sistema, o crédito volta.",
    ],
    relacionados: ["credito-volta"],
  },
  {
    slug: "pagamento-nao-apareceu", categoria: "problemas", titulo: "Paguei e o crédito não apareceu",
    resumo: "O app confere sozinho com o Mercado Pago.",
    passos: [
      "Volte para Plano e créditos. O app confere sozinho com o Mercado Pago.",
      "Pix pode levar alguns minutos.",
      "Pedidos não pagos em 3 horas viram \"Expirado\". Nada é cobrado.",
    ],
    botao: { texto: "Ver Plano e créditos", para: "/app/plano" },
    relacionados: ["comprar-creditos"],
  },
  // I. Privacidade
  {
    slug: "o-que-vai-para-a-ia", categoria: "privacidade", titulo: "O que vai para a IA",
    resumo: "Só o necessário para a análise.",
    passos: [
      "Vai só o necessário: configurações, medidas da peça e resultados dos testes.",
      "Nunca vai seu nome, e-mail ou dados de pagamento.",
    ],
    botao: { texto: "Política de privacidade", para: "/privacidade" },
    relacionados: ["nada-vai-para-a-impressora"],
  },
  {
    slug: "nada-vai-para-a-impressora", categoria: "privacidade", titulo: "Nada vai para a impressora",
    resumo: "O FatiaPro nunca imprime.",
    passos: ["O FatiaPro nunca imprime.", "Ele nunca envia arquivos para a impressora."],
    relacionados: ["o-que-e"],
  },
  {
    slug: "chaves-no-seu-computador", categoria: "privacidade", titulo: "Chaves no seu computador",
    resumo: "Guardadas no Chaveiro do Mac.",
    passos: [
      "A ponte guarda as chaves no Chaveiro do Mac.",
      "Atualizações só são aceitas se assinadas pelo FatiaPro.",
    ],
    relacionados: ["atualizacoes-automaticas"],
  },
];

/** Artigo de cada botão "?" das telas. */
export const AJUDA_DA_TELA = {
  inicio: "tela-inicio",
  novaAnalise: "escolher-roteiro",
  analise: "acompanhar-e-aprovar",
  historico: "historico-filtros",
  biblioteca: "repetir-e-modelos",
  orcamentos: "gerar-orcamento",
  plano: "o-que-e-credito",
  configuracoes: "computador-conectado",
  baixar: "baixar-instalar-mac",
} as const;

export const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Busca sem acento e sem diferenciar maiúsculas em título, resumo e passos. */
export function buscarArtigos(termo: string, artigos: readonly ArtigoAjuda[] = ARTIGOS_AJUDA): ArtigoAjuda[] {
  const t = normalizar(termo);
  if (!t) return [...artigos];
  const palavras = t.split(/\s+/);
  return artigos.filter((a) => {
    const texto = normalizar([a.titulo, a.resumo, ...a.passos].join(" "));
    return palavras.every((p) => texto.includes(p));
  });
}

export const artigoPorSlug = (slug: string | undefined) => ARTIGOS_AJUDA.find((a) => a.slug === slug);

/** Lê ?artigo= — só aceita slugs que existem. */
export function lerBuscaAjuda(s: Record<string, unknown>): { artigo?: string } {
  const a = s["artigo"];
  return typeof a === "string" && artigoPorSlug(a) ? { artigo: a } : {};
}
