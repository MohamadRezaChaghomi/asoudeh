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
});

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

export function getCurrentJalaliMonthRange(now = new Date()): JalaliMonthRange {
  const tehranParts = dateParts(tehranDateFormatter, now);
  const todayMilliseconds = Date.UTC(
    tehranParts.year,
    tehranParts.month - 1,
    tehranParts.day,
  );
  const currentJalaliParts = dateParts(jalaliDateFormatter, asUtcDate(todayMilliseconds));

  let startMilliseconds = todayMilliseconds;
  let foundStart = false;
  for (let day = 0; day < 32; day += 1) {
    const previousMilliseconds = startMilliseconds - DAY_IN_MS;
    const previousMonth = dateParts(
      jalaliDateFormatter,
      asUtcDate(previousMilliseconds),
    );
    if (
      previousMonth.year !== currentJalaliParts.year ||
      previousMonth.month !== currentJalaliParts.month
    ) {
      foundStart = true;
      break;
    }
    startMilliseconds = previousMilliseconds;
  }

  let endMilliseconds = startMilliseconds;
  let foundEnd = false;
  for (let day = 0; day < 32; day += 1) {
    const nextMonth = dateParts(
      jalaliDateFormatter,
      asUtcDate(endMilliseconds),
    );
    if (
      nextMonth.year !== currentJalaliParts.year ||
      nextMonth.month !== currentJalaliParts.month
    ) {
      foundEnd = true;
      break;
    }
    endMilliseconds += DAY_IN_MS;
  }

  if (!foundStart || !foundEnd) {
    throw new Error('Unable to determine the current Jalali month boundaries.');
  }

  return {
    year: currentJalaliParts.year,
    month: currentJalaliParts.month,
    startDate: asUtcDate(startMilliseconds),
    endDateExclusive: asUtcDate(endMilliseconds),
    today: asUtcDate(todayMilliseconds),
  };
}

export function formatUtcDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
