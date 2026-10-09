UPDATE public.jobs j SET nome_peca = s.nome
FROM (
  SELECT DISTINCT ON (e.job_id) e.job_id,
    substring(e.conteudo->>'texto' from 'Usando a peça aberta no [^:]+: (.+?) \(versão das') AS nome
  FROM public.job_events e
  WHERE e.tipo = 'progresso'
    AND (e.conteudo->>'texto') ~ 'Usando a peça aberta no [^:]+: (.+?) \(versão das'
  ORDER BY e.job_id, e.criado_em, e.id
) s
WHERE j.id = s.job_id AND j.nome_peca IS NULL AND s.nome IS NOT NULL;