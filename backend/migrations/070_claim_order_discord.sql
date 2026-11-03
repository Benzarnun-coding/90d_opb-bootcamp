-- 070: ทุกครั้งที่มีคนกรอกที่อยู่รับหนังสือ (คริ ×10 หรือสลากบอส) → ส่งบรีฟสั่งซื้อเข้าห้อง Discord "ส่วนตัว" ของ Benz ทันที
-- ที่อยู่ไปห้องนี้เท่านั้น (ห้องต้องเป็นห้องที่ Benz เห็นคนเดียว) · ไม่เข้าห้องน้องเขียวปั่นสาธารณะ
-- ตั้ง webhook ของห้องส่วนตัว (Benz รันเอง · URL เป็นรหัสลับ ไม่เก็บไว้ในไฟล์นี้):
--   insert into public.private_config (key, value) values ('orders_webhook', 'https://discord.com/api/webhooks/...') on conflict (key) do update set value = excluded.value;
-- ยังไม่ตั้ง = ฟังก์ชันเงียบ ไม่กระทบการรับรางวัล · ย้อนกลับ: drop trigger crit_claim_order on public.crit_claims;
create or replace function public.orders_send(msg text) returns void
language plpgsql security definer set search_path = public as $fn$
declare url text; body text := msg; mid text; allow jsonb := jsonb_build_object('parse', '[]'::jsonb);
begin
  select value into url from public.private_config where key = 'orders_webhook';
  if url is null or url = '' then return; end if;
  if length(body) > 1800 then body := left(body, 1800) || E'\n…'; end if;
  -- แท็ก Benz: private_config 'orders_mention' = เลข Discord User ID (ตัวเลขล้วน) หรือคำว่า everyone (เฉพาะห้องที่ Benz อยู่คนเดียว) · ไม่ตั้ง = ไม่แท็ก
  select value into mid from public.private_config where key = 'orders_mention';
  if mid ~ '^[0-9]{15,25}$' then body := '<@' || mid || '> ' || body; allow := jsonb_build_object('users', jsonb_build_array(mid));
  elsif mid = 'everyone' then body := '@everyone ' || body; allow := jsonb_build_object('parse', jsonb_build_array('everyone'));
  end if;
  perform net.http_post(url := url,
    body := jsonb_build_object('content', body, 'allowed_mentions', allow),
    headers := '{"Content-Type":"application/json"}'::jsonb);
exception when others then null;
end $fn$;
revoke execute on function public.orders_send(text) from public, anon, authenticated;

create or replace function public.crit_claim_order() returns trigger
language plpgsql security definer set search_path = public, auth as $fn$
declare who text; hdl text; em text; src text;
begin
  select p.name, p.handle into who, hdl from public.profiles p where p.id = new.profile_id;
  select u.email into em from auth.users u where u.id = new.profile_id;
  src := case when coalesce(new.sub_id, 0) < 0 then '🎲 ผู้โชคดีจากสลากบอส' else '💥 ติดคริติคอล ×10' end;
  perform public.orders_send(
    '📚 **ไปสั่งหนังสือได้เลย** · ' || src || E'\n' ||
    '**หนังสือ:** ' || new.book || ' (1 เล่ม จัดส่งถึงบ้าน)' || E'\n\n' ||
    '**ผู้รับ:** ' || new.recipient || E'\n' ||
    '**โทร:** ' || new.phone || E'\n' ||
    '**ที่อยู่:** ' || new.address || E'\n\n' ||
    '**นักเรียน:** ' || coalesce(who, '-') || coalesce(' (' || hdl || ')', '') || ' · ' || coalesce(em, '-') || E'\n' ||
    '**กรอกเมื่อ:** ' || to_char(new.claimed_at at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') || E'\n' ||
    'สั่งเสร็จแล้วติ๊ก "ส่งแล้ว" ที่ admin > รางวัลคริ ×10');
  return new;
exception when others then return new;
end $fn$;
revoke execute on function public.crit_claim_order() from public, anon, authenticated;

drop trigger if exists crit_claim_order on public.crit_claims;
create trigger crit_claim_order after insert on public.crit_claims
  for each row when (new.address is not null and new.address <> '' and new.address <> '-')
  execute function public.crit_claim_order();

select '070 ok' as ok, exists (select 1 from public.private_config where key = 'orders_webhook') as has_orders_webhook;
