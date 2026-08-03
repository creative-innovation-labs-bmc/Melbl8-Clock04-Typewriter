import { buildEditPlan, getMelbourneParts, timeToPhrase } from './clock-core.js';

const STAGE_WIDTH = 3840;
const STAGE_HEIGHT = 804;
const SAFE_CONTENT_WIDTH = STAGE_WIDTH - 320;
const BASE_MESSAGE_FONT_SIZE = 196;
const MIN_MESSAGE_FONT_SIZE = 118;
const CURSOR_ALLOWANCE = 54;

const LEAD_INS = Object.freeze([
  'The time now is',
  'Right now, it is',
  'At this moment, it is',
  'The current time is',
  'Here in Melbourne, it is',
  'Melbourne time is',
  'The clock says',
  'It is currently',
  'As of now, it is'
]);

const params = new URLSearchParams(window.location.search);
const demoMode = params.get('demo') === '1';
const noAnimation = params.get('noanim') === '1';
const debugMode = params.get('debug') === '1';
const previewTime = parsePreviewTime(params.get('time'));
const demoInterval = clamp(Number(params.get('interval')) || 5000, 1800, 30000);

const timings = Object.freeze({
  initialType: 31,
  cursorTravel: 10,
  delete: 34,
  type: 41,
  settle: 90
});

const stage = document.querySelector('#stage');
const messageFrame = document.querySelector('#messageFrame');
const messageMeasure = document.querySelector('#messageMeasure');
const dateLabel = document.querySelector('#dateLabel');
const progressFill = document.querySelector('#progressFill');
const rotatePrompt = document.querySelector('#rotatePrompt');
const modeLabel = document.querySelector('#modeLabel');
const statusLabel = document.querySelector('#statusLabel');

const lines = Object.freeze({
  lead: {
    root: document.querySelector('#leadLine'),
    before: document.querySelector('#leadBeforeCursor'),
    cursor: document.querySelector('#leadCursor'),
    after: document.querySelector('#leadAfterCursor'),
    rendered: ''
  },
  time: {
    root: document.querySelector('#timeLine'),
    before: document.querySelector('#timeBeforeCursor'),
    cursor: document.querySelector('#timeCursor'),
    after: document.querySelector('#timeAfterCursor'),
    rendered: ''
  }
});

let activeMinuteKey = '';
let requestedMinuteKey = '';
let animationToken = 0;
let queuedState = null;
let leadDeck = [];
let previousLead = '';
let demoHour = previewTime?.hour ?? 18;
let demoMinute = previewTime?.minute ?? 6;
let demoSeconds = 0;
let demoLastAdvance = performance.now();

