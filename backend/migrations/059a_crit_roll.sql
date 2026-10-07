-- 059a: Critical hit (ส่วน 1/2) — สุ่มจริงตอนส่งงาน ×3 / ×5 / ×10 ฟรี · โอกาสน้อยมากแบบเกมจริง
-- สุ่มด้วย random() ของเซิร์ฟเวอร์จริง ๆ ทุกครั้ง · กันรีดวง: ผลสุ่มของ (คนส่ง + ลิงก์) ถูกจำไว้ใน crit_rolls
--   ลบงานแล้วส่งลิงก์เดิมซ้ำ = ได้ผลเดิม ไม่ได้สุ่มใหม่
-- สุ่มเฉพาะงานที่ส่งตอนมีบอสของสัปดาห์นั้น และคนส่งตีบอสได้ (นักเรียน + TA) · งานเก่าเป็น ×1 ทั้งหมด
-- โอกาสต่อ 1 ชิ้น: ×3 = 2% · ×5 = 0.5% · ×10 = 0.1% (รวม 2.6%) ปรับได้ที่ cohort.crit3 / crit5 / crit10
alter table public.submissions add column if not exists crit smallint not null default 1;
alter table public.cohort add column if not exists crit3 double precision not null default 0.02;
alter table public.cohort add column if not exists crit5 double precision not null default 0.005;
alter table public.cohort add column if not exists crit10 double precision not null default 0.001;

create table if not exists public.crit_rolls (profile_id uuid not null, url_key text not null, crit smallint not null, primary key (profile_id, url_key));
alter table public.crit_rolls enable row level security;
revoke all on public.crit_rolls from anon, authenticated;

create or replace function public.roll_crit() returns trigger language plpgsql security definer set search_path = public as $fn$
declare c public.cohort%rowtype; p public.profiles%rowtype; prev smallint; r double precision;
begin
  new.crit := 1;
  select * into p from public.profiles where id = new.profile_id;
  if p.role = 'student' or (p.role = 'coach' and p.house_id is not null) then
    if exists (select 1 from public.bosses b where b.week_no = public.week_of_ts(coalesce(new.created_at, now())) and (b.house_id is null or b.house_id = p.house_id)) then
      select cr.crit into prev from public.crit_rolls cr where cr.profile_id = new.profile_id and cr.url_key = coalesce(new.url_key, new.url);
      if prev is not null then
        new.crit := prev;
      else
        select * into c from public.cohort where id = 1;
        r := random();
        new.crit := case when r < c.crit10 then 10 when r < c.crit10 + c.crit5 then 5 when r < c.crit10 + c.crit5 + c.crit3 then 3 else 1 end;
        insert into public.crit_rolls (profile_id, url_key, crit) values (new.profile_id, coalesce(new.url_key, new.url), new.crit) on conflict do nothing;
      end if;
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
