import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261027_grant_service_role_ai_access_enrollment_insert.sql',import.meta.url),'utf8');
test('pilot enrollment grant is limited to the server role',()=>{
 assert.match(sql,/GRANT INSERT ON TABLE public\.advisor_ai_access TO service_role;/);
 assert.doesNotMatch(sql,/GRANT\s+(?:ALL|INSERT)[^;]*\b(?:anon|authenticated|PUBLIC)\s*;/i);
 assert.match(sql,/relrowsecurity/);
 assert.match(sql,/has_table_privilege\('authenticated','public\.advisor_ai_access','INSERT'\)/);
});
