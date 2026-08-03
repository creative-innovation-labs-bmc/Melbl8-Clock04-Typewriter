const params = new URLSearchParams(window.location.search);

if (params.get('layout') === 'single') {
  const SAFE_CONTENT_WIDTH = 3520;
  const FIT_GUARD = 10;
  const MIN_FONT_SIZE = 72;
  const MAX_FONT_SIZE = 410;
  const CURSOR_FIXED_WIDTH = 12;
  const CURSOR_EM_ALLOWANCE = 0.14;

  const frame = document.querySelector('#messageFrame');
  const line = document.querySelector('#singleLine');
  const before = document.querySelector('#singleBeforeCursor');
  const after = document.querySelector('#singleAfterCursor');
  const measure = document.querySelector('#messageMeasure');

  let fitTimer = 0;

  frame.style.overflow = 'hidden';
  frame.style.transition = 'none';
  line.style.maxWidth = 'none';
  line.style.flexShrink = '0';
  measure.style.maxWidth = 'none';

  function visibleText() {
    return `${before.textContent ?? ''}${after.textContent ?? ''}`;
  }

  function applySingleSentenceCase() {
    const beforeText = before.textContent ?? '';
    const fullText = `${beforeText}${after.textContent ?? ''}`;
    if (!fullText) return;

    const lower = fullText.toLocaleLowerCase('en-AU');
    const sentence = lower[0].toLocaleUpperCase('en-AU') + lower.slice(1);
    const splitAt = beforeText.length;
    const nextBefore = sentence.slice(0, splitAt);
    const nextAfter = sentence.slice(splitAt);

    if (before.textContent !== nextBefore) before.textContent = nextBefore;
    if (after.textContent !== nextAfter) after.textContent = nextAfter;
  }

  function measuredWidth(text, fontSize) {
    measure.style.fontSize = `${fontSize}px`;
    measure.textContent = text || ' ';
    return measure.scrollWidth
      + CURSOR_FIXED_WIDTH
      + fontSize * CURSOR_EM_ALLOWANCE;
  }

  function fitVisibleLine() {
    applySingleSentenceCase();
    const text = visibleText();
    if (!text) return;

    const targetWidth = SAFE_CONTENT_WIDTH - FIT_GUARD;
    let low = MIN_FONT_SIZE;
    let high = MAX_FONT_SIZE;

    for (let pass = 0; pass < 20; pass += 1) {
      const mid = (low + high) / 2;
      if (measuredWidth(text, mid) <= targetWidth) low = mid;
      else high = mid;
    }

    frame.style.setProperty('--message-font-size', `${low.toFixed(2)}px`);
  }

  function scheduleFit(delay = 140) {
    window.clearTimeout(fitTimer);
    fitTimer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(fitVisibleLine);
      });
    }, delay);
  }

  const observer = new MutationObserver(() => {
    applySingleSentenceCase();
    scheduleFit();
  });

  observer.observe(before, { childList: true, characterData: true, subtree: true });
  observer.observe(after, { childList: true, characterData: true, subtree: true });

  function handleViewportChange() {
    scheduleFit(0);
  }

  window.addEventListener('resize', handleViewportChange, { passive: true });
  window.addEventListener('orientationchange', handleViewportChange, { passive: true });
  window.visualViewport?.addEventListener('resize', handleViewportChange, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleFit(0);
  });

  if (document.fonts) {
    document.fonts
      .load('220px "MP-B"', 'The time now is twenty-nine minutes past eleven')
      .then(() => scheduleFit(0))
      .catch(() => scheduleFit(0));

    document.fonts.addEventListener?.('loadingdone', () => scheduleFit(0));
  }

  scheduleFit(0);
}
