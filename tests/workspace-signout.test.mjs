import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
test('failed remote signout does not present a successful logout',()=>{
 const fn=source.match(/async function signout\(\)\{[^\n]+\}/)?.[0];
 assert.ok(fn,'signout handler exists');
 assert.match(fn,/const \{error\}=await cloud\.auth\.signOut\(\)/);
 assert.match(fn,/if\(error\)\{toast\('Не удалось выйти:/);
 assert.ok(fn.indexOf('if(error)')<fn.indexOf("handleWorkspaceAuthChange('SIGNED_OUT'"));
});
