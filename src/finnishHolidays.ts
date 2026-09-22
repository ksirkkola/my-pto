// Computes Finland's public holidays (days the office is closed) for a given
// year. Fixed-date holidays are hardcoded; Easter-relative ones are derived
// from the Gregorian Easter algorithm (Meeus/Jones/Butcher) so this stays
// correct every year with no manual maintenance. Whit Sunday is a flag day in
// Finland but NOT a statutory day off, so it's deliberately excluded.

export interface Holiday {
  name: string;
  date: Date;
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Meeus/Jones/Butcher Gregorian Easter algorithm.
function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

// Finds the single date with the given day-of-week (0=Sun..6=Sat) inside a
// fixed day-of-month range in one month — used for Midsummer, which is
// defined as "the Friday between day X and day Y" (both within June).
function findWeekdayInRange(year: number, month: number, startDay: number, endDay: number, targetDow: number): Date {
  for (let day = startDay; day <= endDay; day++) {
    const d = utcDate(year, month, day);
    if (d.getUTCDay() === targetDow) return d;
  }
  throw new Error(`No matching weekday found for ${year}-${month} in range ${startDay}-${endDay}`);
}

// Finds the single date with the given day-of-week starting from a fixed
// date and searching forward N days — used for All Saints' Day ("the
// Saturday between Oct 31 and Nov 6", which crosses a month boundary).
function findWeekdayFrom(start: Date, daysForward: number, targetDow: number): Date {
  for (let offset = 0; offset <= daysForward; offset++) {
    const d = addDays(start, offset);
    if (d.getUTCDay() === targetDow) return d;
  }
  throw new Error('No matching weekday found in range');
}

export function getFinnishHolidays(year: number): Holiday[] {
  const easterSunday = computeEasterSunday(year);
  const midsummerEve = findWeekdayInRange(year, 6, 19, 25, 5); // Friday
  const midsummerDay = addDays(midsummerEve, 1); // always the following Saturday
  const allSaintsDay = findWeekdayFrom(utcDate(year, 10, 31), 6, 6); // Saturday, Oct 31–Nov 6

  return [
    { name: "New Year's Day", date: utcDate(year, 1, 1) },
    { name: 'Epiphany', date: utcDate(year, 1, 6) },
    { name: 'Good Friday', date: addDays(easterSunday, -2) },
    { name: 'Easter Sunday', date: easterSunday },
    { name: 'Easter Monday', date: addDays(easterSunday, 1) },
    { name: 'May Day (Vappu)', date: utcDate(year, 5, 1) },
    { name: 'Ascension Day', date: addDays(easterSunday, 39) },
    { name: 'Midsummer Eve', date: midsummerEve },
    { name: 'Midsummer Day', date: midsummerDay },
    { name: "All Saints' Day", date: allSaintsDay },
    { name: 'Independence Day', date: utcDate(year, 12, 6) },
    { name: 'Christmas Eve', date: utcDate(year, 12, 24) },
    { name: 'Christmas Day', date: utcDate(year, 12, 25) },
    { name: 'Boxing Day (Tapaninpäivä)', date: utcDate(year, 12, 26) },
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}
