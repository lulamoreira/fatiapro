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
- The bridge (ponte) talks only to `/api/public/bridge/*` server routes, authenticated by a device token whose sha256 is stored in `devices.token_hash`; why: the browser must never see tokens and service-role access stays server-side (`src/lib/bridge.server.ts`, loaded via dynamic import).
- Browser code uses the RLS client directly; column-level GRANTs restrict what users may write (devices: nome/limite/revogado; jobs: estado→cancelado); why: enforce spec permissions in the database, not the UI.
- Every list query uses `count: 'exact'`, `.range()` and order `criado_em desc, id desc`; why: never rely on the 1000-row default.
- `devices.relatorio` shape is parsed defensively by `parseRelatorio` in `src/lib/fatia.ts` (fatiadores[{id,versao,impressoras,filamentos{tipo:{marca:[linhas]}}}], motores{assinatura,api}); why: it comes from an external program.
- The app never calls AI, stores no API keys, and has no print action; why: product rule.
