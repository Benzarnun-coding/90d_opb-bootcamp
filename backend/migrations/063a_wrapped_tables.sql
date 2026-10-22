-- 063a: WRAPPED (สรุป 90 วัน) — สวิตช์เปิด/ปิด + ตารางเก็บสถิติรายคน
-- นักเรียนอ่านตารางตรงไม่ได้เลย (ไม่มี policy + ถอนสิทธิ์) ต้องผ่านฟังก์ชันใน 063b เท่านั้น
-- wrapped_open = false จนกว่าหัวหน้าโค้ชกดเปิดในหน้า admin · รันก่อน 063b
alter table public.cohort add column if not exists wrapped_open boolean not null default false;

create table if not exists public.wrapped_stats (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  data       jsonb not null,
  built_at   timestamptz not null default now()
);
alter table public.wrapped_stats enable row level security;
revoke all on public.wrapped_stats from anon, authenticated;

select 'wrapped tables ok' as ok, wrapped_open from public.cohort where id = 1;
