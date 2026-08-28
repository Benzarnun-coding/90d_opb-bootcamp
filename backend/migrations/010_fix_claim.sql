-- ============================================================
-- แก้บั๊ก: สมัครไม่ได้เลยสักคน
--
-- claim_roster เดิมเป็น BEFORE INSERT แล้วสั่ง
--   update roster set claimed_by = new.id
-- แต่ตอนนั้นแถวใน profiles ยังไม่ถูกเขียน FK roster_claimed_by_fkey เลยฟ้อง
--
-- แยกเป็นสองจังหวะ
--   BEFORE INSERT — เช็คสิทธิ์ + ใส่ห้องให้ (ยังไม่แตะ roster)
--   AFTER  INSERT — ค่อยจองชื่อในรายชื่อ ตอนนี้แถว profiles มีจริงแล้ว
--
-- และเลิกบังคับ handle เพราะหน้าสมัครไม่ถามแล้ว ดึงจากอีเมลให้อัตโนมัติ
--
-- รันหลัง 001-009
-- ============================================================

-- ------------------------------------------------------------
-- 1. handle ไม่ต้องกรอกเองแล้ว ระบบเติมจากอีเมล
-- ------------------------------------------------------------
alter table public.profiles alter column handle drop not null;

create or replace function public.handle_from_email(em text)
returns text language sql immutable as $fn$
  select '@' || left(regexp_replace(split_part(lower(em), '@', 1), '[^a-z0-9._-]', '', 'g'), 30);
$fn$;

-- ------------------------------------------------------------
-- 2. BEFORE INSERT — เช็คว่ามีชื่อในรายชื่อไหม แล้วใส่ห้อง
-- ------------------------------------------------------------
create or replace function public.claim_roster()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  em citext;
  r  public.roster%rowtype;
begin
  if new.role = 'coach' then return new; end if;

  select u.email into em from auth.users u where u.id = new.id;
  if em is null then
    raise exception 'ไม่พบอีเมลของบัญชีนี้';
  end if;

  select * into r from public.roster where email = em;
  if r.email is null then
    raise exception 'อีเมล % ไม่อยู่ในรายชื่อรุ่นนี้ ติดต่อทีมงานเพื่อเพิ่มชื่อก่อน', em;
  end if;
  if r.claimed_by is not null and r.claimed_by <> new.id then
    raise exception 'อีเมล % ถูกใช้สมัครไปแล้ว', em;
  end if;

  new.house_id := r.house_id;

  -- ไม่ได้กรอก handle มา ก็เอาจากอีเมล
  if new.handle is null or length(trim(new.handle)) < 3 then
    new.handle := public.handle_from_email(em::text);
  end if;

  return new;
end $fn$;

-- ------------------------------------------------------------
-- 3. AFTER INSERT — จองชื่อในรายชื่อ ตอนนี้ profiles มีแถวจริงแล้ว
-- ------------------------------------------------------------
create or replace function public.claim_roster_after()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare em citext;
begin
  select u.email into em from auth.users u where u.id = new.id;
  if em is not null then
    update public.roster
       set claimed_by = new.id, claimed_at = now()
     where email = em and claimed_by is null;
  end if;
  return new;
end $fn$;

drop trigger if exists trg_claim_roster_after on public.profiles;
create trigger trg_claim_roster_after
  after insert on public.profiles
  for each row execute function public.claim_roster_after();

select 'ok' as status,
       public.handle_from_email('arnun.tre@gmail.com') as sample_handle;
