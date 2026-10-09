## src/lib presentation helpers
- Motivational phrases use a shuffled-bag helper in `src/lib/frases-animo.ts` and an isolated timed component below WorkingCard; why: testable timing.
- Open-piece notice availability, device-specific save shortcuts and timeline version parsing use pure helpers in `src/lib/peca-aberta.ts`, rendered by `PecaAberta` components; why: testable presentation rules.
- Nova análise resolves available motor defaults with the pure `escolherMotor` helper and renders choices through Radix radio cards; why: keep history fallback testable and keyboard/ARIA behavior consistent without changing server permissions.
- Material labels and output filename material segments share `materialTexto` (via `nomeFilamento` for filenames); why: keep brand deduplication consistent across current and saved analyses/models without rewriting stored data.
