-- 069: บอสทุกตัวต้องมีคนได้หนังสือ (Benz 3 พ.ย.: "ทุกการตีบอสมันต้องมีคนได้หนังสือเล่มนึง ๆ") · รันหลัง 068
-- กติกา: จับทันทีที่บอสล้ม หรือเมื่อสัปดาห์ของบอสจบ (หลังตัดรอบพุธ 20:30) แล้วแต่อย่างไหนมาก่อน ถ้า "ไม่มีใครติดคริ ×10" ในบอสตัวนั้นเลย → จับสลากหา 1 คนจากนักสู้ของบอสตัวนั้น
--   น้ำหนักสลาก = ดาเมจที่ตีไป (ตีมากโอกาสมาก แต่ทุกคนที่ตีมีสิทธิ์) · ไม่รวมหัวหน้าโค้ช · ใช้ได้กับบอสรวมรุ่น (house_id ว่าง) ตัวที่ id >= 4 เท่านั้น (บอสเก่าไม่ย้อนหลัง)
--   ผู้โชคดีได้ป๊อปอัป/กระดิ่งเลือกหนังสือ + กรอกที่อยู่แบบเดียวกับคริ ×10 · แจ้งช่องน้องเขียวปั่นทันที
--   ถ้ามีคนติด ×10 อยู่แล้ว = มีผู้ได้หนังสือแล้ว ไม่จับเพิ่ม
-- cron 'boss-book-draw' ทุก 10 นาที (เบามาก: ไม่มีบอสค้างก็จบทันที) · ย้อนกลับ: select cron.unschedule('boss-book-draw');
create table if not exists public.boss_draws (
  boss_id    bigint primary key references public.bosses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  drawn_at   timestamptz not null default now(),
  pool       int not null default 0
);
alter table public.boss_draws enable row level security;
revoke all on public.boss_draws from public, anon, authenticated;

create or replace function public.boss_book_draw() returns int
language plpgsql security definer set search_path = public as $fn$
declare b record; w record; total int; pick numeric; acc int; n int := 0; who text; win uuid; dead boolean;
begin
  for b in
    select bs.* from public.bosses bs
    where bs.id >= 4 and bs.house_id is null
      and (public.week_end_at(bs.week_no) <= now()
           or exists (select 1 from public.v_boss_progress bp where bp.id = bs.id and bp.damage >= bp.hp))
      and not exists (select 1 from public.boss_draws d where d.boss_id = bs.id)
      and not exists (select 1 from public.v_crit_log l where l.boss_id = bs.id and l.crit = 10)
  loop
    select coalesce(sum(h.hits), 0) into total
      from public.v_boss_hits h join public.profiles p on p.id = h.profile_id
      where h.boss_id = b.id and not (p.role = 'coach' and p.house_id is null);
    if total <= 0 then continue; end if;
    pick := random() * total; acc := 0; win := null;
    for w in
      select h.profile_id, h.hits from public.v_boss_hits h join public.profiles p on p.id = h.profile_id
      where h.boss_id = b.id and not (p.role = 'coach' and p.house_id is null) order by h.profile_id
    loop
      win := w.profile_id; acc := acc + w.hits;
      if acc >= pick then exit; end if;
    end loop;
    insert into public.boss_draws (boss_id, profile_id, pool) values (b.id, win, total) on conflict do nothing;
    select name into who from public.profiles where id = win;
    select (bp.damage >= bp.hp) into dead from public.v_boss_progress bp where bp.id = b.id;
    perform public.discord_send('🎁 **' || b.name || '** ' || case when dead then 'ล้มแล้ว!' else 'จบรอบแล้ว' end || ' · รอบนี้ไม่มีใครติดคริ ×10 เลยจับสลากแจกหนังสือ!' || E'\n🎊 ผู้โชคดีคือ **' || who || '** ได้เลือกหนังสือไปเลย 1 เล่ม 📖 (เข้าเว็บไปเลือกหนังสือ + กรอกที่อยู่ได้เลย)');
    n := n + 1;
  end loop;
  return n;
end $fn$;
revoke execute on function public.boss_book_draw() from public, anon, authenticated;

