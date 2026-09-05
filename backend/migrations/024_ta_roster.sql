-- ============================================================
-- TA จากฟอร์ม: ตั้งบทบาทได้ตั้งแต่อยู่ในรายชื่อ (ยังไม่สมัครก็ได้) พอสมัครจะเป็น TA ทันที
-- รันหลัง 001-023
-- ============================================================
alter table public.roster add column if not exists role text not null default 'student';
alter table public.roster drop constraint if exists roster_role_ok;
alter table public.roster add constraint roster_role_ok check (role in ('student','ta'));

-- ตอนสมัคร: ถ้ารายชื่อบอกว่าเป็น TA → โปรไฟล์เป็น coach ประจำบ้าน (ชื่อสีเขียว)
create or replace function public.claim_roster()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  em citext;
  r  public.roster%rowtype;
begin
  if new.role = 'coach' then return new; end if;
  select u.email into em from auth.users u where u.id = new.id;
  if em is null then raise exception 'ไม่พบอีเมลของบัญชีนี้'; end if;
  select * into r from public.roster where email = em;
  if r.email is null then
    raise exception 'อีเมล % ไม่อยู่ในรายชื่อรุ่นนี้ ติดต่อทีมงานเพื่อเพิ่มชื่อก่อน', em;
  end if;
  if r.claimed_by is not null and r.claimed_by <> new.id then
    raise exception 'อีเมล % ถูกใช้สมัครไปแล้ว', em;
  end if;
  new.house_id := r.house_id;
  if r.role = 'ta' then new.role := 'coach'; end if;
  if new.handle is null or length(trim(new.handle)) < 3 then
    new.handle := public.handle_from_email(em::text);
  end if;
  return new;
end $fn$;

-- หัวหน้าโค้ชตั้งบทบาท: จดไว้ในรายชื่อด้วย และตั้งได้แม้ยังไม่สมัคร
create or replace function public.admin_set_role(em text, new_role text)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid; hid smallint;
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  if new_role not in ('student','ta','head') then raise exception 'บทบาทไม่ถูกต้อง: %', new_role; end if;
  select claimed_by, house_id into uid, hid from public.roster where email = em::citext;
  if hid is null then raise exception 'ไม่พบอีเมลนี้ในรายชื่อ'; end if;
  if new_role in ('student','ta') then
    update public.roster set role = new_role where email = em::citext;
  end if;
  if uid is null then return; end if;                       -- ยังไม่สมัคร: จดไว้ในรายชื่อพอ
  if uid = auth.uid() and new_role <> 'head' then
    raise exception 'ลดบทบาทตัวเองไม่ได้ ให้หัวหน้าโค้ชคนอื่นทำ';
  end if;
  update public.profiles
     set role     = case when new_role = 'student' then 'student' else 'coach' end,
         house_id = case when new_role = 'head' then null else hid end
   where id = uid;
end $fn$;

-- ------------------------------------------------------------
-- ข้อมูล: TA จากฟอร์ม (sheet 1mim3npbdOm0paf7byIbrl7fyS4dFx-W5CTAnrqorO1U · 2026-09-05)
-- คนที่ยังไม่มีในรายชื่อถูกกระจายบ้านให้ก่อน — ย้ายบ้านได้ในหน้า admin
-- ------------------------------------------------------------
insert into public.roster (email, house_id, role) values
  ('pronthep.ktk@gmail.com',     1, 'ta'),
  ('chayanant.k@gmail.com',      1, 'ta'),
  ('pakawat.anekwiroj@gmail.com',2, 'ta'),
  ('phasuth.p@gmail.com',        4, 'ta'),
  ('nslife45@gmail.com',         4, 'ta'),
  ('time@modernos.co',           2, 'ta')
on conflict (email) do update set role = 'ta';
update public.roster set role = 'ta'
 where email in ('somdech.tbj@gmail.com','nutchanonkhongkeaw@gmail.com','nichkitti@gmail.com','kamonwan4612@gmail.com');
update public.profiles p set role = 'coach'
  from public.roster r where r.claimed_by = p.id and r.role = 'ta' and p.role <> 'coach';

-- เพิ่ม 2026-09-05: chonlaphon@gmail.com เป็น TA บ้าน WISDOM
insert into public.roster (email, house_id, role) values ('chonlaphon@gmail.com', 1, 'ta')
  on conflict (email) do update set role = 'ta', house_id = 1;
update public.profiles p set role = 'coach', house_id = 1
  from public.roster r where r.claimed_by = p.id and r.email = 'chonlaphon@gmail.com';
