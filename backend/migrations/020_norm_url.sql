-- ============================================================
-- แก้บั๊ก: ลิงก์ที่ระบุตัวด้วย query string ชนกันหมด
--
-- norm_url เดิมตัดทุกอย่างหลัง ? ทิ้ง → facebook.com/photo/?fbid=… ทุกลิงก์กลายเป็น
-- "facebook.com/photo" เหมือนกัน และ youtube.com/watch?v=… ทุกคลิปกลายเป็น "youtube.com/watch"
-- คนที่สองที่ส่ง Facebook/YouTube จะเจอ "ลิงก์นี้ถูกส่งไปแล้ว" ทั้งที่เป็นคนละโพสต์
--
-- ใหม่: เก็บ query ไว้ ตัดเฉพาะ fragment (#…) กับพารามิเตอร์ติดตาม (utm_*, fbclid, igsh, si, …)
--       ส่วนเว็บที่ id อยู่ใน path อยู่แล้ว (tiktok, instagram, youtu.be) ตัด query ทิ้งได้
-- รันหลัง 001-019
-- ============================================================
create or replace function public.norm_url(u text)
returns text language plpgsql immutable as $fn$
declare
  x text := trim(u);
  host text;
begin
  x := regexp_replace(x, '#.*$', '');                                   -- fragment
  x := regexp_replace(x, '^https?://', '', 'i');
  x := regexp_replace(x, '^(www|m|mobile|web)\.', '', 'i');
  host := lower(split_part(split_part(x, '/', 1), '?', 1));
  if host ~ '(^|\.)(tiktok\.com|instagram\.com|youtu\.be|threads\.net|x\.com|twitter\.com)$' then
    x := regexp_replace(x, '\?.*$', '');                                -- id อยู่ใน path แล้ว
  else
    x := regexp_replace(x, '([?&])(utm_[a-z]+|fbclid|igsh|igshid|si|feature|ref|mibextid|rdid|share_url|_t|_r)=[^&]*', '\1', 'gi');
    x := regexp_replace(x, '&&+', '&');
    x := regexp_replace(x, '\?&', '?');
    x := regexp_replace(x, '[?&]+$', '');
  end if;
  x := regexp_replace(x, '/+(\?|$)', '\1');                             -- slash ท้าย path
  return lower(x);
end $fn$;

-- คีย์เดิมคำนวณใหม่ทั้งหมด (ปิด trigger ชั่วคราว เพราะมันกันไม่ให้ใครแก้แถวนอกจากหัวหน้าโค้ช)
alter table public.submissions disable trigger trg_submission_review;
update public.submissions set url_key = public.norm_url(url) where url_key is distinct from public.norm_url(url);
alter table public.submissions enable trigger trg_submission_review;

select public.norm_url('https://www.facebook.com/photo/?fbid=1673437648125590&set=pb.100063781110453.-2207520000') as fb,
       public.norm_url('https://www.youtube.com/watch?v=abc123&feature=share&si=xyz') as yt,
       public.norm_url('https://www.tiktok.com/@me/video/7000000001?is_from_webapp=1') as tt,
       (select count(*) from public.submissions) as subs;
