-- ============================================================
-- ห้องแต่งตัว + บทบาท TA/หัวหน้าโค้ชในลู่วิ่ง + โหมดคนดู + สไตล์ 7 ชิ้น
--
-- 1. profiles.avatar (jsonb) — หน้าตาตัวละครที่นักเรียนแต่งเอง
-- 2. v_leaderboard เพิ่มคอลัมน์ avatar ต่อท้าย (create or replace ได้ ไม่ต้อง drop)
-- 3. admin_set_role — หัวหน้าโค้ชตั้งใครเป็น นักเรียน / TA / หัวหน้าโค้ช
-- 4. anon อ่านสนามได้ (โหมดคนดู) — อ่านอย่างเดียว ส่งงานไม่ได้ เพราะ insert ต้องมี auth.uid()
-- 5. pledge_options: 7 ชิ้น = style 'boost' (ตาเรืองแสงฟ้า)
--
-- รันหลัง 001-014
-- ============================================================

-- ------------------------------------------------------------
-- 1. avatar
-- ------------------------------------------------------------
alter table public.profiles add column if not exists avatar jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists avatar_small;
alter table public.profiles add constraint avatar_small check (pg_column_size(avatar) < 800);

-- ------------------------------------------------------------
-- 2. v_leaderboard + avatar (ตัวเดิมจาก 004 ทั้งก้อน แล้วต่อท้ายด้วย p.avatar)
-- ------------------------------------------------------------
create or replace view public.v_leaderboard as
with c as (select * from public.cohort where id = 1),
cw as (select public.current_week() as w),
enr as (
  select profile_id,
         array_agg(sprint_idx order by sprint_idx) as joined,
         count(*)                                  as sprints_joined
  from public.enrollments group by profile_id
),
con as (
  select profile_id,
         count(*)                  as contents,
         count(distinct day_index) as active_days,
         max(created_at)           as last_at
  from public.v_counted group by profile_id
),
raw as (
  select profile_id,
         count(*)                                    as submitted,
         count(*) filter (where status = 'pending')  as pending,
         count(*) filter (where status = 'rejected') as rejected,
         round(avg(stars) filter (where status = 'approved' and stars > 0), 2) as craft
  from public.submissions group by profile_id
),
goal as (
  select pl.profile_id,
         sum(pl.target) filter (where pl.week_no <= (select w from cw)) as target_to_date,
         sum(pl.target)                                                 as target_total
  from public.pledges pl group by pl.profile_id
),
wk as (
  select profile_id,
         count(*) filter (where hit and finished) as weeks_hit,
         count(*) filter (where finished)         as weeks_done
  from public.v_week_progress group by profile_id
),
now_pledge as (
  select wp.profile_id, wp.target as week_target, wp.done as week_done,
         wp.pct as week_pct, wp.pledge_key, wp.pledge_name, wp.pledge_style
  from public.v_week_progress wp where wp.is_current
)
select
  p.id, p.name, p.handle, p.color, p.role,
  p.house_id, h.key as house_key, h.name as house_name,
  h.th as house_th, h.color as house_color, h.emoji as house_emoji,
  coalesce(enr.joined, '{}')       as joined,
  coalesce(enr.sprints_joined, 0)  as sprints_joined,
  coalesce(con.contents, 0)        as contents,
  coalesce(con.active_days, 0)     as active_days,
  coalesce(goal.target_to_date, 0) as target_to_date,
  coalesce(goal.target_total, 0)   as target_total,
  coalesce(con.contents, 0) - coalesce(goal.target_to_date, 0) as pace,
  case when coalesce(goal.target_to_date,0) > 0
       then round(coalesce(con.contents,0)::numeric / goal.target_to_date * 100)
       else 0 end                  as rate,
  raw.craft,
  coalesce(raw.submitted, 0)       as submitted,
  coalesce(raw.pending, 0)         as pending,
  coalesce(raw.rejected, 0)        as rejected,
  con.last_at,
  coalesce(wk.weeks_hit, 0)        as weeks_hit,
  coalesce(wk.weeks_done, 0)       as weeks_done,
  np.week_target, np.week_done, np.week_pct,
  np.pledge_key, np.pledge_name,
  coalesce(np.pledge_style, 'normal') as pledge_style,
  public.week_streak_of(p.id)      as week_streak,
  st.streak                        as day_streak,
  st.freeze_left,
  p.avatar
