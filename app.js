import { buildEditPlan, getMelbourneParts, timeToPhrase } from './clock-core.js';

const STAGE_WIDTH = 3840;
const STAGE_HEIGHT = 804;
const SAFE_CONTENT_WIDTH = STAGE_WIDTH - 320;

const params = new URLSearchParams(window.location.search);
const demoMode = params.get('demo') === '1';
const noAnimation = params.get('noanim') === '1';
const debugMode = params.get('debug') === '1';
const previewTime = parsePreviewTime(params.get('time'));
const demoInterval = clamp(Number(params.get('interval')) || 5000, 1800, 30000);

const timings = Object.freeze({
  initialType: 32,
  cursorTravel: 10,
  delete: 34,
  type: 42,
  settle: 90
});

const stage = document.querySelector('#stage');
const beforeCursor = document.querySelector('#beforeCursor');
const afterCursor = document.querySelector('#afterCursor');
const cursor = document.querySelector('#cursor');
const phrase = document.querySelector('#phrase');
const phraseMeasure = document.querySelector('#phraseMeasure');
const dateLabel = document.querySelector('#dateLabel');
const progressFill = document.querySelector('#progressFill');
const rotatePrompt = document.querySelector('#rotatePrompt');
const modeLabel = document.querySelector('#modeLabel');
const statusLabel = document.querySelector('#statusLabel');

let renderedText = '';
let activeMinuteKey = '';
let animationToken = 0;
let queuedState = null;
let demoHour = previewTime?.hour ?? 18;
let demoMinute = previewTime?.minute ?? 6;
let demoSeconds = 0;
let demoLastAdvance = performance.now();

if (debugMode) document.body.classList.add('debug');
if (demoMode) {
  modeLabel.hidden = false;
  statusLabel.textContent = 'PREVIEW';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parsePreviewTime(value) {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function sleep(ms, token) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      if (token !== animationToken) reject(new DOMException('Superseded', 'AbortError'));
      else resolve();
    }, ms);
    if (token !== animationToken) {
      window.clearTimeout(timer);
      reject(new DOMException('Superseded', 'AbortError'));
    }
  });
}

function setCursorState(isWorking) {
  cursor.classList.toggle('is-working', isWorking);
  cursor.classList.toggle('is-blinking', !isWorking);
}

function renderSegments(before, after) {
  beforeCursor.textContent = before;
  afterCursor.textContent = after;
}

function measureText(text) {
  phraseMeasure.textContent = text || ' ';
  return phraseMeasure.getBoundingClientRect().width;
}

function fitPhrase(...texts) {
  const widest = Math.max(...texts.filter(Boolean).map(measureText), 1);
  const scale = Math.min(1, SAFE_CONTENT_WIDTH / widest);
  phrase.style.setProperty('--phrase-scale', String(Math.max(0.68, scale)));
}

async function typeInitial(target, token) {
  setCursorState(true);
  renderSegments('', '');
  fitPhrase(target);

  if (noAnimation || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderSegments(target, '');
    renderedText = target;
    setCursorState(false);
    return;
  }

  let typed = '';
  for (const character of target) {
    typed += character;
    renderSegments(typed, '');
    await sleep(timings.initialType, token);
  }
  renderedText = target;
  await sleep(timings.settle, token);
  setCursorState(false);
}

async function editTo(target, token) {
  if (target === renderedText) return;
  if (!renderedText) {
    await typeInitial(target, token);
    return;
  }

  if (noAnimation || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderSegments(target, '');
    renderedText = target;
    fitPhrase(target);
    setCursorState(false);
    return;
  }

  const plan = buildEditPlan(renderedText, target);
  fitPhrase(renderedText, target);
  setCursorState(true);

  let before = renderedText;
  let after = '';

  for (let index = 0; index < plan.cursorTravelLeft; index += 1) {
    after = before.slice(-1) + after;
    before = before.slice(0, -1);
    renderSegments(before, after);
    await sleep(timings.cursorTravel, token);
  }

  for (let index = 0; index < plan.deleteCount; index += 1) {
    before = before.slice(0, -1);
    renderSegments(before, after);
    await sleep(timings.delete, token);
  }

  for (const character of plan.targetMiddle) {
    before += character;
    renderSegments(before, after);
    await sleep(timings.type, token);
  }

  while (after.length > 0) {
    before += after[0];
    after = after.slice(1);
    renderSegments(before, after);
    await sleep(timings.cursorTravel, token);
  }

  renderedText = target;
  renderSegments(target, '');
  fitPhrase(target);
  await sleep(timings.settle, token);
  setCursorState(false);
}

