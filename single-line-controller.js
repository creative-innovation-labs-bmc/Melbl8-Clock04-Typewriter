const params = new URLSearchParams(window.location.search);

if (params.get('layout') === 'single') {
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

  const FONT_PROPERTY = '--message-font-size';
  const SAFE_CONTENT_WIDTH = 3520;
  const SINGLE_MIN_FONT_SIZE = 96;
  const SINGLE_MAX_FONT_SIZE = 410;
  const CURSOR_FIXED_WIDTH = 12;
  const CURSOR_EM_ALLOWANCE = 0.14;
  const DELETE_MS = 34;
  const noAnimation = params.get('noanim') === '1';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stage = document.querySelector('#stage');
  const frame = document.querySelector('#messageFrame');
  const measure = document.querySelector('#messageMeasure');
  const before = document.querySelector('#singleBeforeCursor');
  const after = document.querySelector('#singleAfterCursor');
  const line = document.querySelector('#singleLine');
  const frameStyle = frame.style;

  let lastMeasurement = null;
  let appliedFontSize = null;
  let pendingFontSize = null;
  let pendingTargetText = '';
  let pendingDeleteCount = 0;
  let pendingSince = 0;
  let fallbackTimer = 0;
  let scaleAnimation = null;
  let lastPlainText = '';
  const scaleEvents = [];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function sentenceCase(text) {
    if (!text) return '';
    const lower = text.toLocaleLowerCase('en-AU');
    return lower[0].toLocaleUpperCase('en-AU') + lower.slice(1);
  }

  function comparable(text) {
    return sentenceCase(text).toLocaleLowerCase('en-AU');
  }

  function plainText() {
    return `${before.textContent ?? ''}${after.textContent ?? ''}`;
  }

  function editCounts(current, target) {
    const from = comparable(current);
    const to = comparable(target);
    let prefix = 0;
    const prefixLimit = Math.min(from.length, to.length);
    while (prefix < prefixLimit && from[prefix] === to[prefix]) prefix += 1;

    let suffix = 0;
    const suffixLimit = Math.min(from.length - prefix, to.length - prefix);
    while (
      suffix < suffixLimit &&
      from[from.length - 1 - suffix] === to[to.length - 1 - suffix]
    ) {
      suffix += 1;
    }

    return {
      deleteCount: from.length - prefix - suffix,
      insertCount: to.length - prefix - suffix
    };
  }

  function record(type, details = {}) {
    scaleEvents.push({
      type,
      at: performance.now(),
      textLength: plainText().length,
      ...details
    });
    if (scaleEvents.length > 50) scaleEvents.shift();
  }

  // Phone previews transform the 3840px stage. Return the hidden measure's
  // native CSS width and retain the final candidate text measured by app.js.
  const originalMeasureRect = measure.getBoundingClientRect.bind(measure);
  measure.getBoundingClientRect = () => {
    const rect = originalMeasureRect();
    const width = measure.scrollWidth;
    const baseSize = Number.parseFloat(measure.style.fontSize) || 220;
    lastMeasurement = {
      text: measure.textContent ?? '',
      width,
      baseSize
    };

    return {
      x: rect.x,
      y: rect.y,
      top: rect.top,
      right: rect.left + width,
      bottom: rect.bottom,
      left: rect.left,
      width,
      height: rect.height,
      toJSON() {
        return {
          x: this.x,
          y: this.y,
          top: this.top,
          right: this.right,
          bottom: this.bottom,
          left: this.left,
          width: this.width,
          height: this.height
        };
      }
    };
  };

  line.style.maxWidth = 'none';
  line.style.flexShrink = '0';
  measure.style.maxWidth = 'none';

  function measuredTargetSize() {
    if (!lastMeasurement || lastMeasurement.width <= 0 || lastMeasurement.baseSize <= 0) return null;
    const textWidthPerPixel = lastMeasurement.width / lastMeasurement.baseSize;
    const totalWidthPerPixel = textWidthPerPixel + CURSOR_EM_ALLOWANCE;
    const exact = (SAFE_CONTENT_WIDTH - CURSOR_FIXED_WIDTH) / totalWidthPerPixel;
    return clamp(exact, SINGLE_MIN_FONT_SIZE, SINGLE_MAX_FONT_SIZE);
  }

  const nativeSetProperty = CSSStyleDeclaration.prototype.setProperty;

  function finishScale(animation, targetSize) {
    if (scaleAnimation !== animation) return;
    scaleAnimation = null;
    animation.cancel();
    record('finish', { to: targetSize });
  }

  function startScale(reason = 'delete') {
    if (pendingFontSize === null) return;

    window.clearTimeout(fallbackTimer);
    fallbackTimer = 0;

    const fromSize = Number.parseFloat(getComputedStyle(line).fontSize);
    const targetSize = pendingFontSize;
    const deleteCount = pendingDeleteCount;
    pendingFontSize = null;
    pendingTargetText = '';
    pendingDeleteCount = 0;
    pendingSince = 0;
    appliedFontSize = targetSize;

    if (scaleAnimation) {
      scaleAnimation.cancel();
      scaleAnimation = null;
    }

    nativeSetProperty.call(frameStyle, FONT_PROPERTY, `${targetSize.toFixed(2)}px`);

    if (
      noAnimation ||
      reducedMotion ||
      !Number.isFinite(fromSize) ||
      Math.abs(targetSize - fromSize) < 0.1
    ) {
      record('instant', { reason, from: fromSize, to: targetSize });
      return;
    }

    const duration = Math.round(clamp(Math.max(300, (deleteCount - 1) * DELETE_MS), 300, 900));
    record('start', { reason, from: fromSize, to: targetSize, duration, deleteCount });

    const animation = line.animate(
      [
        { fontSize: `${fromSize}px` },
        { fontSize: `${targetSize}px` }
      ],
      {
        duration,
        easing: reason === 'delete' ? 'linear' : 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both'
      }
    );

    scaleAnimation = animation;
    animation.addEventListener('finish', () => finishScale(animation, targetSize), { once: true });
  }

  // app.js measures the old and incoming sentences, then applies the size of
  // the wider one before editing. The final measured candidate is the incoming
  // sentence, so calculate its true destination size here and hold it until
  // the first visible deletion mutation.
  CSSStyleDeclaration.prototype.setProperty = function setProperty(name, value, priority = '') {
    if (this !== frameStyle || name !== FONT_PROPERTY) {
      return nativeSetProperty.call(this, name, value, priority);
    }

    const providedSize = Number.parseFloat(String(value));
    const targetSize = measuredTargetSize() ?? providedSize;
    const targetText = sentenceCase(lastMeasurement?.text ?? '');
    const currentText = sentenceCase(plainText());

    if (!Number.isFinite(targetSize) || noAnimation || reducedMotion) {
      appliedFontSize = Number.isFinite(targetSize) ? targetSize : appliedFontSize;
      pendingFontSize = null;
      return nativeSetProperty.call(this, name, `${targetSize}px`, priority);
    }

    if (!currentText || appliedFontSize === null) {
      appliedFontSize = targetSize;
      pendingFontSize = null;
      record('initial', { size: targetSize, targetText });
      return nativeSetProperty.call(this, name, `${targetSize.toFixed(2)}px`, priority);
    }

    // The post-edit fitting call measures only the now-visible destination.
    // Keep an active animation intact and simply confirm its inherited target.
    if (comparable(currentText) === comparable(targetText)) {
      appliedFontSize = targetSize;
      pendingFontSize = null;
      return nativeSetProperty.call(this, name, `${targetSize.toFixed(2)}px`, priority);
    }

    if (Math.abs(targetSize - appliedFontSize) < 0.05) {
      pendingFontSize = null;
      return nativeSetProperty.call(this, name, `${appliedFontSize.toFixed(2)}px`, priority);
    }

    const counts = editCounts(currentText, targetText);
    pendingFontSize = targetSize;
    pendingTargetText = targetText;
    pendingDeleteCount = counts.deleteCount;
    pendingSince = performance.now();
    record('pending', {
      from: appliedFontSize,
      to: targetSize,
      deleteCount: counts.deleteCount,
      insertCount: counts.insertCount,
      targetText
    });

    window.clearTimeout(fallbackTimer);
    fallbackTimer = window.setTimeout(() => startScale('fallback'), 950);
    return undefined;
  };

  function findTimeStart(text) {
    const lower = text.toLocaleLowerCase('en-AU');
    const lead = LEAD_INS.find((candidate) =>
      lower.startsWith(`${candidate.toLocaleLowerCase('en-AU')} `)
    );
    if (lead) return lead.length + 1;

    const currentTime = window.__clock?.renderedText;
    if (currentTime) {
      const fallbackIndex = lower.lastIndexOf(currentTime.toLocaleLowerCase('en-AU'));
      if (fallbackIndex >= 0) return fallbackIndex;
    }

    return Number.POSITIVE_INFINITY;
  }

  function makeFragment(className, text) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  }

  function decorateSegment(element, text, absoluteStart, timeStart) {
    const key = `${absoluteStart}|${timeStart}|${text}`;
    if (element.dataset.decoratedKey === key && element.textContent === text) return;

    const absoluteEnd = absoluteStart + text.length;
    const fragment = document.createDocumentFragment();

    if (absoluteEnd <= timeStart) {
      fragment.append(makeFragment('single-lead-fragment', text));
    } else if (absoluteStart >= timeStart) {
      fragment.append(makeFragment('single-time-fragment', text));
    } else {
      const localSplit = Math.max(0, timeStart - absoluteStart);
      fragment.append(makeFragment('single-lead-fragment', text.slice(0, localSplit)));
      fragment.append(makeFragment('single-time-fragment', text.slice(localSplit)));
    }

    element.replaceChildren(fragment);
    element.dataset.decoratedKey = key;
  }

  function decorateVisibleText() {
    const rawBefore = before.textContent ?? '';
    const rawAfter = after.textContent ?? '';
    const splitAt = rawBefore.length;
    const fullText = sentenceCase(`${rawBefore}${rawAfter}`);
    const timeStart = findTimeStart(fullText);

    decorateSegment(before, fullText.slice(0, splitAt), 0, timeStart);
    decorateSegment(after, fullText.slice(splitAt), splitAt, timeStart);
  }

  function handleMutation() {
    const currentText = sentenceCase(plainText());
    const previousLength = lastPlainText.length;
    const currentLength = currentText.length;

    if (pendingFontSize !== null && comparable(currentText) !== comparable(lastPlainText)) {
      if (currentLength < previousLength) {
        startScale('delete');
      } else if (previousLength > 0 && currentLength > previousLength && performance.now() - pendingSince > 160) {
        startScale('insert');
      }
    }

    lastPlainText = currentText;
    decorateVisibleText();
  }

  const observer = new MutationObserver(handleMutation);
  observer.observe(before, { childList: true, characterData: true, subtree: true });
  observer.observe(after, { childList: true, characterData: true, subtree: true });

  lastPlainText = sentenceCase(plainText());
  decorateVisibleText();

  window.__singleLineController = Object.freeze({
    get stageScale() {
      const rect = stage.getBoundingClientRect();
      return rect.width / 3840;
    },
    get appliedFontSize() { return appliedFontSize; },
    get pendingFontSize() { return pendingFontSize; },
    get pendingTargetText() { return pendingTargetText; },
    get isScaling() { return Boolean(scaleAnimation); },
    get scaleEvents() { return [...scaleEvents]; },
    decorateVisibleText,
    startScale
  });
}
