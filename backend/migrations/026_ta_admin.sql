-- ============================================================
-- หน้า TA (ta.html): TA ดูแลบ้านตัวเอง
--   · ลบ / แก้แพลตฟอร์มงานของนักเรียนในบ้าน
--   · ย้ายนักเรียนไปบ้านอื่น — ต้องยืนยันรหัสเข้าใช้รวมทุกครั้ง, ห้ามลบคน
--   · ประวัติการย้ายเก็บใน house_moves
-- รันหลัง 001-025 (ต้องมี login_code จาก 025)
-- ============================================================
create or replace function public.is_ta()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach' and house_id is not null);
$fn$;
grant execute on function public.is_ta() to authenticated;

create table if not exists public.house_moves (
  id         bigint generated always as identity primary key,
  email      citext not null,
  from_house smallint,
  to_house   smallint not null references public.houses(id),
  moved_by   uuid references public.profiles(id) on delete set null,
  moved_at   timestamptz not null default now(),
  note       text
);
alter table public.house_moves enable row level security;
drop policy if exists moves_read on public.house_moves;
create policy moves_read on public.house_moves for select to authenticated
  using (public.is_head_coach() or public.is_ta());
grant select on public.house_moves to authenticated;

-- ย้ายนักเรียน: TA ย้ายได้เฉพาะคนในบ้านตัวเอง ต้องใส่รหัสรวมถูก
create or replace function public.ta_move_student(em text, hid smallint, code text)
returns void language plpgsql security definer set search_path = public as $fn$
declare r public.roster%rowtype; prole text; nm text;
begin
  if not (public.is_ta() or public.is_head_coach()) then raise exception 'เฉพาะ TA หรือหัวหน้าโค้ชเท่านั้น'; end if;
  if not exists (select 1 from public.houses where id = hid) then raise exception 'ไม่พบบ้านปลายทาง'; end if;
  if not public.login_code_set() then raise exception 'ยังไม่ได้ตั้งรหัสเข้าใช้รวม ให้หัวหน้าโค้ชตั้งในหน้า admin ก่อน'; end if;
  if not public.login_code_ok(code) then raise exception 'รหัสยืนยันไม่ถูกต้อง'; end if;
  select * into r from public.roster where email = em::citext;
  if r.email is null then raise exception 'ไม่พบอีเมลนี้ในรายชื่อ'; end if;
  if public.is_ta() and r.house_id <> public.my_house() then raise exception 'ย้ายได้เฉพาะคนในบ้านของคุณ'; end if;
  if r.role = 'ta' then raise exception 'ย้าย TA ไม่ได้ ให้หัวหน้าโค้ชทำ'; end if;
  if r.claimed_by is not null then
    select role into prole from public.profiles where id = r.claimed_by;
    if prole = 'coach' then raise exception 'ย้ายโค้ช/TA ไม่ได้ ให้หัวหน้าโค้ชทำ'; end if;
  end if;
  if r.house_id = hid then raise exception 'อยู่บ้านนี้อยู่แล้ว'; end if;
  update public.roster set house_id = hid where email = r.email;
  update public.profiles set house_id = hid where id = r.claimed_by and role = 'student';
  select name into nm from public.profiles where id = auth.uid();
  insert into public.house_moves (email, from_house, to_house, moved_by, note)
  values (r.email, r.house_id, hid, auth.uid(), 'โดย ' || coalesce(nm, 'TA'));
end $fn$;
grant execute on function public.ta_move_student(text, smallint, text) to authenticated;

-- ลบงานของนักเรียนในบ้าน
create or replace function public.ta_delete_submission(sid bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare owner uuid; ohouse smallint; n int;
begin
  if not (public.is_ta() or public.is_head_coach()) then raise exception 'เฉพาะ TA หรือหัวหน้าโค้ชเท่านั้น'; end if;
  select s.profile_id, p.house_id into owner, ohouse from public.submissions s join public.profiles p on p.id = s.profile_id where s.id = sid;
  if owner is null then raise exception 'ไม่พบงานชิ้นนี้'; end if;
  if public.is_ta() and ohouse is distinct from public.my_house() then raise exception 'ลบได้เฉพาะงานของคนในบ้านคุณ'; end if;
  delete from public.submissions where id = sid;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'ลบไม่สำเร็จ'; end if;
end $fn$;
grant execute on function public.ta_delete_submission(bigint) to authenticated;

-- แก้แพลตฟอร์มงานของนักเรียนในบ้าน
create or replace function public.ta_fix_platform(sid bigint, plat text)
returns void language plpgsql security definer set search_path = public as $fn$
declare ohouse smallint;
begin
  if not (public.is_ta() or public.is_head_coach()) then raise exception 'เฉพาะ TA หรือหัวหน้าโค้ชเท่านั้น'; end if;
  select p.house_id into ohouse from public.submissions s join public.profiles p on p.id = s.profile_id where s.id = sid;
  if public.is_ta() and ohouse is distinct from public.my_house() then raise exception 'แก้ได้เฉพาะงานของคนในบ้านคุณ'; end if;
  update public.submissions set platform = plat where id = sid;
end $fn$;
grant execute on function public.ta_fix_platform(bigint, text) to authenticated;

-- trigger ตรวจงาน: ให้ TA ของบ้านเปลี่ยนได้เฉพาะแพลตฟอร์ม (เหมือนเจ้าของงาน)
create or replace function public.on_submission_review()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare p text; ohouse smallint;
begin
  if not public.is_head_coach() then
    select house_id into ohouse from public.profiles where id = old.profile_id;
    if auth.uid() = old.profile_id or (public.is_ta() and ohouse = public.my_house()) then
      p := new.platform;
      new := old;
      new.platform := p;
      return new;
    end if;
    raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้นที่แก้สถานะงานได้';
  end if;
  new.profile_id := old.profile_id;
  new.url        := old.url;
  new.url_key    := old.url_key;
  new.day_index  := old.day_index;
  new.sprint_idx := old.sprint_idx;
  new.created_at := old.created_at;
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end $fn$;
