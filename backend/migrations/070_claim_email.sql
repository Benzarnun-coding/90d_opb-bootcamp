-- 070: ทุกครั้งที่มีคนกรอกที่อยู่รับหนังสือ (คริ ×10 หรือสลากบอส) → ส่งอีเมลบรีฟสั่งซื้อให้ Benz ทันที (ที่อยู่เห็นเฉพาะในอีเมลนี้ ไม่เข้า Discord)
-- ต้องมี API key ของ Resend (ฟรี 100 ฉบับ/วัน) · ยังไม่มี key = ฟังก์ชันเงียบ ไม่ทำอะไร ไม่กระทบการรับรางวัล
-- ตั้งค่าครั้งเดียว (Benz รันเอง ใส่ key ของตัวเอง):
--   insert into public.private_config (key, value) values ('resend_key', 're_xxxxxxxx') on conflict (key) do update set value = excluded.value;
-- ผู้รับ: private_config 'notify_email' (ตั้งต้น = อีเมลของ Benz) · ผู้ส่ง onboarding@resend.dev (ใช้ได้ทันทีโดยไม่ต้องยืนยันโดเมน แต่ส่งได้เฉพาะอีเมลที่สมัคร Resend)
-- ย้อนกลับ: drop trigger crit_claim_email on public.crit_claims;
insert into public.private_config (key, value) values ('notify_email', 'arnun.tre@benzarnun.com') on conflict (key) do nothing;

create or replace function public.email_send(subj text, body text) returns void
language plpgsql security definer set search_path = public as $fn$
declare k text; rcpt text;
begin
  select value into k from public.private_config where key = 'resend_key';
  select value into rcpt from public.private_config where key = 'notify_email';
  if coalesce(k, '') = '' or coalesce(rcpt, '') = '' then return; end if;
  perform net.http_post(url := 'https://api.resend.com/emails',
    body := jsonb_build_object('from', 'OPB Bootcamp <onboarding@resend.dev>', 'to', jsonb_build_array(rcpt), 'subject', subj, 'text', body),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || k));
exception when others then null;
end $fn$;
revoke execute on function public.email_send(text, text) from public, anon, authenticated;

create or replace function public.crit_claim_email() returns trigger
language plpgsql security definer set search_path = public, auth as $fn$
declare who text; hdl text; em text; src text; bname text;
begin
  select p.name, p.handle into who, hdl from public.profiles p where p.id = new.profile_id;
  select u.email into em from auth.users u where u.id = new.profile_id;
  src := case when coalesce(new.sub_id, 0) < 0 then 'ผู้โชคดีจากสลากบอส' else 'ติดคริติคอล ×10' end;
  perform public.email_send(
    '📚 สั่งหนังสือให้ ' || coalesce(who, '-') || ': ' || new.book,
    'มีนักเรียนกรอกที่อยู่รับหนังสือรางวัลแล้ว ไปสั่งได้เลย' || E'\n\n' ||
    'รางวัล: หนังสือ 1 เล่ม จัดส่งถึงบ้าน (' || src || ')' || E'\n' ||
    'หนังสือ: ' || new.book || E'\n\n' ||
    'ผู้รับ: ' || new.recipient || E'\n' ||
    'โทร: ' || new.phone || E'\n' ||
    'ที่อยู่: ' || new.address || E'\n\n' ||
    'นักเรียน: ' || coalesce(who, '-') || coalesce(' (' || hdl || ')', '') || E'\n' ||
    'อีเมล: ' || coalesce(em, '-') || E'\n' ||
    'เวลากรอก: ' || to_char(new.claimed_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') || E'\n\n' ||
    'สั่งเสร็จแล้วอย่าลืมติ๊ก "ส่งแล้ว" ในหน้า admin > รางวัลคริ ×10');
  return new;
exception when others then return new;
end $fn$;
revoke execute on function public.crit_claim_email() from public, anon, authenticated;

drop trigger if exists crit_claim_email on public.crit_claims;
create trigger crit_claim_email after insert on public.crit_claims
  for each row when (new.address is not null and new.address <> '' and new.address <> '-')
  execute function public.crit_claim_email();

select '070 ok' as ok, exists (select 1 from public.private_config where key = 'resend_key') as has_resend_key,
  (select value from public.private_config where key = 'notify_email') as notify_to;