from public.profiles p
left join public.houses h on h.id = p.house_id
left join enr  on enr.profile_id  = p.id
left join con  on con.profile_id  = p.id
left join raw  on raw.profile_id  = p.id
left join goal on goal.profile_id = p.id
left join wk   on wk.profile_id   = p.id
left join now_pledge np on np.profile_id = p.id
left join lateral public.streak_of(p.id) st on true;

-- ------------------------------------------------------------
-- 3. ตั้งบทบาท — student | ta | head
--    ta   = role 'coach' + บ้านตาม roster   (ชื่อสีเขียวในลู่ ประจำบ้านตัวเอง)
--    head = role 'coach' + ไม่มีบ้าน         (ชื่อสีแดง โผล่ทุกบ้าน)
-- ------------------------------------------------------------
create or replace function public.admin_set_role(em text, new_role text)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid; hid smallint;
begin
  if not public.is_head_coach() then
    raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น';
  end if;
  if new_role not in ('student','ta','head') then
    raise exception 'บทบาทไม่ถูกต้อง: %', new_role;
  end if;
  select claimed_by, house_id into uid, hid from public.roster where email = em::citext;
  if uid is null then
    raise exception 'คนนี้ยังไม่ได้สมัคร ตั้งบทบาทได้หลังสมัครแล้ว';
  end if;
  if uid = auth.uid() and new_role <> 'head' then
    raise exception 'ลดบทบาทตัวเองไม่ได้ ให้หัวหน้าโค้ชคนอื่นทำ';
  end if;
  update public.profiles
     set role     = case when new_role = 'student' then 'student' else 'coach' end,
         house_id = case when new_role = 'head' then null else hid end
   where id = uid;
end $fn$;
grant execute on function public.admin_set_role(text, text) to authenticated;

-- ------------------------------------------------------------
-- 4. โหมดคนดู — anon อ่านได้ทุกอย่างที่หน้าสนามใช้ (ไม่มีอีเมลในตารางพวกนี้)
--    เขียนไม่ได้: policy insert/update ทุกตัวผูกกับ auth.uid() ซึ่ง anon ไม่มี
-- ------------------------------------------------------------
drop policy if exists cohort_read_anon   on public.cohort;
create policy cohort_read_anon   on public.cohort      for select to anon using (true);
drop policy if exists profiles_read_anon on public.profiles;
create policy profiles_read_anon on public.profiles    for select to anon using (true);
drop policy if exists enroll_read_anon   on public.enrollments;
create policy enroll_read_anon   on public.enrollments for select to anon using (true);
drop policy if exists subs_read_anon     on public.submissions;
create policy subs_read_anon     on public.submissions for select to anon using (true);
drop policy if exists pledges_read_anon  on public.pledges;
create policy pledges_read_anon  on public.pledges     for select to anon using (true);
drop policy if exists houses_read_anon   on public.houses;
create policy houses_read_anon   on public.houses      for select to anon using (true);

grant select on public.cohort, public.profiles, public.enrollments, public.submissions,
                public.pledges, public.houses, public.pledge_options,
                public.v_leaderboard, public.v_feed, public.v_burnout, public.v_house_board,
                public.v_counted, public.v_week_progress to anon;
grant execute on function public.cohort_status() to anon;

-- ------------------------------------------------------------
-- 5. 7 ชิ้น = boost
-- ------------------------------------------------------------
update public.pledge_options set style = 'boost' where target = 7;

select 'ok' as status,
       (select count(*) from public.v_leaderboard) as rows,
       (select style from public.pledge_options where target = 7) as style7;
