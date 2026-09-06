-- ============================================================
-- รหัสเข้าใช้รวม + รีเซ็ตรหัสให้คนที่พิมพ์รหัสผิดตอนสมัครครั้งแรก
--
-- ปัญหา: เข้าครั้งแรก = สมัครด้วยรหัสที่พิมพ์มา ถ้าพิมพ์ผิด (มือถือเติมช่องว่าง/ตัวใหญ่)
--        บัญชีจะจำรหัสผิดนั้น พอไปเข้าเครื่องอื่นด้วยรหัสจริงจะขึ้น "รหัสไม่ถูกต้อง"
-- แก้:   1) ตอนสมัครใหม่ต้องตรงกับรหัสรวมที่หัวหน้าโค้ชตั้งไว้เท่านั้น (login_code_ok)
--        2) หัวหน้าโค้ชกด "รีเซ็ตรหัส" ในหน้า admin → รหัสของบัญชีนั้นกลับเป็นรหัสรวม
-- หัวหน้าโค้ชตั้งรหัสรวมเองในหน้า admin (admin_set_login_code) — ไม่มีใครอ่านค่าตรง ๆ ได้
-- ============================================================
create table if not exists public.login_code (
  id    smallint primary key default 1 check (id = 1),
  code  text not null,
  set_at timestamptz not null default now()
);
alter table public.login_code enable row level security;      -- ไม่มี policy = อ่านตรงไม่ได้ ผ่านฟังก์ชันเท่านั้น
revoke all on public.login_code from anon, authenticated;

create or replace function public.admin_set_login_code(c text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  if c is null or length(trim(c)) < 4 then raise exception 'รหัสต้องยาวอย่างน้อย 4 ตัว'; end if;
  insert into public.login_code (id, code, set_at) values (1, trim(c), now())
  on conflict (id) do update set code = excluded.code, set_at = now();
end $fn$;
grant execute on function public.admin_set_login_code(text) to authenticated;

create or replace function public.login_code_set()
returns boolean language sql security definer stable set search_path = public as $fn$
  select exists (select 1 from public.login_code where id = 1);
$fn$;
grant execute on function public.login_code_set() to anon, authenticated;

-- ยังไม่ได้ตั้งรหัสรวม → ปล่อยผ่านเหมือนเดิม
create or replace function public.login_code_ok(c text)
returns boolean language sql security definer stable set search_path = public as $fn$
  select coalesce((select code = trim(c) from public.login_code where id = 1), true);
$fn$;
grant execute on function public.login_code_ok(text) to anon, authenticated;

-- รีเซ็ตรหัสของบัญชีให้กลับเป็นรหัสรวม (เฉพาะหัวหน้าโค้ช)
create or replace function public.admin_reset_password(em text)
returns void language plpgsql security definer set search_path = public, extensions as $fn$
declare c text; n int;
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  select code into c from public.login_code where id = 1;
  if c is null then raise exception 'ยังไม่ได้ตั้งรหัสเข้าใช้รวมในหน้า admin'; end if;
  update auth.users
     set encrypted_password = extensions.crypt(c, extensions.gen_salt('bf')),
         updated_at = now()
   where email = em;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'ไม่พบบัญชีของ % (ยังไม่เคยเข้าใช้)', em; end if;
end $fn$;
grant execute on function public.admin_reset_password(text) to authenticated;
