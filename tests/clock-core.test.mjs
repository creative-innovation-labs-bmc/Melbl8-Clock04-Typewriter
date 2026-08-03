import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEditPlan, numberToWords, timeToPhrase } from '../clock-core.js';

test('number words use correct Australian and English spelling', () => {
  assert.equal(numberToWords(21), 'twenty-one');
  assert.equal(numberToWords(40), 'forty');
  assert.equal(numberToWords(59), 'fifty-nine');
});

test('known time phrases use sentence case', () => {
  assert.equal(timeToPhrase(0, 0), 'Midnight');
  assert.equal(timeToPhrase(12, 0), 'Noon');
  assert.equal(timeToPhrase(6, 0), "Six o'clock");
  assert.equal(timeToPhrase(6, 1), 'One minute past six');
  assert.equal(timeToPhrase(6, 2), 'Two minutes past six');
  assert.equal(timeToPhrase(6, 15), 'Quarter past six');
  assert.equal(timeToPhrase(6, 30), 'Half past six');
  assert.equal(timeToPhrase(6, 31), 'Twenty-nine minutes to seven');
  assert.equal(timeToPhrase(6, 45), 'Quarter to seven');
  assert.equal(timeToPhrase(6, 59), 'One minute to seven');
  assert.equal(timeToPhrase(23, 59), 'One minute to twelve');
});

test('all 1,440 minutes produce clean sentence-case phrases', () => {
  const phrases = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 1) {
      const phrase = timeToPhrase(hour, minute);
      phrases.push(phrase);
      assert.match(phrase, /^[A-Z][A-Za-z' -]*$/);
      assert.equal(phrase.trim(), phrase);
      assert.equal(phrase.includes('  '), false);
      assert.ok(phrase.length > 0);
    }
  }
  assert.equal(phrases.length, 1440);
  assert.ok(Math.max(...phrases.map((value) => value.length)) <= 38);
});

test('selective edit plan reconstructs every consecutive minute transition', () => {
  const phrases = [];
  for (let minuteOfDay = 0; minuteOfDay < 1440; minuteOfDay += 1) {
    phrases.push(timeToPhrase(Math.floor(minuteOfDay / 60), minuteOfDay % 60));
  }

  for (let index = 0; index < phrases.length; index += 1) {
    const current = phrases[index];
    const target = phrases[(index + 1) % phrases.length];
    const plan = buildEditPlan(current, target);

    assert.equal(plan.prefix + plan.currentMiddle + plan.suffix, current);
    assert.equal(plan.prefix + plan.targetMiddle + plan.suffix, target);
    assert.equal(plan.deleteCount, plan.currentMiddle.length);
    assert.equal(plan.typeCount, plan.targetMiddle.length);
  }
});

test('typical minute change preserves its sentence-case suffix', () => {
  const plan = buildEditPlan('Six minutes past six', 'Seven minutes past six');
  assert.equal(plan.prefix, 'S');
  assert.equal(plan.currentMiddle, 'ix');
  assert.equal(plan.targetMiddle, 'even');
  assert.equal(plan.suffix, ' minutes past six');
});
