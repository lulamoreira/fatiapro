ALTER TABLE public.device_commands DROP CONSTRAINT IF EXISTS device_commands_tipo_check;
ALTER TABLE public.device_commands ADD CONSTRAINT device_commands_tipo_check CHECK (tipo IN ('instalar_claude_code','entrar_claude','configurar_api','escolher_pasta','adicionar_fatiador'));
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_fatiador_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_fatiador_check CHECK (fatiador IS NULL OR fatiador ~ '^[a-z0-9_-]{2,40}$');