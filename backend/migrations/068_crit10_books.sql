-- 068: คริ ×10 = เลือกหนังสือ 1 เล่ม (ฉบับแปลไทย 7 เล่ม) + กรอกที่อยู่จัดส่ง (Benz 2 พ.ย.) · รันหลัง 067
-- 1) ตาราง crit_claims เก็บการเลือกหนังสือ + ที่อยู่: ปิดสิทธิ์ตรงทั้งหมด · "ผู้รับเห็นเฉพาะของตัวเอง ผ่านฟังก์ชัน" · หัวหน้าโค้ชคนเดียวอ่านได้ (is_head_coach: TA ไม่เห็น)
-- 2) crit10_pending() = รายการ ×10 ของฉันที่ยังไม่ได้รับรางวัล (กระดิ่ง/ป๊อปอัปใช้) · crit10_claim(...) = รับรางวัล (เช็คฝั่งเซิร์ฟเวอร์ว่าติด ×10 จริง ชิ้นเดียวรับได้ครั้งเดียว
--    กุญแจคือ (คนส่ง + url_key) ไม่ใช่เลขชิ้นงาน ลบแล้วส่งลิงก์เดิมใหม่ก็ไม่ได้รับซ้ำ)
-- 3) crit10_claims_list() / crit10_set_shipped() สำหรับหน้า admin (หัวหน้าโค้ชเท่านั้น)
-- 4) ติด ×10 ปุ๊บ → แจ้งช่องน้องเขียวปั่น (trigger กันพลาด: ส่งไม่ได้ก็ไม่ขัดการส่งงาน) · รับรางวัลแล้วแจ้งอีกรอบ (ไม่ใส่ที่อยู่/เบอร์)
-- 5) สรุป 20:00: เอาบรรทัด "เหลือเวลา… ช่วยกันตีให้ล้ม!" ออก + เพิ่มบรรทัดผู้โชคดีคริ ×10 ของวัน
-- ย้อนกลับ: drop trigger trg_zz_announce_crit10 on public.submissions; แล้วรัน 067 ซ้ำเพื่อคืน digest_text เดิม

-- ตัวส่ง Discord ภายใน (ไม่เปิดให้ใครเรียกตรง — เรียกจากฟังก์ชัน security definer ข้างล่างเท่านั้น) · ไม่ปิงใคร · พังเงียบ ๆ ไม่ขัดงานหลัก
create or replace function public.discord_send(msg text) returns void
language plpgsql security definer set search_path = public as $fn$
declare url text; body text := msg;
begin
  select value into url from public.private_config where key = 'discord_webhook';
  if url is null or url = '' then return; end if;
  if length(body) > 1900 then body := regexp_replace(left(body, 1900), E'\n[^\n]*$', '') || E'\n…'; end if;
  perform net.http_post(url := url,
    body := jsonb_build_object('content', body, 'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb)),
    headers := '{"Content-Type":"application/json"}'::jsonb);
exception when others then null;
end $fn$;
revoke execute on function public.discord_send(text) from public, anon, authenticated;

alter table public.crit_rolls add column if not exists announced boolean not null default false;

create table if not exists public.crit_claims (
  id         bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  url_key    text not null,
  sub_id     bigint,
  book_key   text not null,
  book       text not null,
  recipient  text not null,
  phone      text not null,
  address    text not null,
  claimed_at timestamptz not null default now(),
  shipped_at timestamptz,
  unique (profile_id, url_key)
);
alter table public.crit_claims enable row level security;
revoke all on public.crit_claims from public, anon, authenticated;

create or replace function public.crit_book_title(k text) returns text language sql immutable as $fn$
  select case k
    when 'mdw'   then 'Million Dollar Weekend สุดสัปดาห์ล่าเงินล้าน'
    when 'naval' then 'คู่มือสร้างความมั่งคั่งและความสุขฉบับนายนาวาล (The Almanack of Naval Ravikant)'
    when 'sae'   then 'Same as Ever จิตวิทยาเอาชนะอนาคต'
    when 'coo'   then 'บริษัทตัวคนเดียว (Company of One)'
    when 'bsb'   then 'พลังแห่งสมองที่สอง (Building a Second Brain)'
    when 'dw'    then 'Deep Work ดำดิ่งท่ามกลางสิ่งรบกวน'
    when 'te'    then 'Tiny Experiments ชีวิตนี้คือเวอร์ชั่นทดลอง'
  end
$fn$;
revoke execute on function public.crit_book_title(text) from public, anon, authenticated;

create or replace function public.crit10_pending() returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('sub_id', s.id, 'at', s.created_at, 'week', v.week_no,
             'boss', (select b.name from public.bosses b where b.week_no = v.week_no and b.house_id is null order by b.id limit 1)) order by s.created_at)
    from public.submissions s join public.v_counted v on v.id = s.id
    where s.profile_id = auth.uid() and s.crit = 10
      and not exists (select 1 from public.crit_claims c where c.profile_id = s.profile_id and c.url_key = s.url_key)), '[]'::jsonb);
