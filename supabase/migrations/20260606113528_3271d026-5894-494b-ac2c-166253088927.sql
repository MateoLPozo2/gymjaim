
create policy "datasets_storage_read_own" on storage.objects for select to authenticated using (bucket_id='datasets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "datasets_storage_insert_own" on storage.objects for insert to authenticated with check (bucket_id='datasets' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "datasets_storage_delete_own" on storage.objects for delete to authenticated using (bucket_id='datasets' and auth.uid()::text = (storage.foldername(name))[1]);