function getDemoState(now) {
  const elapsed = now - demoLastAdvance;
  if (elapsed >= demoInterval) {
    const steps = Math.floor(elapsed / demoInterval);
    const totalMinutes = demoHour * 60 + demoMinute + steps;
    demoHour = Math.floor((totalMinutes % 1440) / 60);
    demoMinute = totalMinutes % 60;
    demoLastAdvance += steps * demoInterval;
  }

  demoSeconds = Math.floor(((now - demoLastAdvance) / demoInterval) * 60) % 60;
  const syntheticDate = new Date(Date.UTC(2026, 7, 3, demoHour, demoMinute, demoSeconds));
  const phraseText = timeToPhrase(demoHour, demoMinute);

  return {
    hour: demoHour,
    minute: demoMinute,
    second: demoSeconds,
    phrase: phraseText,
    minuteKey: `demo-${demoHour}-${demoMinute}`,
    dateLabel: 'MONDAY 03 AUGUST 2026',
    syntheticDate
  };
}

function getPreviewState() {
  return {
    hour: previewTime.hour,
    minute: previewTime.minute,
    second: 0,
    phrase: timeToPhrase(previewTime.hour, previewTime.minute),
    minuteKey: `preview-${previewTime.hour}-${previewTime.minute}`,
    dateLabel: 'MONDAY 03 AUGUST 2026'
  };
}

function getCurrentState(now = performance.now()) {
  if (demoMode) return getDemoState(now);
  if (previewTime) return getPreviewState();
  return getMelbourneParts(new Date());
}

async function requestPhraseUpdate(state) {
  queuedState = state;
  if (phrase.dataset.busy === 'true') return;

  phrase.dataset.busy = 'true';
  try {
    while (queuedState) {
      const next = queuedState;
      queuedState = null;
      const token = ++animationToken;
      try {
        await editTo(next.phrase, token);
        activeMinuteKey = next.minuteKey;
      } catch (error) {
        if (error?.name !== 'AbortError') throw error;
      }
    }
  } finally {
    phrase.dataset.busy = 'false';
  }
}

function updateClock(now = performance.now()) {
  const state = getCurrentState(now);
  dateLabel.textContent = state.dateLabel;

  const secondProgress = clamp((state.second + (demoMode ? 0 : (Date.now() % 1000) / 1000)) / 60, 0, 1);
  progressFill.style.transform = `scaleX(${secondProgress})`;

  if (state.minuteKey !== activeMinuteKey) {
    requestPhraseUpdate(state);
  }
}

function scaleStage() {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);

  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;

  const isSmallPortrait = width < height && width < 900;
  rotatePrompt.hidden = !isSmallPortrait;
}

function animationLoop(now) {
  updateClock(now);
  window.requestAnimationFrame(animationLoop);
}

window.addEventListener('resize', scaleStage, { passive: true });
window.addEventListener('orientationchange', scaleStage, { passive: true });
window.visualViewport?.addEventListener('resize', scaleStage, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    activeMinuteKey = '';
    updateClock();
    scaleStage();
  }
});

window.__clock = Object.freeze({
  get renderedText() { return renderedText; },
  get activeMinuteKey() { return activeMinuteKey; },
  get stageScale() {
    const transform = stage.style.transform;
    const match = /scale\(([^)]+)\)/.exec(transform);
    return match ? Number(match[1]) : 1;
  },
  forcePhrase: async (target) => {
    const token = ++animationToken;
    await editTo(String(target), token);
  },
  timeToPhrase
});

scaleStage();
setCursorState(true);
updateClock();
window.requestAnimationFrame(animationLoop);
