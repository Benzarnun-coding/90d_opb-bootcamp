-- 061c: ให้สรุป Discord ประจำสัปดาห์ใช้กติกาถ้วยใหม่ (แก้เฉพาะบล็อก HOUSE CUP ในฟังก์ชันเดิม) · รันหลัง 061b
do $do$
declare src text; a int; b int;
begin
  src := pg_get_functiondef('public.weekly_awards_text(integer)'::regprocedure);
  a := position('/* 🏆 ถ้วยบ้าน' in src);
  b := position('/* 💖 Popular Vote' in src);
  if a = 0 or b = 0 or b < a then raise exception 'ไม่พบบล็อกถ้วยบ้านในฟังก์ชัน (อาจแพตช์ไปแล้ว)'; end if;
  src := substr(src, 1, a - 1) || E'/* 🏆 ถ้วยบ้าน = คะแนนบ้านรายสัปดาห์ (061) */\n  cup := public.house_cup_line(wk);\n\n  ' || substr(src, b);
  execute src;
end $do$;

select position('house_cup_line' in pg_get_functiondef('public.weekly_awards_text(integer)'::regprocedure)) > 0 as patched,
       public.house_cup_line(5) as sample_w5;
