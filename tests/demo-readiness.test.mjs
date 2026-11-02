import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PAGES, verifyDemoReadiness} from '../scripts/smoke-demo-readiness.mjs';

const site = 'https://demo.example/advisor-ai-website/';
const api = 'https://api.example/functions/v1/';
const html = '<!doctype html><html><head><title>Advisor AI</title><link href="./assets/site.css" rel="stylesheet"></head><body><script src="./assets/site.js"></script></body></html>';
function fakeFetch({pageStatus=200,assetStatus=200,guardStatus=401,missingAssets=false}={}) {
  const calls=[];
  async function fetcher(url,options={}) {
    calls.push({url,method:options.method||'GET',headers:options.headers||{}});
    if(url.startsWith(api)) return new Response('{}',{status:guardStatus});
    if(url.includes('/assets/')) return new Response('body { min-height: 100vh; }',{status:assetStatus});
    return new Response(missingAssets?'<html><title>Advisor AI</title></html>':html,{status:pageStatus});
  }
  return {fetcher,calls};
}
test('published pages, linked assets and private-function denial form a no-secret readiness gate',async()=>{
  const fake=fakeFetch();
  const result=await verifyDemoReadiness({fetcher:fake.fetcher,siteUrl:site,apiUrl:api});
  assert.deepEqual(result,{pages:DEMO_PAGES.length,assets:2,protectedFunctions:2});
  assert.equal(fake.calls.filter(c=>c.url.includes('/assets/')).length,2,'assets deduplicated across pages');
  assert.equal(fake.calls.filter(c=>c.url.startsWith(api)).length,2);
  assert.ok(fake.calls.every(c=>!('authorization' in c.headers)),'no credentials are used');
});
test('missing production pages, missing assets, and accidental public function access fail closed',async()=>{
  for(const [setting,match] of [
    [{pageStatus:404},/workspace.html HTTP 404/],
    [{assetStatus:404},/linked asset HTTP 404/],
    [{guardStatus:200},/accepted unsigned request/],
    [{guardStatus:500},/failed with HTTP 500/],
    [{missingAssets:true},/no production CSS\\/JS assets/]
  ]) {
    const {fetcher}=fakeFetch(setting);
    await assert.rejects(verifyDemoReadiness({fetcher,siteUrl:site,apiUrl:api}),match);
  }
});
test('only HTTPS, project-scoped assets are requested; external scripts are not followed',async()=>{
  const fetcher=async url=>{
    if(url.startsWith(api))return new Response('{}',{status:401});
    if(url.includes('/assets/'))return new Response('/* this file is safe and nonempty */',{status:200});
    return new Response(html.replace('</head>','<script src="https://external.example/track.js"></script><script src="/other-folder/not-ours.js"></script></head>'),{status:200});
  };
  const result=await verifyDemoReadiness({fetcher,siteUrl:site,apiUrl:api});
  assert.equal(result.assets,2);
  await assert.rejects(verifyDemoReadiness({fetcher,siteUrl:'http://unsafe.example/',apiUrl:api}),/clean HTTPS/);
});