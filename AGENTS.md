<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## FatiaPro architecture
- Branding tests parse TSX via the TS AST, exempting only the admin subscription block; why: catch user-facing literals, not identifiers.
- The bridge (ponte) talks only to `/api/public/bridge/*` server routes, authenticated by a device token whose sha256 is stored in `devices.token_hash`; why: the browser must never see tokens and service-role access stays server-side (`src/lib/bridge.server.ts`, loaded via dynamic import).
- Browser code uses the RLS client directly; column-level GRANTs restrict what users may write (devices: nome/limite/revogado; jobs: estado→cancelado); why: enforce spec permissions in the database, not the UI.
- Lists use `count: 'exact'`, `.range()`, order `criado_em desc, id desc`; why: avoid the 1000-row default.
- `devices.relatorio` shape is parsed defensively by `parseRelatorio` in `src/lib/fatia.ts` (fatiadores[{id,nome,versao,impressoras,filamentos,adicionado_manual}], motores{assinatura,api}); slicers come only from this report and are named via `fatiadorLabel`/`nomeFatiador` (known 4 ids are only a name fallback); why: it comes from an external program and users can add any Bambu/Orca-family slicer.
- AI is called only by the server route /api/public/bridge/ia with ANTHROPIC_API_KEY read from process.env; the browser never calls AI and the app has no print action; why: keep the provider key server-only.
- Jobs are created only through `criarAnalise` → SQL `criar_analise` (service_role-only EXECUTE, one transaction, advisory lock per user); credit functions are service_role-only; regression script in supabase/tests/creditos.sql; why: no credit rule may depend on the browser.
- Admin area data/actions go only through `src/lib/admin.functions.ts` (requireSupabaseAuth + service-role app_admins check in every handler, audit row in `admin_audit`, which has RLS and no policies); why: admin reads cross-user data and must never trust the browser.
- The bridge self-update reads /api/public/bridge/versao; installers live in the private `ponte` bucket, downloaded only via server-signed URLs; why: no public reads of installers.
- Plan/credit UI reads only `meuPlano` (src/lib/plano.functions.ts; service role used solely for saldo_creditos/vencer_lotes) and describes rules with pure helpers in `src/lib/plano.ts`; why: the database stays the only source of credit rules and the UI text stays testable.
- Admin billing (credits, courtesy, trial reset, feedback, finance, billing config) lives in `src/lib/admin-cobranca.functions.ts`; every handler calls guard() first and every write calls auditar(); credit grants/removals go only through service_role-only SQL `admin_dar_creditos`/`admin_remover_creditos` (test: supabase/tests/admin_creditos.sql); why: admin money actions must be server-checked and always audited.
- Credit purchases use Mercado Pago Checkout Pro: `criarCompra` (src/lib/compra.functions.ts) reads price only from `pacotes`; credits are released only by `processarPagamento` (used by the webhook and `conferirPedido`) after a server GET of the payment on the Mercado Pago API; the webhook signature is logged in `mp_eventos.motivo` but does not block, via service_role-only SQL `creditar_pedido`/`estornar_pedido` (logic: src/lib/mercadopago.ts); why: the browser and the notification body are never trusted for money.
- Terms UI uses TERMOS_VERSAO; signup allowlists that version and timestamps consent server-side; update both on version bumps; why: invalid metadata is not consent.
- Admin consent reset is an audited own-account RPC; why: other users' consent must stay intact.
- Quotes: number/total only via SQL `criar_orcamento`; PDF rebuilt client-side from saved rows via pure `conteudoPdf` (tested: no cost/margin/minimum); images pass `reduzirImagem` first; why: client sees only final price, jsPDF breaks on big images.
- Início KPIs come only from SQL `kpis_usuario` (invoker, RLS) and `kpis_admin` (definer, checks is_admin, test supabase/tests/kpis.sql); list filters live in the URL, parsed by pure readers in `src/lib/inicio.ts`; why: lists truncate at 1000 rows and cards must open the matching filtered list.
- Sales pause: `vendas_*` in config_app; users read only `statusVendas` (suspensas/mensagem), `criarCompra` calls `exigirVendasAtivas` first; why: the pause holds server-side without exposing config.
