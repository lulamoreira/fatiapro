ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uf text CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$');
GRANT UPDATE (uf) ON public.profiles TO authenticated;