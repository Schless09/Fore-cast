-- Page view analytics for tracking which users refresh which routes
create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  path text not null,
  viewed_at timestamptz not null default now()
);

create index if not exists page_views_user_id_idx on page_views(user_id);
create index if not exists page_views_path_idx on page_views(path);
create index if not exists page_views_viewed_at_idx on page_views(viewed_at);

alter table page_views enable row level security;

create policy "No direct client access to page_views"
  on page_views for all
  using (false)
  with check (false);