-- รายการรอรับ: คริ ×10 + สลากบอส (สลากใช้ sub_id ติดลบ = -เลขบอส, kind = 'draw')
create or replace function public.crit10_pending() returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(t.x order by t.at) from (
    select s.created_at as at, jsonb_build_object('sub_id', s.id, 'kind', 'crit10', 'at', s.created_at, 'week', v.week_no,
             'boss', (select b.name from public.bosses b where b.week_no = v.week_no and b.house_id is null order by b.id limit 1)) as x
    from public.submissions s join public.v_counted v on v.id = s.id
    where s.profile_id = auth.uid() and s.crit = 10
      and not exists (select 1 from public.crit_claims c where c.profile_id = s.profile_id and c.url_key = s.url_key)
    union all
    select d.drawn_at, jsonb_build_object('sub_id', -d.boss_id, 'kind', 'draw', 'at', d.drawn_at, 'week', b.week_no, 'boss', b.name)
    from public.boss_draws d join public.bosses b on b.id = d.boss_id
    where d.profile_id = auth.uid()
      and not exists (select 1 from public.crit_claims c where c.profile_id = d.profile_id and c.url_key = 'draw:' || d.boss_id)
  ) t), '[]'::jsonb);
end $fn$;

create or replace function public.crit10_claim(p_sub bigint, p_book text, p_name text, p_phone text, p_address text) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare s record; title text := public.crit_book_title(p_book); who text; ukey text; sid bigint; draw boolean := p_sub < 0; bname text;
        nm text := btrim(coalesce(p_name, '')); ph text := btrim(coalesce(p_phone, '')); ad text := btrim(coalesce(p_address, ''));
begin
  if auth.uid() is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if title is null then raise exception 'เลือกหนังสือก่อน'; end if;
  if char_length(nm) < 2 or char_length(nm) > 80 then raise exception 'กรอกชื่อผู้รับ'; end if;
  if ph !~ '^[0-9+() -]{8,20}$' then raise exception 'เบอร์โทรไม่ถูกต้อง'; end if;
  if char_length(ad) < 10 or char_length(ad) > 400 then raise exception 'กรอกที่อยู่ให้ครบ (บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์)'; end if;
  if draw then
    select d.boss_id into sid from public.boss_draws d where d.boss_id = -p_sub and d.profile_id = auth.uid();
    if sid is null then raise exception 'ไม่พบรางวัลของคุณ'; end if;
    ukey := 'draw:' || sid; sid := p_sub;
  else
    select x.id, x.url_key into s from public.submissions x join public.v_counted v on v.id = x.id
      where x.id = p_sub and x.profile_id = auth.uid() and x.crit = 10;
    if s.id is null then raise exception 'ไม่พบรางวัล ×10 ของคุณ'; end if;
    ukey := s.url_key; sid := s.id;
  end if;
  begin
    insert into public.crit_claims (profile_id, url_key, sub_id, book_key, book, recipient, phone, address)
    values (auth.uid(), ukey, sid, p_book, title, nm, ph, ad);
  exception when unique_violation then raise exception 'รางวัลนี้รับไปแล้ว';
  end;
  select name into who from public.profiles where id = auth.uid();
  perform public.discord_send('📦 **' || who || '** เลือกหนังสือรางวัล' || case when draw then 'จากสลากบอส' else 'คริ ×10' end || ' แล้ว: ' || title || E'\nขอให้ถึงมือไวๆ นะ 🎁');
  return jsonb_build_object('ok', true, 'book', title);
end $fn$;

-- หน้า admin: บอกว่าได้มาจากสลากหรือคริ
create or replace function public.crit10_claims_list() returns jsonb
language plpgsql security definer set search_path = public, auth as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', p.name, 'handle', p.handle, 'email', u.email, 'book', c.book, 'recipient', c.recipient,
           'phone', c.phone, 'address', c.address, 'claimed_at', c.claimed_at, 'shipped_at', c.shipped_at, 'draw', coalesce(c.sub_id < 0, false)) order by c.claimed_at desc)
    from public.crit_claims c join public.profiles p on p.id = c.profile_id left join auth.users u on u.id = c.profile_id), '[]'::jsonb);
end $fn$;

select cron.unschedule(jobid) from cron.job where jobname = 'boss-book-draw';
select cron.schedule('boss-book-draw', '*/10 * * * *', $c$ select public.boss_book_draw(); $c$);

notify pgrst, 'reload schema';
select 'boss draw ok' as ok, (select count(*) from public.boss_draws) as draws,
  (select schedule from cron.job where jobname = 'boss-book-draw') as cron_schedule,
  (select count(*) from public.bosses b where b.id >= 4 and b.house_id is null and public.week_end_at(b.week_no) <= now()) as bosses_already_ended;
