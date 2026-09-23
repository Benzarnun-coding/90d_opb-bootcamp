-- ============================================================
-- 049: เลิกระบบ "วันลา" (freeze) — เหลือ streak อย่างเดียว
--
-- ที่มา (23 ก.ย.): นักเรียนงงว่า "วันลาหายไปไหน ไม่ได้ลานะ" — วันลาถูกใช้อัตโนมัติทุกครั้งที่ขาดส่งวันไหน
--        (สปรินต์ละ 2 วัน) โดยนักเรียนไม่ได้กดเอง เลยดูเหมือนของหาย Benz ตัดสินใจเอาออก
-- กติกาใหม่: วันไหนไม่ส่ง streak กลับเป็น 0 · วันปิดเทอมยังข้ามให้เหมือนเดิม
-- ของเก่าไม่เสีย: วันที่ขาดไปก่อนวันนี้ซึ่งวันลาเคยครอบไว้ ยังนับว่าครอบไว้ streak ใครก็ไม่ลดลงย้อนหลัง
-- วันนี้ที่ยังไม่ได้ส่ง ไม่ตัด streak (ยังส่งได้ถึงตี 4)
-- รันหลัง 048
-- ============================================================

alter table public.cohort add column if not exists freeze_last_day int;
comment on column public.cohort.freeze_last_day is 'วันสุดท้ายที่ระบบวันลายังมีผล (ย้อนหลัง) · null = วันลาใช้ได้ตลอด';
update public.cohort set freeze_last_day = public.day_of(now()) - 1 where id = 1 and freeze_last_day is null;

create or replace function public.streak_of(pid uuid)
returns table (streak int, freeze_left int) language plpgsql stable as $$
declare c public.cohort%rowtype; today int; d int; sp int; used jsonb := '{}'::jsonb; budget int; st int := 0;
begin
  select * into c from public.cohort where id = 1;
  today := public.day_of(now());
  for d in 1..today loop
    sp := (d - 1) / c.sprint_days;
    if not exists (select 1 from public.enrollments e where e.profile_id = pid and e.sprint_idx = sp) then continue; end if;
    if c.vacation_from_day is not null and d between c.vacation_from_day and c.vacation_to_day then continue; end if;
    if exists (select 1 from public.submissions s where s.profile_id = pid and s.day_index = d and s.status = 'approved') then
      st := st + 1;
    elsif d = today then
      continue;                                                    -- วันนี้ยังไม่จบ ยังไม่ตัด
    elsif c.freeze_last_day is not null and d <= c.freeze_last_day then
      budget := coalesce((used ->> sp::text)::int, 0);             -- ของเก่า: วันลาเคยครอบไว้ ให้ครอบต่อ
      if budget < c.freeze_per_sprint then used := used || jsonb_build_object(sp::text, budget + 1); else st := 0; end if;
    else
      st := 0;                                                     -- กติกาใหม่: ขาด = streak เริ่มใหม่
    end if;
  end loop;
  streak := st; freeze_left := null; return next;                  -- null = หน้าเว็บไม่ต้องโชว์วันลาแล้ว
end $$;

select public.day_of(now()) as today, (select freeze_last_day from public.cohort where id = 1) as freeze_last_day;
