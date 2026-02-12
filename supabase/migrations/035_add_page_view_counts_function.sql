create or replace function get_page_view_counts_by_users(
  p_user_ids uuid[],
  p_since timestamptz default (now() - interval '30 days')
)
returns table (user_id uuid, view_count bigint) as $$
  select pv.user_id, count(*)::bigint
  from page_views pv
  where pv.user_id = any(p_user_ids)
    and pv.viewed_at >= p_since
  group by pv.user_id;
$$ language sql security definer;
