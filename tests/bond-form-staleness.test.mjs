import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../bond-analysis.html'), 'utf8');
const script = html.match(/<script>\\s*([\\s\\S]*?)<\\/script>/)?.[1];
assert.ok(script, 'Use the real browser calculator script');

function createPage() {
  const ids = ['face','price','coupon','years','frequency','currency','bond-form',
    'error','current','ytm','duration','dv01','explain','scenarios','copy','example'];
  function element(value = '') {
    let content = '';
    let children = [];
    return {
      value, disabled: false, listeners: {},
      addEventListener(type, callback) { this.listeners[type] = callback; },
      append(child) { children.push(child); },
      get children() { return children; },
      get textContent() { return content; },
      set textContent(value) { content = value; children = []; }
    };
  }
  const elements = Object.fromEntries(ids.map(id => [id, element()]));
  for (const [id, value] of Object.entries({face:'1000',price:'950',coupon:'6',years:'3',frequency:'2'})) {
    elements[id].value = value;
  }
  const document = {
    getElementById(id) {
      assert.ok(elements[id], 'Unknown DOM element: ' + id);
      return elements[id];
    },
    createElement() { return element(); }
  };
  runInNewContext(script, {document, navigator:{clipboard:{writeText:async () => {}}}});
  return elements;
}

test('editing an input invalidates previously calculated financial results and disables copy', () => {
  const page = createPage();
  assert.equal(page.copy.disabled, false);
  assert.equal(page.scenarios.children.length, 7);
  const previousYtm = page.ytm.textContent;
  page.price.value = '1000';
  page['bond-form'].listeners.input();
  for (const id of ['current','ytm','duration','dv01']) assert.equal(page[id].textContent, '—');
  assert.equal(page.copy.disabled, true);
  assert.equal(page.copy.textContent, 'Копировать итоги');
  assert.equal(page.scenarios.children.length, 1);
  assert.equal(page.scenarios.children[0].children[0].textContent, 'Нет расчёта');
  assert.match(page.explain.textContent, /Параметры изменены/);
  page['bond-form'].listeners.submit({preventDefault() {}});
  assert.equal(page.copy.disabled, false);
  assert.notEqual(page.ytm.textContent, previousYtm);
  assert.equal(page.scenarios.children.length, 7);
});

test('select changes invalidate reports and the example button restores a fresh calculation', () => {
  const page = createPage();
  page.frequency.value = '4';
  page['bond-form'].listeners.change();
  assert.equal(page.copy.disabled, true);
  assert.equal(page.ytm.textContent, '—');
  page.example.listeners.click();
  assert.equal(page.frequency.value, 2);
  assert.equal(page.copy.disabled, false);
  assert.equal(page.scenarios.children.length, 7);
  assert.match(page.explain.textContent, /Текущая доходность/);
});
