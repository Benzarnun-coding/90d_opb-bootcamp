-- 059a: Critical hit (ส่วน 1/3) — คอลัมน์ + ตารางจำผลสุ่ม · โอกาสต่อ 1 ชิ้น: x3 = 2% · x5 = 0.5% · x10 = 0.1%
-- ปรับโอกาสได้ที่ cohort.crit3 / crit5 / crit10 · รันตามลำดับ 059a -> 059b -> 059c
alter table public.submissions add column if not exists crit smallint not null default 1;
alter table public.cohort add column if not exists crit3 double precision not null default 0.02;
alter table public.cohort add column if not exists crit5 double precision not null default 0.005;
alter table public.cohort add column if not exists crit10 double precision not null default 0.001;

create table if not exists public.crit_rolls (profile_id uuid not null, url_key text not null, crit smallint not null, primary key (profile_id, url_key));
alter table public.crit_rolls enable row level security;
revoke all on public.crit_rolls from anon, authenticated;

select '059a ok' as ok, (select crit3 + crit5 + crit10 from public.cohort where id = 1) as total_crit_chance;
