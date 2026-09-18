-- ============================================================
-- 048: คำท้าดวลหมดอายุเองใน 7 วัน + ดวลที่ครบ 7 วันปิดผลเอง
--
-- อาการ (18 ก.ย.): ใน Duel Arena มีคำท้า "รอรับคำท้า" ค้างอยู่เรื่อย ๆ (เช่น JARI HAPPY → THE GOAT ค้างตั้งแต่ 10 ก.ย.)
-- ผลเสีย: กติกา "ค้างได้คนละ 1 ดวล" ทำให้ทั้งคนท้าและคนถูกท้าไปดวลกับคนอื่นไม่ได้เลย จนกว่าอีกฝ่ายจะกดรับ/ปฏิเสธ
-- แก้:
--   1. สถานะใหม่ 'expired' — คำท้าที่ไม่มีใครตอบใน 7 วันหมดอายุเอง ทั้งสองฝ่ายกลับไปท้า/ถูกท้าได้
--   2. ดวลที่เลยวันสุดท้ายแล้วแต่ไม่มีใครเปิดแอปมากดปิด → ระบบปิดและคิดผู้ชนะให้ (เดิมรอให้ฝั่งใดฝั่งหนึ่งเปิดแอป)
--   3. pg_cron ทุกชั่วโมง (นาทีที่ 7)
-- หน้าเว็บเดิมซ่อนสถานะที่ไม่รู้จักอยู่แล้ว จึงไม่ต้อง deploy · รันหลัง 047
-- ============================================================

alter table public.duels drop constraint if exists duel_status_ok;
alter table public.duels add constraint duel_status_ok
  check (status in ('pending','active','declined','done','expired'));

create or replace function public.guard_duel()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.duels d where d.status in ('pending','active')
               and (d.challenger in (new.challenger, new.opponent) or d.opponent in (new.challenger, new.opponent))) then
      raise exception 'มีดวลค้างอยู่แล้ว รอให้จบก่อน';
    end if;
    new.status := 'pending';
    return new;
  end if;
  /* UPDATE: ฝั่งที่ถูกท้าเป็นคนรับ/ปฏิเสธ · ตอนจบผู้ชนะเลือกหมวก · ห้ามแก้อย่างอื่น */
  new.challenger := old.challenger; new.opponent := old.opponent; new.created_at := old.created_at;
  if old.status = 'pending' and new.status = 'expired' then
    /* หมดอายุได้จากฝั่งเซิร์ฟเวอร์เท่านั้น (cron / SQL editor) */
    if auth.uid() is not null then raise exception 'แก้ดวลแบบนี้ไม่ได้'; end if;
    new.start_day := null; new.end_day := null; new.winner := null; new.prize_hat := null;
    return new;
  end if;
  if old.status = 'pending' and new.status in ('active','declined') then
    if auth.uid() <> old.opponent then raise exception 'เฉพาะคนถูกท้าเท่านั้นที่รับหรือปฏิเสธได้'; end if;
    if new.status = 'active' then
      new.start_day := public.day_of(now());
      new.end_day   := new.start_day + 6;
    end if;
    new.winner := null; new.prize_hat := null;
    return new;
  end if;
  if old.status = 'active' and new.status = 'done' then
    /* ปิดดวลได้เมื่อเลยวันสุดท้ายแล้ว ใครก็กดปิดได้ ผู้ชนะคิดจากชิ้นที่นับได้ในช่วงดวล */
    if public.day_of(now()) <= old.end_day then raise exception 'ดวลยังไม่จบ'; end if;
    new.start_day := old.start_day; new.end_day := old.end_day;
    select case when c.n > o.n then old.challenger when o.n > c.n then old.opponent else null end into new.winner
    from (select count(*) n from public.v_counted where profile_id = old.challenger and day_index between old.start_day and old.end_day) c,
         (select count(*) n from public.v_counted where profile_id = old.opponent  and day_index between old.start_day and old.end_day) o;
    new.prize_hat := null;
    return new;
  end if;
  if old.status = 'done' and old.prize_hat is null and new.prize_hat is not null then
    if auth.uid() <> old.winner then raise exception 'ผู้ชนะเท่านั้นที่เลือกหมวกได้'; end if;
    new.status := 'done'; new.winner := old.winner; new.start_day := old.start_day; new.end_day := old.end_day;
    return new;
  end if;
  raise exception 'แก้ดวลแบบนี้ไม่ได้';
end $fn$;

create or replace function public.duel_housekeeping() returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare n_exp int; n_done int;
begin
  update public.duels set status = 'expired'
   where status = 'pending' and created_at < now() - interval '7 days';
  get diagnostics n_exp = row_count;

  update public.duels set status = 'done'
   where status = 'active' and end_day is not null and public.day_of(now()) > end_day;
  get diagnostics n_done = row_count;

  return jsonb_build_object('expired', n_exp, 'closed', n_done);
end $fn$;
revoke execute on function public.duel_housekeeping() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'duel-housekeeping';
select cron.schedule('duel-housekeeping', '7 * * * *', $cron$ select public.duel_housekeeping(); $cron$);

-- รอบแรกทันที: ควรเห็น expired ≥ 1 (คำท้าของ JARI HAPPY ตั้งแต่ 10 ก.ย.)
select public.duel_housekeeping() as first_run;
select status, count(*) from public.duels group by status order by status;
