-- ============================================================
-- แก้บั๊ก: คนที่ส่วนหน้าอีเมลซ้ำกัน สมัครไม่ได้เลย
--
-- handle_from_email ตัดเอาเฉพาะส่วนหน้า @ ของอีเมล
--   somchai@gmail.com    -> @somchai
--   somchai@hotmail.com  -> @somchai   ← ชนกับ unique index
--
-- ผลคือคนที่สองสมัครไม่ได้ตลอดกาล และข้อความ error ไปโทษว่าชื่อซ้ำ
-- ทั้งที่ปัญหาอยู่ที่ handle ซึ่งผู้ใช้ไม่ได้กรอกเองด้วยซ้ำ
--
-- ในรุ่น 250 คนเรื่องนี้เกิดแน่นอน ชื่อจริงคนไทยซ้ำกันเยอะ
--
-- รันหลัง 001-012
-- ============================================================

-- ------------------------------------------------------------
-- หา handle ที่ยังว่างอยู่ ต่อเลขท้ายถ้าชน
-- ------------------------------------------------------------
create or replace function public.unique_handle(em text, self uuid)
returns text language plpgsql stable as $fn$
declare
  base text := public.handle_from_email(em);
  cand text := base;
  i    int  := 1;
begin
  while exists (select 1 from public.profiles p
                where lower(p.handle) = lower(cand)
                  and (self is null or p.id <> self)) loop
    i := i + 1;
    cand := left(base, 27) || i::text;     -- @somchai2, @somchai3, ...
  end loop;
  return cand;
end $fn$;

-- ------------------------------------------------------------
-- ใช้ตัวใหม่ตอนสมัคร
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

  if new.handle is null or length(trim(new.handle)) < 3 then
    new.handle := public.unique_handle(em::text, new.id);
  end if;

  return new;
end $fn$;

-- ------------------------------------------------------------
-- ตรวจ: จำลองสองอีเมลที่ส่วนหน้าเหมือนกัน
-- ------------------------------------------------------------
select public.handle_from_email('arnun.tre@benzarnun.com') as raw_handle,
       public.unique_handle('arnun.tre@benzarnun.com', null) as safe_handle,
       (select handle from public.profiles limit 1)          as existing_handle;
