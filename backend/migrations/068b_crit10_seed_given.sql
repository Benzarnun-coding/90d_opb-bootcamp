-- 068b: ตัดรางวัล ×10 ที่ Benz "มอบหนังสือให้ไปแล้ว" ก่อนเปิดระบบนี้ (9 ต.ค. จอมอัลกอริทึม) ออกจากรายการรอรับ
-- ไม่งั้นเจ้าตัวจะเห็นป๊อปอัปให้เลือกหนังสืออีกเล่มหลัง deploy · แทรกแถว "รับแล้ว" แบบแมนนวลให้ทุก ×10 ที่มีอยู่ ณ ตอนนี้ (ยังไม่มีใครรับผ่านระบบ)
-- รันหลัง 068 · รันครั้งเดียวพอ (on conflict do nothing) · ที่อยู่/เบอร์เป็น '-' เพราะโค้ชส่งให้เองแล้ว · ติ๊ก "ส่งแล้ว" ให้เรียบร้อย
insert into public.crit_claims (profile_id, url_key, sub_id, book_key, book, recipient, phone, address, shipped_at)
select s.profile_id, s.url_key, s.id, 'manual', '(โค้ชมอบหนังสือให้แล้ว ก่อนเปิดระบบเลือกหนังสือ)', '-', '-', '-', now()
from public.submissions s
where s.crit = 10 and s.created_at < now()
on conflict (profile_id, url_key) do nothing;

select count(*) as seeded, (select count(*) from public.crit_claims) as total_claims from public.crit_claims where book_key = 'manual';
