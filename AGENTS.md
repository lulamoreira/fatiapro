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
- Motivational phrases use a shuffled-bag helper in `src/lib/frases-animo.ts` and an isolated timed component below WorkingCard; why: testable timing.
- Open-piece notice availability, device-specific save shortcuts and timeline version parsing use pure helpers in `src/lib/peca-aberta.ts`, rendered by `PecaAberta` components; why: testable presentation rules.
- Branding tests parse TSX via the TS AST, exempting only the admin subscription block; why: catch user-facing literals, not identifiers.
- Nova análise resolves available motor defaults with the pure `escolherMotor` helper and renders choices through Radix radio cards; why: keep history fallback testable and keyboard/ARIA behavior consistent without changing server permissions.
- Material labels and output filename material segments share `materialTexto` (via `nomeFilamento` for filenames); why: keep brand deduplication consistent across current and saved analyses/models without rewriting stored data.
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
- Signed bridge publishing lives in `src/lib/ponte-publicar.ts` (pure, deps injected, WebCrypto Ed25519 with the public key as a default parameter) and `/api/public/ponte/publicar/{iniciar,concluir}`; why: the ed25519 signatures are the only authorization and must be testable with a test key pair.
- Credit purchases use Mercado Pago Checkout Pro: `criarCompra` (src/lib/compra.functions.ts) reads price only from `pacotes`; credits are released only by `processarPagamento` (used by the webhook and `conferirPedido`) after a server GET of the payment on the Mercado Pago API; the webhook signature is logged in `mp_eventos.motivo` but does not block, via service_role-only SQL `creditar_pedido`/`estornar_pedido` (logic: src/lib/mercadopago.ts); why: the browser and the notification body are never trusted for money.
- Coupons are redeemed only via `resgatarCupom` (src/lib/cupons.functions.ts) → service_role-only SQL `resgatar_cupom`, which locks the coupon row before checking limits; wrong attempts are counted in `cupom_tentativas` (pure rules in src/lib/cupons.ts, test supabase/tests/cupons.sql); why: no coupon rule may depend on the browser and simultaneous redemptions must not exceed the limit.
- Terms UI uses TERMOS_VERSAO; signup allowlists that version and timestamps consent server-side; update both on version bumps; why: invalid metadata is not consent.
- Admin consent reset is an audited own-account RPC; why: other users' consent must stay intact.
- Quotes (orçamentos) are numbered and totalled only by SQL `criar_orcamento` (authenticated, own business row); the PDF is rebuilt in the browser by `src/lib/orcamento-pdf.ts` from saved rows using `conteudoPdf` (pure, tested to never include cost/margin/minimum); images go through `reduzirImagem` before upload/embedding; why: customer sees only final price and jsPDF breaks on large images.
