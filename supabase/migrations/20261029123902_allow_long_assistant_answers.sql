set local lock_timeout = '5s';
alter table public.advisor_ai_messages drop constraint advisor_ai_messages_content_check,
 add constraint advisor_ai_messages_content_check check (
 char_length(content) between 1 and case when role = 'assistant' then 80000 else 12000 end
 );
create temporary table advisor_message_length_smoke
 (like public.advisor_ai_messages including defaults including constraints) on commit drop;
do $$
declare invalid_case record;
begin
 insert into advisor_message_length_smoke (case_id,user_id,role,content)
 values(gen_random_uuid(),gen_random_uuid(),'user',repeat('x',12000)),
 (gen_random_uuid(),gen_random_uuid(),'assistant',repeat('я',12001)),
 (gen_random_uuid(),gen_random_uuid(),'assistant',repeat('я',80000));
 for invalid_case in select * from (values ('user',12001),('assistant',80001),('assistant',0)) as v(role,n)
 loop
  begin
   insert into advisor_message_length_smoke(case_id,user_id,role,content)
   values(gen_random_uuid(),gen_random_uuid(),invalid_case.role,repeat('x',invalid_case.n));
   raise exception 'Length guard accepted invalid %/%',invalid_case.role,invalid_case.n;
  exception when check_violation then null;
  end;
 end loop;
end $$;