end $fn$;

create or replace function public.crit10_claim(p_sub bigint, p_book text, p_name text, p_phone text, p_address text) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare s record; title text := public.crit_book_title(p_book); who text; nm text := btrim(coalesce(p_name, '')); ph text := btrim(coalesce(p_phone, '')); ad text := btrim(coalesce(p_address, ''));
begin
  if auth.uid() is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if title is null then raise exception 'เลือกหนังสือก่อน'; end if;
  if char_length(nm) < 2 or char_length(nm) > 80 then raise exception 'กรอกชื่อผู้รับ'; end if;
  if ph !~ '^[0-9+() -]{8,20}$' then raise exception 'เบอร์โทรไม่ถูกต้อง'; end if;
  if char_length(ad) < 10 or char_length(ad) > 400 then raise exception 'กรอกที่อยู่ให้ครบ (บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์)'; end if;
  select x.id, x.url_key into s from public.submissions x join public.v_counted v on v.id = x.id
    where x.id = p_sub and x.profile_id = auth.uid() and x.crit = 10;
  if s.id is null then raise exception 'ไม่พบรางวัล ×10 ของคุณ'; end if;
  begin
    insert into public.crit_claims (profile_id, url_key, sub_id, book_key, book, recipient, phone, address)
    values (auth.uid(), s.url_key, s.id, p_book, title, nm, ph, ad);
  exception when unique_violation then raise exception 'รางวัลนี้รับไปแล้ว';
  end;
  select name into who from public.profiles where id = auth.uid();
  perform public.discord_send('📦 **' || who || '** เลือกหนังสือรางวัลคริ ×10 แล้ว: ' || title || E'\nขอให้ถึงมือไวๆ นะ 🎁');
  return jsonb_build_object('ok', true, 'book', title);
end $fn$;

create or replace function public.crit10_claims_list() returns jsonb
language plpgsql security definer set search_path = public, auth as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', p.name, 'handle', p.handle, 'email', u.email, 'book', c.book, 'recipient', c.recipient,
           'phone', c.phone, 'address', c.address, 'claimed_at', c.claimed_at, 'shipped_at', c.shipped_at) order by c.claimed_at desc)
    from public.crit_claims c join public.profiles p on p.id = c.profile_id left join auth.users u on u.id = c.profile_id), '[]'::jsonb);
end $fn$;

create or replace function public.crit10_set_shipped(p_id bigint, p_shipped boolean) returns boolean
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  update public.crit_claims set shipped_at = case when p_shipped then now() else null end where id = p_id;
  return p_shipped;
end $fn$;

revoke execute on function public.crit10_pending(), public.crit10_claim(bigint, text, text, text, text), public.crit10_claims_list(), public.crit10_set_shipped(bigint, boolean) from public, anon;
grant execute on function public.crit10_pending(), public.crit10_claim(bigint, text, text, text, text), public.crit10_claims_list(), public.crit10_set_shipped(bigint, boolean) to authenticated;

-- แจ้งช่องน้องเขียวปั่นทันทีที่มีคนติด ×10 (ครั้งแรกต่อชิ้นเท่านั้น ลบ-ส่งใหม่ไม่แจ้งซ้ำ)
create or replace function public.announce_crit10() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare who text; hit int;
begin
  begin
    update public.crit_rolls set announced = true where profile_id = new.profile_id and url_key = new.url_key and not announced;
    get diagnostics hit = row_count;
    if hit > 0 then
      select name into who from public.profiles where id = new.profile_id;
      perform public.discord_send('🎊 **มีผู้โชคดี! ' || who || ' ติดคริติคอล ×10** 💥' || E'\nได้เลือกหนังสือ 1 เล่มไปเลย 📖 (เลือกได้ในเว็บ)');
    end if;
  exception when others then null;
  end;
  return null;
end $fn$;
drop trigger if exists trg_zz_announce_crit10 on public.submissions;
create trigger trg_zz_announce_crit10 after insert on public.submissions for each row when (new.crit = 10) execute function public.announce_crit10();

