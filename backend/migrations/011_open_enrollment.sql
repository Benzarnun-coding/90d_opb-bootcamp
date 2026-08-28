-- ============================================================
-- แก้บั๊ก: สมัครไม่ได้ถ้าสปรินต์ปัจจุบันเริ่มไปแล้ว
--
-- guard_enrollment ใน 001 ห้ามลงสปรินต์ที่เริ่มไปแล้ว
-- ตอนนั้นสมเหตุสมผล เพราะนักเรียนเลือกสปรินต์เองได้
--
-- แต่ตอนนี้ทุกคนถูกลงครบทั้ง 6 สปรินต์อัตโนมัติตอนสมัคร
-- กฎนี้เลยกลายเป็นตัวบล็อกไม่ให้ใครสมัครได้เลยหลังวันแรก
-- ซึ่งจะทำให้คนที่เข้ามาสายสมัครไม่ได้ตลอดทั้งรุ่น
--
-- รันหลัง 001-010
-- ============================================================

drop trigger if exists trg_enrollment_ins on public.enrollments;
drop trigger if exists trg_enrollment_del on public.enrollments;
drop function if exists public.guard_enrollment();

-- ------------------------------------------------------------
-- เติมสปรินต์ให้คนที่สมัครค้างไว้ตอนเจอบั๊ก
-- ------------------------------------------------------------
insert into public.enrollments (profile_id, sprint_idx)
select p.id, s.i
from public.profiles p
cross join generate_series(0, (select sprints - 1 from public.cohort where id = 1)) s(i)
on conflict do nothing;

select p.name, p.handle, p.house_id,
       (select count(*) from public.enrollments e where e.profile_id = p.id) as sprints,
       (select count(*) from public.roster r where r.claimed_by = p.id)      as roster_claimed
from public.profiles p order by p.created_at;
