const DAY_IN_MS = 24 * 60 * 60 * 1000;

const tehranDateFormatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const jalaliDateFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
}

function dateParts(
  formatter: Intl.DateTimeFormat,
  date: Date,
): Record<string, number> {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(({ type }) => ['year', 'month', 'day'].includes(type))
      .map(({ type, value }) => [type, Number(value)]),
  );
  if (Object.values(parts).some((value) => !Number.isInteger(value))) {
    throw new Error('Unable to read calendar date parts.');
  }
  return parts;
}

function asUtcDate(milliseconds: number): Date {
  return new Date(milliseconds);
}

export interface JalaliMonthRange {
  year: number;
  month: number;
  startDate: Date;
  endDateExclusive: Date;
  today: Date;
}

export function getJalaliMonthRange(year: number, month: number): Omit<JalaliMonthRange, 'today'> {
  if (!Number.isInteger(year) || year < 1200 || year > 1600) {
    throw new RangeError('Invalid Jalali year.');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Invalid Jalali month.');
  }

  const searchStart = Date.UTC(year + 621, 2, 1);
  const searchEnd = Date.UTC(year + 622, 3, 30);
  let startMilliseconds: number | undefined;
  for (let milliseconds = searchStart; milliseconds <= searchEnd; milliseconds += DAY_IN_MS) {
    const parts = dateParts(jalaliDateFormatter, asUtcDate(milliseconds));
    if (parts.year === year && parts.month === month && parts.day === 1) {
      startMilliseconds = milliseconds;
      break;
    }
  }

  if (startMilliseconds === undefined) {
    throw new RangeError('Unable to determine the Jalali month start.');
  }

  let endMilliseconds = startMilliseconds + DAY_IN_MS;
  let foundEnd = false;
  for (let day = 0; day < 32; day += 1) {
    const nextMonth = dateParts(
      jalaliDateFormatter,
      asUtcDate(endMilliseconds),
    );
    if (nextMonth.year !== year || nextMonth.month !== month) {
      foundEnd = true;
      break;
    }
    endMilliseconds += DAY_IN_MS;
  }

  if (!foundEnd) {
    throw new RangeError('Unable to determine the Jalali month end.');
  }

  return {
    year,
    month,
    startDate: asUtcDate(startMilliseconds),
    endDateExclusive: asUtcDate(endMilliseconds),
  };
}

export function getJalaliDateParts(date: Date): JalaliDateParts {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Invalid date.');
  }
  const parts = dateParts(jalaliDateFormatter, date);
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function formatJalaliMonthKey(year: number, month: number): string {
  if (
    !Number.isInteger(year) ||
    year < 1200 ||
    year > 1600 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new RangeError('Invalid Jalali month.');
  }
  return `${String(month).padStart(2, '0')}-${year}`;
}

export function getCurrentJalaliMonthRange(now = new Date()): JalaliMonthRange {
  const tehranParts = dateParts(tehranDateFormatter, now);
  const today = asUtcDate(Date.UTC(tehranParts.year, tehranParts.month - 1, tehranParts.day));
  const currentJalaliParts = dateParts(jalaliDateFormatter, today);

  return {
    ...getJalaliMonthRange(currentJalaliParts.year, currentJalaliParts.month),
    today,
  };
}

export function formatUtcDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getMonthlyOccurrenceDate(
  anchorDate: Date,
  year: number,
  month: number,
): Date | undefined {
  const anchorParts = getJalaliDateParts(anchorDate);
  if (year < anchorParts.year || (year === anchorParts.year && month < anchorParts.month)) {
    return undefined;
  }

  const range = getJalaliMonthRange(year, month);
  const daysInMonth =
    (range.endDateExclusive.getTime() - range.startDate.getTime()) / DAY_IN_MS;
  const day = Math.min(anchorParts.day, daysInMonth);
  return new Date(range.startDate.getTime() + (day - 1) * DAY_IN_MS);
}
