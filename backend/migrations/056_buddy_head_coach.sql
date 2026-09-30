-- 056: ให้หัวหน้าโค้ชร่วมบัดดี้ได้ด้วย (Benz ขอ) — เดิม buddy_ok() ตัดหัวหน้าโค้ชออก
-- เปลี่ยนจุดเดียว: นักเรียน + โค้ชทุกคน (รวมหัวหน้าโค้ชที่ไม่มีบ้าน) · รันหลัง 053
create or replace function public.buddy_ok(pid uuid)
returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = pid and p.role in ('student','coach'));
$$;
select 'buddy head coach ok' as ok, public.buddy_ok((select id from public.profiles where role = 'coach' and house_id is null limit 1)) as head_coach_allowed;
