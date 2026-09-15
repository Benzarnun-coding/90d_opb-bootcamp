-- ============================================================
-- 044: กล่องขอฟีเจอร์ / แจ้งบั๊ก ในแอป + โหวต
--
-- นักเรียนส่งคำขอ (bug / idea) ได้วันละไม่เกิน 5 ครั้ง · ทุกคนเห็นรายการและกด 👍 ได้คนละ 1 ต่อคำขอ
-- หัวหน้าโค้ชตั้งสถานะ (new / planned / done / rejected) + ใส่โน้ตตอบกลับจากหน้า admin
-- รันหลัง 043
-- ============================================================

create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('bug','idea')),
  text        text not null check (char_length(text) between 5 and 400),
  page        text,
  status      text not null default 'new' check (status in ('new','planned','done','rejected')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists feedback_status_idx on public.feedback (status, created_at desc);

create table if not exists public.feedback_votes (
  feedback_id bigint not null references public.feedback(id) on delete cascade,
  profile_id  uuid   not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (feedback_id, profile_id)
);

alter table public.feedback       enable row level security;
alter table public.feedback_votes enable row level security;

drop policy if exists fb_read on public.feedback;
create policy fb_read on public.feedback for select to anon, authenticated using (true);
drop policy if exists fb_send on public.feedback;
create policy fb_send on public.feedback for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists fbv_read on public.feedback_votes;
create policy fbv_read on public.feedback_votes for select to anon, authenticated using (true);
drop policy if exists fbv_add on public.feedback_votes;
create policy fbv_add on public.feedback_votes for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists fbv_del on public.feedback_votes;
create policy fbv_del on public.feedback_votes for delete to authenticated using (profile_id = auth.uid());
grant select on public.feedback, public.feedback_votes to anon, authenticated;
grant insert on public.feedback to authenticated;
grant insert, delete on public.feedback_votes to authenticated;

-- กันสแปม: ส่งได้ไม่เกิน 5 ครั้งต่อวัน
create or replace function public.guard_feedback()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if (select count(*) from public.feedback f where f.profile_id = new.profile_id and f.created_at > now() - interval '1 day') >= 5 then
    raise exception 'วันนี้ส่งคำขอครบ 5 ครั้งแล้ว พรุ่งนี้ส่งใหม่ได้';
  end if;
  new.text := btrim(new.text);
  return new;
end $fn$;
drop trigger if exists trg_feedback_guard on public.feedback;
create trigger trg_feedback_guard before insert on public.feedback for each row execute function public.guard_feedback();

-- รายการพร้อมชื่อคนส่ง + จำนวนโหวต
create or replace view public.v_feedback as
select f.id, f.kind, f.text, f.page, f.status, f.admin_note, f.created_at, f.updated_at,
       f.profile_id, p.name as author, p.house_id,
       (select count(*) from public.feedback_votes v where v.feedback_id = f.id)::int as votes
from public.feedback f join public.profiles p on p.id = f.profile_id;
grant select on public.v_feedback to anon, authenticated;

-- หัวหน้าโค้ชตั้งสถานะ + โน้ต
create or replace function public.admin_feedback_set(fid bigint, st text, note text default null)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  update public.feedback set status = st, admin_note = nullif(btrim(coalesce(note, '')), ''), updated_at = now() where id = fid;
  perform public.audit('feedback.status', fid::text, jsonb_build_object('status', st));
end $fn$;
grant execute on function public.admin_feedback_set(bigint, text, text) to authenticated;

select 'feedback ready' as ok;
