const SMALL_NUMBERS = Object.freeze([
  'ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
]);

const TENS = Object.freeze({
  20: 'TWENTY',
  30: 'THIRTY',
  40: 'FORTY',
  50: 'FIFTY'
});

const HOUR_WORDS = Object.freeze([
  'TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX',
  'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'
]);

export function numberToWords(value) {
  if (!Number.isInteger(value) || value < 0 || value > 59) {
    throw new RangeError(`numberToWords expects an integer from 0 to 59, received ${value}`);
  }

  if (value < 20) return SMALL_NUMBERS[value];
  const tens = Math.floor(value / 10) * 10;
  const remainder = value % 10;
  return remainder === 0 ? TENS[tens] : `${TENS[tens]}-${SMALL_NUMBERS[remainder]}`;
}

export function hourToWords(hour24) {
  if (!Number.isInteger(hour24) || hour24 < 0 || hour24 > 23) {
    throw new RangeError(`hourToWords expects an integer from 0 to 23, received ${hour24}`);
  }
  return HOUR_WORDS[hour24 % 12];
}

export function timeToPhrase(hour24, minute) {
  if (!Number.isInteger(hour24) || hour24 < 0 || hour24 > 23) {
    throw new RangeError(`hour must be 0 to 23, received ${hour24}`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new RangeError(`minute must be 0 to 59, received ${minute}`);
  }

  if (minute === 0) {
    if (hour24 === 0) return 'MIDNIGHT';
    if (hour24 === 12) return 'NOON';
    return `${hourToWords(hour24)} O'CLOCK`;
  }

  const thisHour = hourToWords(hour24);
  const nextHour = hourToWords((hour24 + 1) % 24);

  if (minute === 15) return `QUARTER PAST ${thisHour}`;
  if (minute === 30) return `HALF PAST ${thisHour}`;
  if (minute === 45) return `QUARTER TO ${nextHour}`;

  if (minute < 30) {
    const unit = minute === 1 ? 'MINUTE' : 'MINUTES';
    return `${numberToWords(minute)} ${unit} PAST ${thisHour}`;
  }

  const remaining = 60 - minute;
  const unit = remaining === 1 ? 'MINUTE' : 'MINUTES';
  return `${numberToWords(remaining)} ${unit} TO ${nextHour}`;
}

export function buildEditPlan(currentText, targetText) {
  const current = String(currentText ?? '');
  const target = String(targetText ?? '');

  let prefixLength = 0;
  const prefixLimit = Math.min(current.length, target.length);
  while (prefixLength < prefixLimit && current[prefixLength] === target[prefixLength]) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  const suffixLimit = Math.min(current.length - prefixLength, target.length - prefixLength);
  while (
    suffixLength < suffixLimit &&
    current[current.length - 1 - suffixLength] === target[target.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const suffixStartCurrent = current.length - suffixLength;
  const suffixStartTarget = target.length - suffixLength;

  return {
    current,
    target,
    prefix: current.slice(0, prefixLength),
    currentMiddle: current.slice(prefixLength, suffixStartCurrent),
    targetMiddle: target.slice(prefixLength, suffixStartTarget),
    suffix: current.slice(suffixStartCurrent),
    prefixLength,
    suffixLength,
    cursorTravelLeft: suffixLength,
    deleteCount: current.length - prefixLength - suffixLength,
    typeCount: target.length - prefixLength - suffixLength
  };
}

export function getMelbourneParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const parts = Object.create(null);
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }

  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);

  return {
    hour,
    minute,
    second,
    weekday: parts.weekday,
    day: parts.day,
    month: parts.month,
    year: parts.year,
    phrase: timeToPhrase(hour, minute),
    minuteKey: `${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}`,
    dateLabel: `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`.toUpperCase()
  };
}
