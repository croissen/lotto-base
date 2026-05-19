-- 일별 방문자 카운터
-- - count: 총 페이지뷰 (PV)
-- - unique_count: 일일 고유 방문자 (localStorage 기반, 같은 사람이 같은 날 여러 번 와도 1회)

create table if not exists daily_visits (
  date date primary key,
  count integer not null default 0,
  unique_count integer not null default 0
);

alter table daily_visits enable row level security;

-- 직접 select/insert/update 차단 (악용 방지). RPC를 통해서만 접근.
drop policy if exists "no direct access" on daily_visits;
create policy "no direct access" on daily_visits
  for all
  using (false);

-- 원자적 카운터 증가 함수 (anon이 호출)
create or replace function increment_visit(is_unique boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into daily_visits (date, count, unique_count)
  values (current_date, 1, case when is_unique then 1 else 0 end)
  on conflict (date) do update set
    count = daily_visits.count + 1,
    unique_count = daily_visits.unique_count + case when is_unique then 1 else 0 end;
end;
$$;

-- 관리자 페이지용: 최근 N일 통계 조회
create or replace function get_visit_stats(days_back integer default 30)
returns table (
  date date,
  count integer,
  unique_count integer
)
language sql
security definer
set search_path = public
as $$
  select date, count, unique_count
  from daily_visits
  where date >= current_date - days_back
  order by date desc;
$$;

-- anon 권한 부여
grant execute on function increment_visit(boolean) to anon;
grant execute on function get_visit_stats(integer) to anon;
