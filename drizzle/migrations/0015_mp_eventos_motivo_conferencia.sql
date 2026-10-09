ALTER TABLE public.mp_eventos ADD COLUMN motivo text CHECK (motivo IN ('ok','sem_cabecalho','formato','v1_diferente'));
ALTER TABLE public.pedidos ADD COLUMN conferido_em timestamptz;