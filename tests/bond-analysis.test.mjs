import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// Test the functions shipped in the page, not a separate copy of the formulas.
const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../bond-analysis.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Bond analysis inline script must exist');
const start = script.indexOf('function bondPrice(');
const end = script.indexOf('function run(){');
assert.ok(start >= 0 && end > start, 'Pure bond math functions must remain available');
const { bondPrice, solveYtm, calculateBond } = runInNewContext(
  script.slice(start, end) + '\n({bondPrice,solveYtm,calculateBond})'
);
const approx = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= tolerance,
    'Expected ' + actual + ' to be within ' + tolerance + ' of ' + expected);

test('complete inline JavaScript parses', () => {
  assert.doesNotThrow(() => new Function(script));
});

test('a bond priced at par has YTM equal to its coupon rate', () => {
  const bond = calculateBond({ face: 1000, price: 1000, coupon: 0.06, years: 5, frequency: 2 });
  approx(bond.ytm, 0.06);
  approx(bond.current, 0.06);
  approx(bondPrice(1000, 0.06, 10, 2, bond.ytm), 1000);
});

test('discount bond has correct current yield and cash flows reprice to input', () => {
  const bond = calculateBond({ face: 1000, price: 950, coupon: 0.06, years: 3, frequency: 2 });
  approx(bond.current, 60 / 950);
  approx(bondPrice(1000, 0.06, 6, 2, bond.ytm), 950, 1e-7);
  assert.ok(bond.ytm > 0.06);
});

test('zero-coupon bond agrees with analytical YTM and duration', () => {
  const yieldAnnual = 0.08;
  const price = 1000 / Math.pow(1 + yieldAnnual / 2, 6);
  const bond = calculateBond({ face: 1000, price, coupon: 0, years: 3, frequency: 2 });
  approx(bond.ytm, yieldAnnual);
  approx(bond.mac, 3);
  approx(bond.modified, 3 / 1.04);
});

test('premium zero-coupon bond supports a negative yield', () => {
  const bond = calculateBond({ face: 1000, price: 1100, coupon: 0, years: 1, frequency: 1 });
  approx(bond.ytm, 1000 / 1100 - 1);
  approx(solveYtm(1000, 1100, 0, 1, 1), bond.ytm);
});

test('modified duration and DV01 agree with finite-difference prices', () => {
  const bond = calculateBond({ face: 1000, price: 950, coupon: 0.06, years: 3, frequency: 2 });
  const priceAt = y => bondPrice(1000, 0.06, 6, 2, y);
  const h = 0.00001;
  const numericalDuration = -(priceAt(bond.ytm + h) - priceAt(bond.ytm - h)) / (2 * h * 950);
  const numericalDv01 = (priceAt(bond.ytm - 0.0001) - priceAt(bond.ytm + 0.0001)) / 2;
  approx(bond.modified, numericalDuration, 1e-7);
  approx(bond.dv01, numericalDv01, 1e-6);
});

test('bond price decreases as YTM rises', () => {
  const bond = calculateBond({ face: 1000, price: 950, coupon: 0.06, years: 3, frequency: 2 });
  assert.ok(bondPrice(1000, 0.06, 6, 2, bond.ytm - 0.01) > 950);
  assert.ok(bondPrice(1000, 0.06, 6, 2, bond.ytm + 0.01) < 950);
});

test('invalid coupon, frequency and fractional coupon periods are rejected', () => {
  const base = { face: 1000, price: 950, coupon: 0.06, years: 3, frequency: 2 };
  assert.throws(() => calculateBond({ ...base, coupon: 1.01 }), /Проверь/);
  assert.throws(() => calculateBond({ ...base, frequency: 3 }), /Недопустимая/);
  assert.throws(() => calculateBond({ ...base, years: 1.25 }), /целое число купонных периодов/);
});
