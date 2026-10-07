-- 059a: Critical hit (ส่วน 1/2) — สุ่มตอนส่งงาน ×3 / ×5 / ×10 ฟรี · เซิร์ฟเวอร์สุ่มเอง กันโกง
-- สุ่มจาก hash ของ (เกลือลับ + ลิงก์ที่ normalize แล้ว + คนส่ง) → ลบแล้วส่งลิงก์เดิมซ้ำ ได้ผลเดิม ไม่ใช่การรีดวง
-- สุ่มเฉพาะงานที่ส่งตอนมีบอสของสัปดาห์นั้น และคนส่งตีบอสได้ (นักเรียน + TA) · งานเก่าเป็น ×1 ทั้งหมด
-- ปรับโอกาสได้ที่ cohort.crit3/crit5/crit10 (ค่าเริ่มต้น 4% / 1.5% / 0.5% = ติดเกรด 6% ของงานทั้งหมด)
alter table public.submissions add column if not exists crit smallint not null default 1;
alter table public.cohort add column if not exists crit3 double precision not null default 0.04;
alter table public.cohort add column if not exists crit5 double precision not null default 0.015;
alter table public.cohort add column if not exists crit10 double precision not null default 0.005;
insert into public.private_config (key, value) values ('crit_salt', md5(random()::text || clock_timestamp()::text)) on conflict (key) do nothing;

create or replace function public.roll_crit() returns trigger language plpgsql security definer set search_path = public as $fn$
declare c public.cohort%rowtype; p public.profiles%rowtype; salt text; r double precision;
begin
  new.crit := 1;
  select * into p from public.profiles where id = new.profile_id;
  if p.role = 'student' or (p.role = 'coach' and p.house_id is not null) then
    if exists (select 1 from public.bosses b where b.week_no = public.week_of_ts(coalesce(new.created_at, now())) and (b.house_id is null or b.house_id = p.house_id)) then
      select * into c from public.cohort where id = 1;
      select value into salt from public.private_config where key = 'crit_salt';
      r := (('x' || substr(md5(coalesce(salt, '') || ':' || coalesce(new.url_key, new.url) || ':' || new.profile_id::text), 1, 8))::bit(32)::bigint)::double precision / 4294967296.0;
      new.crit := case when r < c.crit10 then 10 when r < c.crit10 + c.crit5 then 5 when r < c.crit10 + c.crit5 + c.crit3 then 3 else 1 end;
    end if;
  end if;
  return new;
end $fn$;
drop trigger if exists trg_zz_roll_crit on public.submissions;
create trigger trg_zz_roll_crit before insert on public.submissions for each row execute function public.roll_crit();

-- กันเจ้าของงานแก้ค่า crit ของตัวเอง (policy subs_fix_own ให้แก้แถวตัวเองได้) · SQL editor / cron (ไม่มี auth.uid) แก้ได้
create or replace function public.keep_crit() returns trigger language plpgsql as $fn$
begin
  if auth.uid() is not null and new.crit is distinct from old.crit then new.crit := old.crit; end if;
  return new;
end $fn$;
drop trigger if exists trg_zz_keep_crit on public.submissions;
create trigger trg_zz_keep_crit before update on public.submissions for each row execute function public.keep_crit();

select '059a ok' as ok, (select count(*) from public.submissions where crit > 1) as crits_so_far,
       (select crit3 + crit5 + crit10 from public.cohort where id = 1) as total_crit_chance;
