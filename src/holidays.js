// Holidays shown on the built-in Holidays calendar.
// US dates are computed here, so they work offline and need no service.
// Other countries come from the free Nager.Date API and are cached on the device.

export const COUNTRIES = {
  US: 'United States', CA: 'Canada', MX: 'Mexico', GB: 'United Kingdom', IE: 'Ireland',
  AU: 'Australia', NZ: 'New Zealand', DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy',
  NL: 'Netherlands', PT: 'Portugal', CH: 'Switzerland', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
  PL: 'Poland', BR: 'Brazil', ZA: 'South Africa',
};

const pad = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
// nth weekday of a month (wd: 0 = Sunday); n = -1 means the last one
function nth(y, m, wd, n) {
  if (n > 0) { const first = new Date(y, m - 1, 1).getDay(); return 1 + ((wd - first + 7) % 7) + 7 * (n - 1); }
  const lastDay = new Date(y, m, 0), back = (lastDay.getDay() - wd + 7) % 7;
  return lastDay.getDate() - back;
}
// Anonymous Gregorian algorithm for Easter Sunday
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

export function usHolidays(y) {
  const [em, ed] = easter(y);
  return [
    [ymd(y, 1, 1), 'New Year’s Day'],
    [ymd(y, 1, nth(y, 1, 1, 3)), 'Martin Luther King Jr. Day'],
    [ymd(y, 2, 14), 'Valentine’s Day'],
    [ymd(y, 2, nth(y, 2, 1, 3)), 'Presidents’ Day'],
    [ymd(y, 3, 17), 'St. Patrick’s Day'],
    [ymd(y, em, ed), 'Easter Sunday'],
    [ymd(y, 5, nth(y, 5, 0, 2)), 'Mother’s Day'],
    [ymd(y, 5, nth(y, 5, 1, -1)), 'Memorial Day'],
    [ymd(y, 6, 19), 'Juneteenth'],
    [ymd(y, 6, nth(y, 6, 0, 3)), 'Father’s Day'],
    [ymd(y, 7, 4), 'Independence Day'],
    [ymd(y, 9, nth(y, 9, 1, 1)), 'Labor Day'],
    [ymd(y, 10, nth(y, 10, 1, 2)), 'Columbus Day / Indigenous Peoples’ Day'],
    [ymd(y, 10, 31), 'Halloween'],
    [ymd(y, 11, 11), 'Veterans Day'],
    [ymd(y, 11, nth(y, 11, 4, 4)), 'Thanksgiving'],
    [ymd(y, 12, 24), 'Christmas Eve'],
    [ymd(y, 12, 25), 'Christmas Day'],
    [ymd(y, 12, 31), 'New Year’s Eve'],
  ].map(([date, name]) => ({ date, name, country: 'US' }));
}

const CACHE = 'almanac-holidays-v1';
let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE)) || {}; } catch (e) { cache = {}; }
const loading = new Set();

// Returns the holidays already known for this year, and fetches any that are missing.
// onUpdate is called once fetched holidays arrive.
export function holidaysFor(year, countries, onUpdate) {
  const out = [];
  for (const cc of countries) {
    if (cc === 'US') { out.push(...usHolidays(year)); continue; }
    const key = `${cc}-${year}`;
    if (cache[key]) { out.push(...cache[key]); continue; }
    if (loading.has(key) || !COUNTRIES[cc]) continue;
    loading.add(key);
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(rows => {
        cache[key] = rows.filter(r => r && r.date).map(r => ({ date: r.date, name: r.localName && r.localName !== r.name ? `${r.name} (${r.localName})` : r.name, country: cc }));
        try { localStorage.setItem(CACHE, JSON.stringify(cache)); } catch (e) {}
        onUpdate?.();
      })
      .catch(() => {})
      .finally(() => loading.delete(key));
  }
  return out;
}
