create policy "pecas_miniatura_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pecas'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'miniaturas'
    and array_length(storage.foldername(name), 1) = 2
    and lower(storage.extension(name)) in ('webp', 'png')
  );

create policy "pecas_miniatura_update_own" on storage.objects for update to authenticated
  using (
    bucket_id = 'pecas'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'miniaturas'
  )
  with check (
    bucket_id = 'pecas'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'miniaturas'
    and array_length(storage.foldername(name), 1) = 2
    and lower(storage.extension(name)) in ('webp', 'png')
  );