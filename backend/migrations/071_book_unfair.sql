-- 071: เพิ่มหนังสือเล่มที่ 8 ให้เลือกรับรางวัล: The Unfair Advantage เล่นแบบผู้ชนะ (Ash Ali & Hasan Kubba, ฉบับแปลไทย · นายอินทร์ 688721)
-- รันก่อน deploy ฝั่งเว็บที่มีปุ่มเล่มนี้ (ไม่งั้นคนเลือกแล้วจะ error "เลือกหนังสือก่อน") · ย้อนกลับ: รัน 068 ส่วน crit_book_title ซ้ำ
create or replace function public.crit_book_title(k text) returns text language sql immutable as $fn$
  select case k
    when 'mdw'    then 'Million Dollar Weekend สุดสัปดาห์ล่าเงินล้าน'
    when 'naval'  then 'คู่มือสร้างความมั่งคั่งและความสุขฉบับนายนาวาล (The Almanack of Naval Ravikant)'
    when 'sae'    then 'Same as Ever จิตวิทยาเอาชนะอนาคต'
    when 'coo'    then 'บริษัทตัวคนเดียว (Company of One)'
    when 'bsb'    then 'พลังแห่งสมองที่สอง (Building a Second Brain)'
    when 'dw'     then 'Deep Work ดำดิ่งท่ามกลางสิ่งรบกวน'
    when 'te'     then 'Tiny Experiments ชีวิตนี้คือเวอร์ชั่นทดลอง'
    when 'unfair' then 'The Unfair Advantage เล่นแบบผู้ชนะ'
  end
$fn$;
revoke execute on function public.crit_book_title(text) from public, anon, authenticated;
select '071 ok' as ok, public.crit_book_title('unfair') as title;
