import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEditPlan, numberToWords, timeToPhrase } from '../clock-core.js';

test('number words use correct Australian/English spelling', () => {
  assert.equal(numberToWords(21), 'TWENTY-ONE');
  assert.equal(numberToWords(40), 'FORTY');
  assert.equal(numberToWords(59), 'FIFTY-NINE');
});

test('known time phrases', () => {
  assert.equal(timeToPhrase(0, 0), 'MIDNIGHT');
  assert.equal(timeToPhrase(12, 0), 'NOON');
  assert.equal(timeToPhrase(6, 0), "SIX O'CLOCK");
  assert.equal(timeToPhrase(6, 1), 'ONE MINUTE PAST SIX');
  assert.equal(timeToPhrase(6, 2), 'TWO MINUTES PAST SIX');
  assert.equal(timeToPhrase(6, 15), 'QUARTER PAST SIX');
  assert.equal(timeToPhrase(6, 30), 'HALF PAST SIX');
  assert.equal(timeToPhrase(6, 31), 'TWENTY-NINE MINUTES TO SEVEN');
  assert.equal(timeToPhrase(6, 45), 'QUARTER TO SEVEN');
  assert.equal(timeToPhrase(6, 59), 'ONE MINUTE TO SEVEN');
  assert.equal(timeToPhrase(23, 59), 'ONE MINUTE TO TWELVE');
});

test('all 1,440 minutes produce clean phrases', () => {
  const phrases = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 1) {
      const phrase = timeToPhrase(hour, minute);
      phrases.push(phrase);
      assert.match(phrase, /^[A-Z' -]+$/);
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

test('typical minute change preserves its suffix', () => {
  const plan = buildEditPlan('SIX MINUTES PAST SIX', 'SEVEN MINUTES PAST SIX');
  assert.equal(plan.prefix, 'S');
  assert.equal(plan.currentMiddle, 'IX');
  assert.equal(plan.targetMiddle, 'EVEN');
  assert.equal(plan.suffix, ' MINUTES PAST SIX');
});
