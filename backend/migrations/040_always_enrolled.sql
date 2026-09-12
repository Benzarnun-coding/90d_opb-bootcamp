-- ============================================================
-- 040: ทุกคนลงครบทุกสปรินต์เสมอ — มาเรียนย้อนหลังก็เลือกเป้า/ส่งงานได้
--
-- อาการ: นักเรียนกดรับเป้าแล้วเด้ง "สัปดาห์ที่ 2 อยู่ในสปรินต์ 1 ซึ่งยังไม่ได้ลง"
--        และปุ่มส่งงานเป็น "ไม่ได้ลงสปรินต์นี้"
-- สาเหตุ: ตอนสมัคร หน้าเว็บยิง 2 คำสั่ง: สร้าง profile แล้วค่อยลง enrollments 6 สปรินต์
--        ถ้าคำสั่งที่ 2 หลุด (ฐานข้อมูลเย็น / ปิดหน้าก่อน / เน็ตหลุด) profile มีแต่ enrollments ว่าง
--        ด่านใน guard_pledge (009) และ on_submission_insert (008) เลยกันคนนั้นตลอดรุ่น
--        011 เคยเติมย้อนหลังครั้งเดียว แต่คนที่สมัครหลังจากนั้นแล้วพลาดก็ติดอีก
-- แก้: ให้ฐานข้อมูลลงสปรินต์ให้เองทุกทาง ไม่พึ่งหน้าเว็บอีก
-- รันหลัง 039
-- ============================================================

create or replace function public.ensure_enrolled(pid uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.enrollments (profile_id, sprint_idx)
  select pid, s.i
  from public.cohort c cross join generate_series(0, c.sprints - 1) s(i)
  where c.id = 1
  on conflict do nothing;
$$;
revoke execute on function public.ensure_enrolled(uuid) from public, anon, authenticated;

-- 1) เติมย้อนหลังให้ทุกคนที่มีอยู่ตอนนี้
select public.ensure_enrolled(p.id) from public.profiles p;

-- 2) สมัครใหม่ → ลงครบทันทีในฐานข้อมูล
create or replace function public.enroll_all_on_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_enrolled(new.id);
  return new;
end $$;
drop trigger if exists trg_profile_enroll_all on public.profiles;
create trigger trg_profile_enroll_all after insert on public.profiles
  for each row execute function public.enroll_all_on_profile();

-- 3) กันเหนียว: ก่อนด่านตรวจตอนเลือกเป้า/ส่งงาน เติมให้อีกรอบ
--    ตั้งชื่อขึ้นต้น aa_ เพราะ Postgres เรียก trigger ชนิดเดียวกันเรียงตามชื่อ จะได้ทำงานก่อน trg_* ที่เช็คด่าน
create or replace function public.ensure_enrolled_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_enrolled(new.profile_id);
  return new;
end $$;
drop trigger if exists aa_ensure_enrolled on public.pledges;
create trigger aa_ensure_enrolled before insert or update on public.pledges
  for each row execute function public.ensure_enrolled_row();
drop trigger if exists aa_ensure_enrolled on public.submissions;
create trigger aa_ensure_enrolled before insert on public.submissions
  for each row execute function public.ensure_enrolled_row();

-- ตรวจ: full_ok ต้องเท่ากับ profiles
select count(*) filter (where t.n = (select sprints from public.cohort where id = 1)) as full_ok,
       count(*) as profiles
from (select p.id, (select count(*) from public.enrollments e where e.profile_id = p.id) as n
      from public.profiles p) t;