-- สรุป 20:00 (แทน 067): ไม่มีบรรทัดชวนตีบอส + มีผู้โชคดีคริ ×10 ของวัน
create or replace function public.digest_text()
returns text language plpgsql security definer set search_path = public as $fn$
declare
  d int := public.day_of(now());
  cw int := public.current_week();
  site text := 'https://opb-bootcamp.netlify.app';
  n_posts int; n_people int; t text := ''; b record; top record;
  filled int; duel_live text; duel_done text; lucky text;
begin
  if not public.has_started() then return null; end if;

  select count(*), count(distinct profile_id) into n_posts, n_people from public.v_counted where day_index = d;
  t := '🏁 **วันที่ ' || d || ' · สัปดาห์ที่ ' || cw || '**' || E'\n';
  if n_posts = 0 then
    t := t || '📥 วันนี้ยังเงียบอยู่ — ใครส่งชิ้นแรกเป็นคนแรกของวัน ⚡' || E'\n';
  else
    t := t || '📥 วันนี้ส่งการบ้านกันไปแล้ว **' || n_posts || ' ชิ้น** จาก ' || n_people || ' คน 🔥' || E'\n';
  end if;

  /* ---- บอสสัปดาห์นี้ ---- */
  for b in select * from public.v_boss_progress where week_no = cw order by id loop
    select p.name, h.hits into top
      from public.v_boss_hits h join public.profiles p on p.id = h.profile_id
      where h.boss_id = b.id order by h.hits desc, h.last_at asc limit 1;
    t := t || E'\n' || b.emoji || ' **' || b.name || '**' || E'\n';
    if b.damage >= b.hp then
      t := t || '💀 ล้มแล้ว! ' || b.damage || '/' || b.hp || ' ดาเมจ · ขอบคุณทุกคนที่ช่วยกันตี 🎉' || E'\n';
    else
      filled := least(10, greatest(0, round(b.damage::numeric / b.hp * 10)::int));
      t := t || repeat('🟥', filled) || repeat('⬛', 10 - filled) || E'\n'
        || 'เลือดเหลือ **' || (b.hp - b.damage) || '/' || b.hp || '** · นักสู้ ' || b.fighters || ' คน'
        || case when b.crits > 0 then ' · คริติคอล ' || b.crits || ' ครั้ง 💥' else '' end || E'\n'
        || case when top.name is not null then '👑 MVP ตอนนี้ ' || top.name || ' (' || top.hits || ' ดาเมจ)' || E'\n' else '' end
        || case when b.reward is not null and btrim(split_part(b.reward, E'\n', 1)) <> '' then '🎁 รางวัล: ' || btrim(split_part(b.reward, E'\n', 1)) || E'\n' else '' end;
    end if;
  end loop;

  /* ---- ผู้โชคดีติดคริ ×10 วันนี้ (ได้เลือกหนังสือ) ---- */
  select string_agg(distinct p.name, ', ') into lucky
    from public.v_crit_log l join public.profiles p on p.id = l.profile_id
    where l.crit = 10 and public.day_of(l.created_at) = d;
  if lucky is not null then
    t := t || E'\n🎊 **ผู้โชคดีติดคริ ×10 วันนี้: ' || lucky || '** — ได้เลือกหนังสือไปเลย 1 เล่ม 📖' || E'\n';
  end if;

  /* ---- PVP: คู่ที่กำลังสู้ + ผลที่เพิ่งจบ ---- */
  select string_agg(x.line, E'\n') into duel_live from (
    select '• ' || challenger_name || ' 🆚 ' || opponent_name || ' · ' || challenger_score || '–' || opponent_score
           || case when challenger_score > opponent_score then ' (' || challenger_name || ' นำ)'
                   when challenger_score < opponent_score then ' (' || opponent_name || ' นำ)' else ' (สูสี)' end as line
    from public.v_duels
    where status = 'active' and start_day is not null and d between start_day and end_day
    order by greatest(challenger_score, opponent_score) desc limit 6) x;
  select string_agg(x.line, E'\n') into duel_done from (
    select '• 🏆 ' || case when winner = challenger then challenger_name when winner = opponent then opponent_name end
           || ' ชนะ ' || case when winner = challenger then opponent_name else challenger_name end
           as line
    from public.v_duels
    where status = 'done' and winner is not null and end_day >= d - 1
    order by end_day desc limit 5) x;
  if duel_live is not null or duel_done is not null then
    t := t || E'\n⚔️ **PVP**\n' || coalesce(duel_live || E'\n', '') || coalesce(duel_done || E'\n', '');
  end if;

  return t || E'\n' || site;
end $fn$;
grant execute on function public.digest_text() to authenticated;

notify pgrst, 'reload schema';
select 'crit10 books ok' as ok, (select count(*) from public.crit_claims) as claims, public.crit_book_title('te') is not null as titles_ok;
select public.digest_text() as preview;
