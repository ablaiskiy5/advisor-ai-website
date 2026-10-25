import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../workspace.html',import.meta.url),'utf8');
test('password recovery event establishes session and clears previous user data',()=>{
 const handler=source.slice(source.indexOf('function handleWorkspaceAuthChange('),source.indexOf('function draft('));
 const branch=handler.slice(handler.indexOf("if(event==='PASSWORD_RECOVERY')"),handler.indexOf("if(!['SIGNED_IN'"));
 assert.match(branch,/session=nextOwner\?nextSession:null/);
 assert.match(branch,/authRevision\+\+/);
 assert.match(branch,/entries=\[\];snapshotsCache\.clear\(\)/);
 assert.match(branch,/passwordRecovery=true;page='settings';render\(\)/);
});
test('password recovery password update uses the authenticated recovery session',()=>{
 assert.match(source,/async function updatePassword\(\)\{if\(!cloud\|\|!session\)/);
 assert.match(source,/await cloud\.auth\.updateUser\(\{password\}\)/);
});
