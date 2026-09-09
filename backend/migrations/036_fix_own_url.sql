-- ============================================================
-- 🔗 นักเรียนแก้ลิงก์งานตัวเองได้ (เช่น โพสต์ผิดแอคเคาท์ แล้วลงใหม่)
--    เดิม url / url_key ถูกล็อกไว้หมด แม้แต่หัวหน้าโค้ชก็แก้ไม่ได้ ต้องลบทิ้งอย่างเดียว
--    ใหม่: เจ้าของงาน · TA ของบ้านนั้น · หัวหน้าโค้ช แก้ลิงก์ได้
--    ยังล็อกไว้เหมือนเดิม: วันที่ (day_index) · สปรินต์ · เวลาที่ส่ง → แก้ลิงก์แล้วยอดไม่ขยับ
--    คำนวณ url_key ใหม่ (กันส่งซ้ำ) และตรวจ handle ใหม่ (ธงแดงถ้าลิงก์ไม่ใช่ของเจ้าตัว)
-- รันหลัง 035
-- ============================================================
create or replace function public.on_submission_review()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare p text; v int; lk int; k text; nt text; u text; ohouse smallint; h text; mine boolean;
begin
  if not public.is_head_coach() then
    select house_id into ohouse from public.profiles where id = old.profile_id;
    mine := auth.uid() = old.profile_id;
    if mine or (public.is_ta() and ohouse = public.my_house()) then
      p := new.platform; v := new.views; lk := new.likes; k := new.kind; nt := new.note; u := new.url;
      new := old;
      new.platform := p; new.views := v; new.likes := lk; new.kind := k; new.note := nt;
      if v is distinct from old.views or lk is distinct from old.likes then new.stats_at := now(); end if;
      if u is distinct from old.url then
        if u !~* '^https?://[^ ]+\.[^ ]+' then raise exception 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://'; end if;
        new.url     := u;
        new.url_key := public.norm_url(u);
        select lower(replace(pr.handle, '@', '')) into h from public.profiles pr where pr.id = old.profile_id;
        new.flag := (h is not null and position(h in new.url_key) = 0);
      end if;
      return new;
    end if;
    raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้นที่แก้สถานะงานได้';
  end if;
  new.profile_id := old.profile_id;
  new.day_index  := old.day_index;
  new.sprint_idx := old.sprint_idx;
  new.created_at := old.created_at;
  if new.url is distinct from old.url then
    if new.url !~* '^https?://[^ ]+\.[^ ]+' then raise exception 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://'; end if;
    new.url_key := public.norm_url(new.url);
    select lower(replace(pr.handle, '@', '')) into h from public.profiles pr where pr.id = old.profile_id;
    new.flag := (h is not null and position(h in new.url_key) = 0);
  else
    new.url_key := old.url_key;
  end if;
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end $fn$;

-- RPC สำหรับหน้าเว็บ: ข้อความ error อ่านรู้เรื่อง + บันทึกลงประวัติการแก้ไข
create or replace function public.fix_submission_url(sid bigint, new_url text)
returns void language plpgsql security definer set search_path = public as $fn$
declare s public.submissions%rowtype; ohouse smallint; k text; who text;
begin
  if auth.uid() is null then raise exception 'ต้องเข้าสู่ระบบก่อน'; end if;   -- กัน NULL logic ทำให้เงื่อนไขข้างล่างหลุด
  select * into s from public.submissions where id = sid;
  if not found then raise exception 'ไม่พบงานชิ้นนี้'; end if;
  select house_id into ohouse from public.profiles where id = s.profile_id;
  if not (auth.uid() = s.profile_id or public.is_head_coach() or (public.is_ta() and ohouse is not distinct from public.my_house())) then
    raise exception 'แก้ได้เฉพาะงานของตัวเอง';
  end if;
  new_url := trim(new_url);
  if new_url !~* '^https?://[^ ]+\.[^ ]+' then raise exception 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https:// และเป็นลิงก์เต็ม'; end if;
  k := public.norm_url(new_url);
  if k = s.url_key then return; end if;                       -- ลิงก์เดิม ไม่ต้องทำอะไร
  if exists (select 1 from public.submissions x where x.url_key = k and x.id <> sid) then
    raise exception 'ลิงก์นี้ถูกส่งไปแล้ว ใช้ซ้ำไม่ได้';
  end if;
  update public.submissions set url = new_url where id = sid;
  select name into who from public.profiles where id = auth.uid();
  insert into public.audit_log (actor, actor_name, action, target, detail)
  values (auth.uid(), coalesce(who, 'ไม่ทราบชื่อ'), 'submission.url', sid::text,
          jsonb_build_object('from', s.url, 'to', new_url, 'day', s.day_index));
end $fn$;
grant execute on function public.fix_submission_url(bigint, text) to authenticated;

-- หน้า TA แก้ลิงก์ให้นักเรียนในบ้านได้ด้วย (เลิกใช้เวอร์ชัน 6 อาร์กิวเมนต์ กันเรียกกำกวม)
drop function if exists public.ta_update_submission(bigint, text, int, int, text, text);
create or replace function public.ta_update_submission(sid bigint, plat text default null, v int default null,
                                                       lk int default null, k text default null, nt text default null,
                                                       u text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare ohouse smallint;
begin
  if not (public.is_ta() or public.is_head_coach()) then raise exception 'เฉพาะ TA หรือหัวหน้าโค้ชเท่านั้น'; end if;
  select p.house_id into ohouse from public.submissions s join public.profiles p on p.id = s.profile_id where s.id = sid;
  if public.is_ta() and ohouse is distinct from public.my_house() then raise exception 'แก้ได้เฉพาะงานของคนในบ้านคุณ'; end if;
  update public.submissions set
    platform = coalesce(plat, platform), views = coalesce(v, views), likes = coalesce(lk, likes),
    kind = coalesce(k, kind), note = coalesce(nt, note),
    stats_at = case when v is not null or lk is not null then now() else stats_at end
  where id = sid;
  if u is not null and trim(u) <> '' then perform public.fix_submission_url(sid, u); end if;
end $fn$;
grant execute on function public.ta_update_submission(bigint, text, int, int, text, text, text) to authenticated;

select 'ok' as status;
