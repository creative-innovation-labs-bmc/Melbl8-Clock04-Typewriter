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

  const stage = document.querySelector('#stage');
  const measure = document.querySelector('#messageMeasure');
  const before = document.querySelector('#singleBeforeCursor');
  const after = document.querySelector('#singleAfterCursor');
  const line = document.querySelector('#singleLine');

  // Phone previews scale the complete 3840px stage with a CSS transform.
  // getBoundingClientRect() reports that transformed width, while app.js needs
  // native stage units to choose the final font size before typing begins.
  // Patch only the hidden measuring element and do it before app.js executes.
  const originalMeasureRect = measure.getBoundingClientRect.bind(measure);
  measure.getBoundingClientRect = () => {
    const rect = originalMeasureRect();
    const width = measure.scrollWidth;
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

  function sentenceCase(text) {
    if (!text) return '';
    const lower = text.toLocaleLowerCase('en-AU');
    return lower[0].toLocaleUpperCase('en-AU') + lower.slice(1);
  }

  function findTimeStart(text) {
    const lower = text.toLocaleLowerCase('en-AU');
    const lead = LEAD_INS.find((candidate) =>
      lower.startsWith(`${candidate.toLocaleLowerCase('en-AU')} `)
    );
    return lead ? lead.length + 1 : Number.POSITIVE_INFINITY;
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

  const observer = new MutationObserver(decorateVisibleText);
  observer.observe(before, { childList: true, characterData: true, subtree: true });
  observer.observe(after, { childList: true, characterData: true, subtree: true });

  decorateVisibleText();

  window.__singleLineController = Object.freeze({
    get stageScale() {
      const rect = stage.getBoundingClientRect();
      return rect.width / 3840;
    },
    decorateVisibleText
  });
}
