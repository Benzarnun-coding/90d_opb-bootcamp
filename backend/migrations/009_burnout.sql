-- ============================================================
-- BURNOUT — รับเป้าหนักแล้วทำไม่ถึง สัปดาห์ถัดไปโดนลงโทษ
--
-- ใครรับ 10 หรือ 14 ชิ้นไว้แล้วสัปดาห์นั้นทำไม่ครบ
-- สัปดาห์ถัดไปจะ "หมดแรง" — ตัวละครกลายเป็นร่างกระโหลก
-- และเลือกได้แค่ 4 หรือ 7 เท่านั้น จนกว่าจะพ้นสัปดาห์นั้นไป
--
-- เจตนา: ทำให้คำสัญญามีน้ำหนักจริง คนจะได้คิดก่อนรับเป้าหนัก
-- ไม่ใช่กดเล่น ๆ เพราะอยากได้ตัวละครสวย
--
-- รันหลัง 001-008
-- ============================================================

alter table public.cohort add column if not exists heavy_target smallint not null default 10;

comment on column public.cohort.heavy_target is
  'เป้าตั้งแต่กี่ชิ้นขึ้นไปถือว่า "หนัก" — ทำไม่ถึงแล้วโดน burnout สัปดาห์ถัดไป';

-- ------------------------------------------------------------
-- สัปดาห์ที่แล้วรับเป้าหนักแล้วทำไม่ถึงหรือเปล่า
-- ------------------------------------------------------------
create or replace function public.burned_out(pid uuid, wk int)
returns boolean language sql stable as $fn$
  select exists (
    select 1
    from public.v_week_progress wp, public.cohort c
    where c.id = 1
      and wp.profile_id = pid
      and wp.week_no    = wk - 1
      and wp.target    >= c.heavy_target
      and not wp.hit
  );
$fn$;

-- ------------------------------------------------------------
-- ใครกำลังหมดแรงอยู่ตอนนี้ — หน้าเว็บดึง view นี้ไปวาดตัวละคร
-- ------------------------------------------------------------
create or replace view public.v_burnout as
select wp.profile_id,
       wp.target  as failed_target,
       wp.done    as failed_done,
       wp.week_no as failed_week
from public.v_week_progress wp, public.cohort c
where c.id = 1
  and wp.week_no = public.current_week() - 1
  and wp.target >= c.heavy_target
  and not wp.hit;

grant select on public.v_burnout to authenticated;

-- ------------------------------------------------------------
-- บังคับกติกา: หมดแรงอยู่ เลือกเป้าหนักไม่ได้
-- ------------------------------------------------------------
create or replace function public.guard_pledge()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  c   public.cohort%rowtype;
  cw  int;
  opt public.pledge_options%rowtype;
  sp  int;
begin
  select * into c from public.cohort where id = 1;
  cw := public.current_week();

  if new.week_no < 1 or new.week_no > c.weeks then
    raise exception 'สัปดาห์ที่ % ไม่มีในรุ่นนี้', new.week_no;
  end if;

  if new.week_no < cw then
    raise exception 'สัปดาห์ที่ % ผ่านไปแล้ว เลือกย้อนหลังไม่ได้', new.week_no;
  end if;

  select * into opt from public.pledge_options where target = new.target;
  if opt.target is null then
    raise exception 'ไม่มีตัวเลือก % ชิ้นต่อสัปดาห์', new.target;
  end if;
  if new.week_no < opt.unlock_week then
    raise exception '% ยังไม่เปิด ต้องถึงสัปดาห์ที่ % ก่อน', opt.name, opt.unlock_week;
  end if;

  -- หมดแรงจากสัปดาห์ที่แล้ว เลือกเป้าหนักไม่ได้
  if new.target >= c.heavy_target and public.burned_out(new.profile_id, new.week_no) then
    raise exception 'สัปดาห์ที่แล้วรับเป้าหนักไว้แล้วทำไม่ถึง สัปดาห์นี้เลือกได้แค่ต่ำกว่า % ชิ้น', c.heavy_target;
  end if;

  sp := public.sprint_of_week(new.week_no);
  if not exists (select 1 from public.enrollments e
                 where e.profile_id = new.profile_id and e.sprint_idx = sp) then
    raise exception 'สัปดาห์ที่ % อยู่ในสปรินต์ % ซึ่งยังไม่ได้ลง', new.week_no, sp + 1;
  end if;

  if TG_OP = 'UPDATE' and new.week_no = cw and new.target < old.target then
    raise exception 'สัปดาห์นี้เริ่มไปแล้ว เพิ่มเป้าได้ แต่ลดไม่ได้ (เดิม % ชิ้น)', old.target;
  end if;

  new.chosen_at := now();
  return new;
end $fn$;

select * from public.v_burnout;
