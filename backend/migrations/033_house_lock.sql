-- ============================================================
-- 🔒 ล็อกบ้านที่ย้ายเอง — กันไม่ให้ซิงก์ชีทย้ายกลับ
--   ใครที่หัวหน้าโค้ช/TA ย้ายด้วยมือ จะติดธง house_locked = true
--   sheet-sync และสคริปต์ซิงก์ต้องข้ามแถวที่ล็อกไว้เสมอ
-- รันหลัง 032
-- ============================================================
alter table public.roster add column if not exists house_locked boolean not null default false;
comment on column public.roster.house_locked is 'true = ย้ายบ้านด้วยมือ ห้ามซิงก์ชีทเขียนทับ';

-- ล็อกคนที่ย้ายไปแล้วตามคำสั่งเบ้น
update public.roster set house_locked = true
where email in ('tatar.jularat@gmail.com', 'pakawat.anekwiroj@gmail.com');

-- admin_set_house: ย้ายด้วยมือ = ล็อกอัตโนมัติ
create or replace function public.admin_set_house(em text, hid smallint)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then
    raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น';
  end if;
  update public.roster set house_id = hid, house_locked = true where email = em::citext;
  if not found then
    raise exception 'ไม่พบอีเมล % ในรายชื่อ', em;
  end if;
  update public.profiles p
     set house_id = hid
    from public.roster r
   where r.email = em::citext and p.id = r.claimed_by;
end $fn$;
grant execute on function public.admin_set_house(text, smallint) to authenticated;

-- ปลดล็อกได้ถ้าอยากให้ชีทคุมอีกครั้ง
create or replace function public.admin_unlock_house(em text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  update public.roster set house_locked = false where email = em::citext;
end $fn$;
grant execute on function public.admin_unlock_house(text) to authenticated;

select email, house_id, house_locked from public.roster where house_locked;
