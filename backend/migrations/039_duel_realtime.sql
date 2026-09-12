-- 039: ส่งการเปลี่ยนแปลงของตาราง duels ผ่าน realtime
-- เดิม client ฟังแค่ submissions / pledges / profiles
-- คนท้าจึงไม่รู้เลยว่าอีกฝ่ายรับหรือปฏิเสธ จนกว่าจะรีเฟรชเอง
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duels'
  ) then
    alter publication supabase_realtime add table public.duels;
  end if;
end $$;
