// Texto legal fornecido pelo dono, versão 1.0 — não editar o conteúdo.
export interface SecaoLegal { n: number; titulo: string; texto: string }
export const TERMOS_TITULO = "Termos de Uso do FatiaPro";
export const TERMOS_SECOES: SecaoLegal[] = [
 {
  "n": 1,
  "titulo": "Quem somos",
  "texto": "O FatiaPro é um serviço de Luis Alberto Moreira ME, CNPJ 11.968.624/0001-13 (\"FatiaPro\", \"nós\"). Contato: quitanda3d@gmail.com."
 },
 {
  "n": 2,
  "titulo": "O que é o serviço",
  "texto": "O FatiaPro analisa peças para impressão 3D e sugere ajustes de fatiamento com a ajuda de inteligência artificial (FatiaProAI). As análises são feitas por um programa instalado no seu computador (\"ponte\"), que usa os fatiadores já instalados nele (como Bambu Studio, OrcaSlicer, Snapmaker Orca e Anycubic Slicer Next). O FatiaPro NUNCA envia nada para a sua impressora: você decide se e quando imprimir."
 },
 {
  "n": 3,
  "titulo": "Conta",
  "texto": "Você precisa ter 18 anos ou mais e informar dados verdadeiros. A conta é pessoal; você é responsável pelo que acontece nela e por manter sua senha segura."
 },
 {
  "n": 4,
  "titulo": "Ponte no seu computador",
  "texto": "Ao instalar a ponte, você autoriza que ela leia os perfis e projetos dos fatiadores, gere arquivos de teste e grave o arquivo otimizado na pasta escolhida. A ponte se atualiza sozinha apenas com versões assinadas digitalmente pelo FatiaPro."
 },
 {
  "n": 5,
  "titulo": "Resultados são sugestões",
  "texto": "Tempos, gramas e recomendações são estimativas dos próprios fatiadores e da FatiaProAI. Resultados reais variam conforme impressora, filamento, calibração e ambiente. Revise as mudanças antes de imprimir. Não garantimos qualidade, resistência ou adequação da peça impressa a um uso específico."
 },
 {
  "n": 6,
  "titulo": "Créditos",
  "texto": "1 crédito = 1 otimização (Reduzir tempo ou Configuração geral); a análise Premium usa 2 créditos. Checklist e Preço de venda não usam créditos, com limite diário. Créditos comprados valem 12 meses; créditos de cupom ou cortesia valem o prazo informado (em geral 90 dias). O consumo usa primeiro os créditos que vencem antes. Créditos não têm valor em dinheiro e não podem ser transferidos."
 },
 {
  "n": 7,
  "titulo": "Falhas",
  "texto": "Se uma análise falhar por erro do sistema ou for cancelada antes da proposta, o crédito volta automaticamente."
 },
 {
  "n": 8,
  "titulo": "Arrependimento e reembolso",
  "texto": "Você pode desistir de uma compra em até 7 dias da confirmação do pagamento (art. 49 do Código de Defesa do Consumidor) e receber o valor de volta, desde que os créditos daquela compra não tenham sido usados; se parte foi usada, devolvemos a parte proporcional não usada. Peça pelo e-mail quitanda3d@gmail.com. Fora desse prazo, créditos não são reembolsáveis, salvo exigência legal."
 },
 {
  "n": 9,
  "titulo": "Pagamentos",
  "texto": "Os pagamentos são processados pelo Mercado Pago. Não recebemos nem guardamos dados do seu cartão. Em caso de estorno ou contestação, os créditos correspondentes ainda não usados são removidos."
 },
 {
  "n": 10,
  "titulo": "Teste grátis",
  "texto": "Novas contas têm 14 dias de teste com 1 otimização por dia. O teste é um por pessoa e por computador; criar contas para repetir o teste não é permitido. No teste pedimos que você responda um breve questionário sobre a otimização anterior."
 },
 {
  "n": 11,
  "titulo": "Uso proibido",
  "texto": "Não é permitido: burlar limites, créditos ou o teste grátis; usar o serviço para fins ilegais; tentar acessar dados de outras pessoas; copiar, revender ou fazer engenharia reversa do serviço ou da ponte; sobrecarregar ou atacar o sistema. Podemos suspender contas que descumpram estes termos."
 },
 {
  "n": 12,
  "titulo": "Seus arquivos",
  "texto": "As peças e projetos que você envia continuam sendo seus. Você nos autoriza a processá-los apenas para prestar o serviço (analisar, testar, guardar a cópia na sua conta). Você declara ter direito de usar os arquivos que envia."
 },
 {
  "n": 13,
  "titulo": "Disponibilidade",
  "texto": "Trabalhamos para manter o serviço no ar, mas ele pode ter interrupções, inclusive por falhas de terceiros (hospedagem, provedor de IA, Mercado Pago). Podemos mudar funcionalidades, preços e pacotes para novas compras, sem afetar créditos já comprados."
 },
 {
  "n": 14,
  "titulo": "Responsabilidade",
  "texto": "Na medida permitida pela lei, o FatiaPro não responde por perdas de filamento, tempo de máquina, danos a impressoras ou lucros cessantes decorrentes do uso das sugestões. Isso não limita seus direitos como consumidor."
 },
 {
  "n": 15,
  "titulo": "Encerramento",
  "texto": "Você pode excluir sua conta a qualquer momento pelo e-mail de contato. Créditos não usados de compras fora do prazo de arrependimento não são reembolsados no encerramento."
 },
 {
  "n": 16,
  "titulo": "Alterações",
  "texto": "Podemos atualizar estes termos; avisaremos no app e pediremos novo aceite quando a mudança for relevante."
 },
 {
  "n": 17,
  "titulo": "Lei e foro",
  "texto": "Valem as leis do Brasil. Fica eleito o foro do domicílio do consumidor."
 }
];
export const PRIVACIDADE_TITULO = "Política de Privacidade do FatiaPro";
export const PRIVACIDADE_SECOES: SecaoLegal[] = [
 {
  "n": 1,
  "titulo": "Controlador",
  "texto": "Luis Alberto Moreira ME, CNPJ 11.968.624/0001-13. Canal de privacidade e encarregado: quitanda3d@gmail.com."
 },
 {
  "n": 2,
  "titulo": "Dados que tratamos",
  "texto": "(a) Conta: nome, e-mail e senha (guardada de forma protegida). (b) Uso: análises feitas, configurações escolhidas, resultados, créditos e extrato, respostas ao questionário do teste. (c) Arquivos: peças e projetos que você envia ou que a ponte lê do fatiador para a análise, e o arquivo otimizado quando você escolhe guardar uma cópia na sua conta. (d) Computador: nome do computador, sistema, versão da ponte, fatiadores e perfis instalados, pasta de saída e um identificador anônimo do computador (código derivado do hardware, que não revela quem você é), usado para impedir repetição do teste grátis. (e) Pagamentos: valor, pacote, situação e identificador do pagamento no Mercado Pago (não recebemos dados de cartão). (f) Registros técnicos: datas de acesso e de uso e registros de erro."
 },
 {
  "n": 3,
  "titulo": "Para que usamos",
  "texto": "Prestar o serviço e executar as análises; liberar e controlar créditos, teste grátis e pagamentos; prevenir fraudes e abusos; dar suporte; melhorar a FatiaProAI e o produto com dados agregados; cumprir obrigações legais e fiscais."
 },
 {
  "n": 4,
   "titulo": "Bases legais (LGPD, art. 7º)",
   "texto": "Execução do contrato (prestar o serviço que você contratou); legítimo interesse (segurança, prevenção de fraudes, melhoria do produto, sempre respeitando seus direitos); cumprimento de obrigação legal (registros fiscais e de pagamentos)."
 },
 {
  "n": 5,
  "titulo": "Inteligência artificial e transferência internacional",
  "texto": "Para gerar as sugestões, enviamos ao nosso provedor de inteligência artificial, a Anthropic, PBC (Estados Unidos), apenas o necessário para a análise: configurações do fatiador, medidas e características da peça, resultados dos testes e, em alguns casos, uma imagem em miniatura da peça. Não enviamos seu nome, e-mail ou dados de pagamento. Essa transferência internacional é feita para executar o contrato com você (LGPD, art. 33) e com provedor que adota medidas de segurança compatíveis. O provedor não usa esses dados para treinar modelos, conforme seus termos comerciais."
 },
 {
  "n": 6,
  "titulo": "Com quem compartilhamos",
  "texto": "Hospedagem e banco de dados do app (infraestrutura em nuvem); Mercado Pago (pagamentos); provedor de IA (item 5). Não vendemos seus dados. Podemos compartilhar dados quando exigido por lei ou ordem judicial."
 },
 {
  "n": 7,
  "titulo": "Por quanto tempo guardamos",
  "texto": "Enquanto sua conta existir. Após a exclusão, apagamos ou anonimizamos os dados em até 6 meses, exceto os que a lei exige guardar (por exemplo, registros de pagamentos e fiscais por até 5 anos e registros de acesso por 6 meses, conforme o Marco Civil da Internet)."
 },
 {
  "n": 8,
   "titulo": "Seus direitos (LGPD, art. 18)",
   "texto": "Confirmar se tratamos seus dados; acessar; corrigir; pedir anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade; informação sobre compartilhamento; revisão de decisões automatizadas; e excluir sua conta. Peça pelo quitanda3d@gmail.com; respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD)."
 },
 {
  "n": 9,
  "titulo": "Segurança",
  "texto": "Usamos conexão criptografada, controle de acesso por usuário, segredos guardados apenas no servidor, chaves do seu computador guardadas no cofre do sistema (Keychain) e atualizações da ponte assinadas digitalmente. Nenhum sistema é 100% seguro; se houver incidente relevante, avisaremos você e a ANPD conforme a lei."
 },
 {
  "n": 10,
  "titulo": "Cookies",
  "texto": "Usamos apenas cookies e armazenamento local essenciais para manter você conectado e lembrar preferências. Não usamos cookies de publicidade."
 },
 {
  "n": 11,
  "titulo": "Crianças e adolescentes",
  "texto": "O serviço é para maiores de 18 anos."
 },
 {
  "n": 12,
  "titulo": "Alterações",
  "texto": "Podemos atualizar esta política; avisaremos no app."
 }
];
