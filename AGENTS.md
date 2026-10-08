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
- Material labels and output filename material segments share `materialTexto` (via `nomeFilamento` for filenames); why: keep brand deduplication consistent across current and saved analyses/models without rewriting stored data.
- The bridge (ponte) talks only to `/api/public/bridge/*` server routes, authenticated by a device token whose sha256 is stored in `devices.token_hash`; why: the browser must never see tokens and service-role access stays server-side (`src/lib/bridge.server.ts`, loaded via dynamic import).
- Browser code uses the RLS client directly; column-level GRANTs restrict what users may write (devices: nome/limite/revogado; jobs: estado→cancelado); why: enforce spec permissions in the database, not the UI.
- Every list query uses `count: 'exact'`, `.range()` and order `criado_em desc, id desc`; why: never rely on the 1000-row default.
- `devices.relatorio` shape is parsed defensively by `parseRelatorio` in `src/lib/fatia.ts` (fatiadores[{id,nome,versao,impressoras,filamentos,adicionado_manual}], motores{assinatura,api}); slicers come only from this report and are named via `fatiadorLabel`/`nomeFatiador` (known 4 ids are only a name fallback); why: it comes from an external program and users can add any Bambu/Orca-family slicer.
- The app never calls AI, stores no API keys, and has no print action; why: product rule.
- Admin area data/actions go only through `src/lib/admin.functions.ts` (requireSupabaseAuth + service-role app_admins check in every handler, audit row in `admin_audit`, which has RLS and no policies); why: admin reads cross-user data and must never trust the browser.
