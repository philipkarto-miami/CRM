-- ============================================================================
-- Photos de sac : bucket de stockage + table de reference + securite
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('bag-photos', 'bag-photos', false)
on conflict (id) do nothing;

create table bag_photos (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references bags (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table bag_photos enable row level security;

create policy "bag_photos: lecture" on bag_photos for select using (auth.uid() is not null);
create policy "bag_photos: creation" on bag_photos for insert with check (auth.uid() is not null);
create policy "bag_photos: suppression admin/atelier" on bag_photos for delete
  using (auth_role() in ('admin', 'atelier'));

-- Policies sur le bucket de stockage (storage.objects)
create policy "bag-photos: lecture authentifies" on storage.objects for select
  using (bucket_id = 'bag-photos' and auth.uid() is not null);

create policy "bag-photos: upload authentifies" on storage.objects for insert
  with check (bucket_id = 'bag-photos' and auth.uid() is not null);

create policy "bag-photos: suppression admin/atelier" on storage.objects for delete
  using (bucket_id = 'bag-photos' and auth_role() in ('admin', 'atelier'));
