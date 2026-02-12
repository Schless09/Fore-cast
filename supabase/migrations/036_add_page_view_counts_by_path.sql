create or replace function get_page_view_counts_by_users_per_path(
  p_user_ids uuid[],
  p_since timestamptz default (now() - interval '30 days')
)
returns table (
  user_id uuid,
  tournaments bigint,
  standings_weekly bigint,
  standings_season bigint
) as $$
  select
    pv.user_id,
    count(*) filter (where pv.path like '/tournaments%')::bigint as tournaments,
    count(*) filter (where pv.path like '/standings/weekly%')::bigint as standings_weekly,
    count(*) filter (where pv.path like '/standings/season%')::bigint as standings_season
  from page_views pv
  where pv.user_id = any(p_user_ids)
    and pv.viewed_at >= p_since
  group by pv.user_id;
$$ language sql security definer;
