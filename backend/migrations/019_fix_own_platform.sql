-- ============================================================
-- นักเรียนแก้แพลตฟอร์มของงานตัวเองได้ (ลืมเปลี่ยน dropdown ตอนส่ง)
-- แก้ได้แค่ platform เท่านั้น — ลิงก์ วัน สถานะ ล็อกไว้เหมือนเดิม
-- หัวหน้าโค้ชยังแก้ได้ทุกอย่างผ่านหน้า admin
-- รันหลัง 001-018
-- ============================================================
create or replace function public.on_submission_review()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare p text;
begin
  /* เจ้าของงาน (ไม่ใช่หัวหน้าโค้ช): รับเฉพาะค่า platform ใหม่ ที่เหลือคืนค่าเดิมทั้งแถว */
  if auth.uid() = old.profile_id and not public.is_head_coach() then
    p := new.platform;
    new := old;
    new.platform := p;
    return new;
  end if;
  if not public.is_head_coach() then
    raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้นที่แก้สถานะงานได้';
  end if;
  new.profile_id := old.profile_id;
  new.url        := old.url;
  new.url_key    := old.url_key;
  new.day_index  := old.day_index;
  new.sprint_idx := old.sprint_idx;
  new.created_at := old.created_at;
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end $fn$;

drop policy if exists subs_fix_own on public.submissions;
create policy subs_fix_own on public.submissions for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

select 'ok' as status;
