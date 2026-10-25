-- MyVideoPlayer: Supabase setup (M7)
--
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste all of this -> Run.
-- Run it AFTER creating your one admin user (Authentication -> Users -> Add user).
-- Safe to run again: every step checks what already exists.


-- 1. Admins ---------------------------------------------------------------
-- Writes are allowed only for users listed here, so even if sign-ups were
-- ever turned back on, a new account still could not touch the videos.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- RLS on with no policies: the table cannot be read or changed through the API.
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

-- Make the project's only user the admin. Does nothing if there are zero
-- users, or more than one (then add the right one by hand).
insert into public.admins (user_id)
select id from auth.users
where (select count(*) from auth.users) = 1
on conflict do nothing;


-- 2. Videos ---------------------------------------------------------------

create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  video_path  text not null,             -- path inside the "media" bucket
  thumb_path  text not null,
  poster_path text not null,
  position    integer not null,          -- gallery order, lowest first
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists videos_position_idx on public.videos (position);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists videos_touch_updated_at on public.videos;
create trigger videos_touch_updated_at
  before update on public.videos
  for each row execute function public.touch_updated_at();

alter table public.videos enable row level security;

drop policy if exists "Anyone reads published videos" on public.videos;
create policy "Anyone reads published videos" on public.videos
  for select to anon, authenticated
  using (published or (select public.is_admin()));

drop policy if exists "Admin inserts videos" on public.videos;
create policy "Admin inserts videos" on public.videos
  for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "Admin updates videos" on public.videos;
create policy "Admin updates videos" on public.videos
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Admin deletes videos" on public.videos;
create policy "Admin deletes videos" on public.videos
  for delete to authenticated
  using ((select public.is_admin()));


-- 3. Storage --------------------------------------------------------------
-- Public bucket: files are readable by URL (needed for <video src>).
-- Only the admin can upload, replace or delete. 50 MB per file (free tier max).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true, 52428800,
  array['video/mp4', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin reads media" on storage.objects;
create policy "Admin reads media" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));

drop policy if exists "Admin uploads media" on storage.objects;
create policy "Admin uploads media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (select public.is_admin()));

drop policy if exists "Admin updates media" on storage.objects;
create policy "Admin updates media" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));

drop policy if exists "Admin deletes media" on storage.objects;
create policy "Admin deletes media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));


-- 4. Starting videos ------------------------------------------------------
-- The three current videos. Only inserted when the table is empty.
-- Upload the matching files into the "media" bucket (see the M7 steps).

insert into public.videos (title, description, video_path, thumb_path, poster_path, position)
select * from (values
  ('Video 1', '', 'videos/sue-vid1.mp4', 'thumbs/sue-vid1-thumb.png', 'posters/sue-vid1-frame.jpg', 1),
  ('Video 2', '', 'videos/sue-vid2.mp4', 'thumbs/sue-vid2-thumb.png', 'posters/sue-vid2-frame.jpg', 2),
  ('Video 3', '', 'videos/sue-vid3.mp4', 'thumbs/sue-vid3-thumb.png', 'posters/sue-vid3-frame.jpg', 3)
) as v
where not exists (select 1 from public.videos);


-- 5. Check ----------------------------------------------------------------
-- Expect: admins = 1, videos = 3, bucket = true.

select
  (select count(*) from public.admins)                              as admins,
  (select count(*) from public.videos)                              as videos,
  (select public from storage.buckets where id = 'media')           as bucket_is_public;