if (debugMode) document.body.classList.add('debug');
if (demoMode) {
  modeLabel.hidden = false;
  statusLabel.textContent = 'Preview';
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

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function refillLeadDeck() {
  leadDeck = shuffle(LEAD_INS);
  if (leadDeck.length > 1 && leadDeck[0] === previousLead) {
    [leadDeck[0], leadDeck[1]] = [leadDeck[1], leadDeck[0]];
  }
}

function nextLeadIn() {
  if (leadDeck.length === 0) refillLeadDeck();
  previousLead = leadDeck.shift();
  return previousLead;
}

function setActiveCursor(lineName, isWorking) {
  for (const [name, line] of Object.entries(lines)) {
    const isActive = name === lineName;
    line.cursor.hidden = !isActive;
    line.cursor.classList.toggle('is-working', isActive && isWorking);
    line.cursor.classList.toggle('is-blinking', isActive && !isWorking);
  }
}

function renderLine(lineName, before, after) {
  const line = lines[lineName];
  line.before.textContent = before;
  line.after.textContent = after;
}

function measureTextAtBase(text) {
  messageMeasure.style.fontSize = `${BASE_MESSAGE_FONT_SIZE}px`;
  messageMeasure.textContent = text || ' ';
  return messageMeasure.getBoundingClientRect().width;
}

function fitMessage(...texts) {
  const candidates = texts.filter((text) => typeof text === 'string' && text.length > 0);
  const widest = Math.max(...candidates.map(measureTextAtBase), 1) + CURSOR_ALLOWANCE;
  const scale = Math.min(1, SAFE_CONTENT_WIDTH / widest);
  const fontSize = clamp(Math.floor(BASE_MESSAGE_FONT_SIZE * scale), MIN_MESSAGE_FONT_SIZE, BASE_MESSAGE_FONT_SIZE);
  messageFrame.style.setProperty('--message-font-size', `${fontSize}px`);
  return fontSize;
}

async function typeInitialLine(lineName, target, token) {
  const line = lines[lineName];
  setActiveCursor(lineName, true);
  renderLine(lineName, '', '');

  if (noAnimation || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderLine(lineName, target, '');
    line.rendered = target;
    return;
  }

  let typed = '';
  for (const character of target) {
    typed += character;
    renderLine(lineName, typed, '');
    await sleep(timings.initialType, token);
  }

  line.rendered = target;
  await sleep(timings.settle, token);
}

async function editLine(lineName, target, token) {
  const line = lines[lineName];
  if (target === line.rendered) return;
  if (!line.rendered) {
    await typeInitialLine(lineName, target, token);
    return;
  }

  setActiveCursor(lineName, true);

  if (noAnimation || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderLine(lineName, target, '');
    line.rendered = target;
    return;
  }

  const plan = buildEditPlan(line.rendered, target);
  let before = line.rendered;
  let after = '';

  for (let index = 0; index < plan.cursorTravelLeft; index += 1) {
    after = before.slice(-1) + after;
    before = before.slice(0, -1);
    renderLine(lineName, before, after);
    await sleep(timings.cursorTravel, token);
  }

  for (let index = 0; index < plan.deleteCount; index += 1) {
    before = before.slice(0, -1);
    renderLine(lineName, before, after);
    await sleep(timings.delete, token);
  }

  for (const character of plan.targetMiddle) {
    before += character;
    renderLine(lineName, before, after);
    await sleep(timings.type, token);
  }

  while (after.length > 0) {
    before += after[0];
    after = after.slice(1);
    renderLine(lineName, before, after);
    await sleep(timings.cursorTravel, token);
  }

  line.rendered = target;
  renderLine(lineName, target, '');
  await sleep(timings.settle, token);
}

async function editMessage(targetLead, targetTime, token) {
  fitMessage(lines.lead.rendered, targetLead, lines.time.rendered, targetTime);

  if (!lines.lead.rendered && !lines.time.rendered) {
    await typeInitialLine('lead', targetLead, token);
    await typeInitialLine('time', targetTime, token);
  } else {
    await editLine('lead', targetLead, token);
    await editLine('time', targetTime, token);
  }

  fitMessage(targetLead, targetTime);
  setActiveCursor('time', false);
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

  return {
    hour: demoHour,
    minute: demoMinute,
    second: demoSeconds,
    phrase: timeToPhrase(demoHour, demoMinute),
    minuteKey: `demo-${demoHour}-${demoMinute}`,
    dateLabel: 'Monday 03 August 2026'
  };
}

function getPreviewState() {
  return {
    hour: previewTime.hour,
    minute: previewTime.minute,
    second: 0,
    phrase: timeToPhrase(previewTime.hour, previewTime.minute),
    minuteKey: `preview-${previewTime.hour}-${previewTime.minute}`,
    dateLabel: 'Monday 03 August 2026'
  };
}

function getCurrentState(now = performance.now()) {
  if (demoMode) return getDemoState(now);
  if (previewTime) return getPreviewState();
  return getMelbourneParts(new Date());
}

async function requestMessageUpdate(state) {
  queuedState = state;
  if (messageFrame.dataset.busy === 'true') return;

  messageFrame.dataset.busy = 'true';
  try {
    while (queuedState) {
      const next = queuedState;
      queuedState = null;
      const token = ++animationToken;

      try {
        await editMessage(next.leadIn, next.phrase, token);
        activeMinuteKey = next.minuteKey;
      } catch (error) {
        if (error?.name !== 'AbortError') throw error;
      }
    }
  } finally {
    messageFrame.dataset.busy = 'false';
  }
}

function updateClock(now = performance.now()) {
  const state = getCurrentState(now);
  dateLabel.textContent = state.dateLabel;

  const secondProgress = clamp((state.second + (demoMode ? 0 : (Date.now() % 1000) / 1000)) / 60, 0, 1);
  progressFill.style.transform = `scaleX(${secondProgress})`;

  if (state.minuteKey !== requestedMinuteKey) {
    requestedMinuteKey = state.minuteKey;
    requestMessageUpdate({ ...state, leadIn: nextLeadIn() });
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
    requestedMinuteKey = '';
    updateClock();
    scaleStage();
  }
});

window.__clock = Object.freeze({
  get renderedText() { return lines.time.rendered; },
  get leadText() { return lines.lead.rendered; },
  get activeMinuteKey() { return activeMinuteKey; },
  get messageFontSize() {
    return Number.parseFloat(getComputedStyle(messageFrame).getPropertyValue('--message-font-size'));
  },
  get stageScale() {
    const transform = stage.style.transform;
    const match = /scale\(([^)]+)\)/.exec(transform);
    return match ? Number(match[1]) : 1;
  },
  forcePhrase: async (target) => {
    const token = ++animationToken;
    fitMessage(lines.lead.rendered, lines.time.rendered, String(target));
    await editLine('time', String(target), token);
    setActiveCursor('time', false);
  },
  forceLead: async (target) => {
    const token = ++animationToken;
    fitMessage(lines.lead.rendered, String(target), lines.time.rendered);
    await editLine('lead', String(target), token);
    setActiveCursor('time', false);
  },
  timeToPhrase
});

async function startClock() {
  scaleStage();
  setActiveCursor('lead', true);

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Use the fallback font if the local face cannot be loaded.
    }
  }

  updateClock();
  window.requestAnimationFrame(animationLoop);
}

startClock();
