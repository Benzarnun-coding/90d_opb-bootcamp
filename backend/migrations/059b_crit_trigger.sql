-- 059b: Critical hit (ส่วน 2/3) — ตัวสุ่ม + ตัวกันแก้ (รันหลัง 059a)
-- สุ่มด้วย random() ของเซิร์ฟเวอร์จริง ๆ · ผลของ (คนส่ง + ลิงก์) ถูกจำใน crit_rolls: ลบแล้วส่งลิงก์เดิมซ้ำได้ผลเดิม ไม่ได้สุ่มใหม่
create or replace function public.roll_crit() returns trigger language plpgsql security definer set search_path = public as $fn$
declare prole text; phouse int; prev smallint; r double precision; p3 double precision; p5 double precision; p10 double precision;
begin
  new.crit := 1;
  prole := (select role::text from public.profiles where id = new.profile_id);
  phouse := (select house_id from public.profiles where id = new.profile_id);
  if prole = 'student' or (prole = 'coach' and phouse is not null) then
    if exists (select 1 from public.bosses b where b.week_no = public.week_of_ts(coalesce(new.created_at, now())) and (b.house_id is null or b.house_id = phouse)) then
      prev := (select cr.crit from public.crit_rolls cr where cr.profile_id = new.profile_id and cr.url_key = coalesce(new.url_key, new.url));
      if prev is not null then
        new.crit := prev;
      else
        p3 := (select crit3 from public.cohort where id = 1);
        p5 := (select crit5 from public.cohort where id = 1);
        p10 := (select crit10 from public.cohort where id = 1);
        r := random();
        new.crit := case when r < p10 then 10 when r < p10 + p5 then 5 when r < p10 + p5 + p3 then 3 else 1 end;
        insert into public.crit_rolls (profile_id, url_key, crit) values (new.profile_id, coalesce(new.url_key, new.url), new.crit) on conflict do nothing;
      end if;
    end if;
  end if;
  return new;
end $fn$;

drop trigger if exists trg_zz_roll_crit on public.submissions;
create trigger trg_zz_roll_crit before insert on public.submissions for each row execute function public.roll_crit();

create or replace function public.keep_crit() returns trigger language plpgsql as $fn$
begin
  if auth.uid() is not null and new.crit is distinct from old.crit then new.crit := old.crit; end if;
  return new;
end $fn$;

drop trigger if exists trg_zz_keep_crit on public.submissions;
create trigger trg_zz_keep_crit before update on public.submissions for each row execute function public.keep_crit();

select '059b ok' as ok, (select count(*) from pg_trigger where tgname in ('trg_zz_roll_crit', 'trg_zz_keep_crit')) as triggers_installed;
