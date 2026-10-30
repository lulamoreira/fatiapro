ALTER TABLE public.pecas
  ADD COLUMN miniatura_path text,
  ADD COLUMN miniatura_tentada_em timestamptz;

COMMENT ON COLUMN public.pecas.miniatura_path IS 'Caminho da miniatura (webp/png) no bucket pecas, gerada a partir da imagem embutida no 3MF.';
COMMENT ON COLUMN public.pecas.miniatura_tentada_em IS 'Quando a geração da miniatura foi tentada pela última vez (evita novas tentativas em peças sem imagem).';