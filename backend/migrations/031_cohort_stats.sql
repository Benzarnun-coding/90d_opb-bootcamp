-- ============================================================
-- ภาพรวมรุ่น: จำนวนคนต่อบ้าน · สัดส่วนเป้าแต่ละสัปดาห์ (4/7/10/14) · ใครส่งบ้าง
-- ใช้ในหน้า admin และหน้า TA (หัวหน้าโค้ช + TA)   รันหลัง 030
-- ============================================================
create or replace function public.admin_cohort_stats()
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare res jsonb; cw int := public.current_week();
begin
  if not (public.is_head_coach() or public.is_ta()) then raise exception 'เฉพาะหัวหน้าโค้ชหรือ TA เท่านั้น'; end if;
  select jsonb_build_object(
    'week', cw,
    'houses', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', h.id, 'name', h.name,
                 'roster',     (select count(*) from public.roster r where r.house_id = h.id),
                 'registered', (select count(*) from public.roster r where r.house_id = h.id and r.claimed_by is not null),
                 'students',   (select count(*) from public.profiles p where p.house_id = h.id and p.role = 'student'),
                 'tas',        (select count(*) from public.profiles p where p.house_id = h.id and p.role = 'coach'),
                 'posted_week',(select count(distinct s.profile_id) from public.submissions s join public.profiles p on p.id = s.profile_id
                                 where p.house_id = h.id and p.role = 'student' and s.status = 'approved' and public.week_of_ts(s.created_at) = cw),
                 'posted_any', (select count(distinct s.profile_id) from public.submissions s join public.profiles p on p.id = s.profile_id
                                 where p.house_id = h.id and p.role = 'student' and s.status = 'approved'),
                 'contents',   (select count(*) from public.v_counted v join public.profiles p on p.id = v.profile_id where p.house_id = h.id and p.role = 'student'),
                 'pledged_week',(select count(*) from public.pledges pl join public.profiles p on p.id = pl.profile_id where p.house_id = h.id and p.role = 'student' and pl.week_no = cw)
               ) order by h.id), '[]'::jsonb) from public.houses h),
    'students', (select count(*) from public.profiles where role = 'student'),
    'roster',   (select count(*) from public.roster),
    'pledges', (select coalesce(jsonb_agg(jsonb_build_object('week_no', week_no, 'target', target, 'n', n, 'hit', hit) order by week_no, target), '[]'::jsonb)
                from (select pl.week_no, pl.target, count(*) as n,
                             count(*) filter (where exists (select 1 from public.v_week_progress wp where wp.profile_id = pl.profile_id and wp.week_no = pl.week_no and wp.hit)) as hit
                      from public.pledges pl join public.profiles p on p.id = pl.profile_id
                      where p.role = 'student' group by 1, 2) x),
    'pledges_by_house', (select coalesce(jsonb_agg(jsonb_build_object('house_id', house_id, 'target', target, 'n', n) order by house_id, target), '[]'::jsonb)
                from (select p.house_id, pl.target, count(*) as n from public.pledges pl join public.profiles p on p.id = pl.profile_id
                      where p.role = 'student' and pl.week_no = cw group by 1, 2) x),
    'no_pledge_week', (select count(*) from public.profiles p where p.role = 'student'
                         and not exists (select 1 from public.pledges pl where pl.profile_id = p.id and pl.week_no = cw)),
    -- 💖 Popular vote: ใครได้รับเชียร์เยอะสุด (รวมทั้งรุ่น / สัปดาห์นี้ / จำนวนคนที่เชียร์ไม่ซ้ำ)
    'popular', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'house_id', house_id, 'total', total, 'week', week, 'fans', fans, 'top_emoji', top_emoji) order by total desc, fans desc), '[]'::jsonb)
                 from (select p.id, p.name, p.house_id,
                              count(c.*) as total,
                              count(c.*) filter (where public.week_of(c.day_index) = cw) as week,
                              count(distinct c.from_id) as fans,
                              (select c2.emoji from public.cheers c2 where c2.to_id = p.id group by c2.emoji order by count(*) desc limit 1) as top_emoji
                       from public.profiles p join public.cheers c on c.to_id = p.id
                       group by p.id, p.name, p.house_id order by total desc, fans desc limit 20) x),
    'cheer_total', (select count(*) from public.cheers),
    'cheer_week', (select count(*) from public.cheers c where public.week_of(c.day_index) = cw),
    'cheer_givers', (select count(distinct from_id) from public.cheers),
    'weeks_pledged', (select coalesce(jsonb_agg(jsonb_build_object('week_no', week_no, 'n', n) order by week_no), '[]'::jsonb)
                      from (select pl.week_no, count(*) as n from public.pledges pl join public.profiles p on p.id = pl.profile_id where p.role = 'student' group by 1) x)
  ) into res;
  return res;
end $fn$;
grant execute on function public.admin_cohort_stats() to authenticated;

-- รายคน: ใครเลือกเป้าอะไรในแต่ละสัปดาห์ (ทำได้กี่ชิ้น ครบไหม) — หัวหน้าโค้ช + TA
create or replace function public.cohort_people()
returns jsonb language sql security definer set search_path = public stable as $fn$
  select case when (public.is_head_coach() or public.is_ta()) then
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'house_id', p.house_id,
              'contents', (select count(*) from public.v_counted v where v.profile_id = p.id),
              'weeks', (select coalesce(jsonb_agg(jsonb_build_object('w', pl.week_no, 't', pl.target,
                          'd', coalesce((select wp.done from public.v_week_progress wp where wp.profile_id = p.id and wp.week_no = pl.week_no), 0),
                          'hit', coalesce((select wp.hit from public.v_week_progress wp where wp.profile_id = p.id and wp.week_no = pl.week_no), false)) order by pl.week_no), '[]'::jsonb)
                        from public.pledges pl where pl.profile_id = p.id)) order by p.house_id, p.name)
              from public.profiles p where p.role = 'student'), '[]'::jsonb)
  else '[]'::jsonb end;
$fn$;
grant execute on function public.cohort_people() to authenticated;
