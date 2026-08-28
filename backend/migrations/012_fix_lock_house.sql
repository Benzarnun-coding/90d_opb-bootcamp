-- ============================================================
-- แก้บั๊ก: ตั้งหัวหน้าโค้ชจาก SQL Editor ไม่ได้
--
-- lock_house เดิมยอมให้แก้ house_id เฉพาะหัวหน้าโค้ช
-- แต่ตอนรันจาก SQL Editor หรือสคริปต์ฝั่งเซิร์ฟเวอร์ auth.uid() เป็น null
-- เลยไม่ผ่านเงื่อนไข ผลคือไม่มีใครตั้งหัวหน้าโค้ชคนแรกได้เลย
--
-- ทางแก้: ถ้าไม่มี auth.uid() แปลว่าเรียกจากฝั่งเซิร์ฟเวอร์ (postgres / service_role)
-- ซึ่งข้าม RLS อยู่แล้ว ให้ผ่านได้ ส่วนผู้ใช้ปกติจะมี auth.uid() เสมอ
--
-- รันหลัง 001-011
-- ============================================================

create or replace function public.lock_house()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  -- เรียกจากฝั่งเซิร์ฟเวอร์ (ไม่มีผู้ใช้ล็อกอิน) — ไว้ใจได้ ปล่อยผ่าน
  if auth.uid() is null then return new; end if;

  if new.house_id is distinct from old.house_id and not public.is_head_coach() then
    raise exception 'ย้ายห้องเองไม่ได้';
  end if;
  return new;
end $fn$;

-- ------------------------------------------------------------
-- ตั้งหัวหน้าโค้ชคนแรก
-- ------------------------------------------------------------
update public.profiles set role = 'coach', house_id = null where name = 'BENZ';

select p.name, p.handle, p.role,
       coalesce(p.house_id::text, 'ทุกห้อง') as house,
       (select count(*) from public.enrollments e where e.profile_id = p.id) as sprints
from public.profiles p order by p.created_at;
