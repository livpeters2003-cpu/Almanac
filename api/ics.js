// Reads a calendar's private iCal link (Apple iCloud, Google "secret address", Outlook…) and returns its events.
// The app sends the link in the request body, so it never shows up in web addresses or logs.
// Repeating events are expanded here, and times are turned into exact moments so each phone shows its own time zone.

const DAY = 864e5;
const MAX_BYTES = 8 * 1024 * 1024, MAX_EVENTS = 6000;

// Outlook and Exchange feeds use Windows time zone names.
const WIN_TZ = {
  'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix', 'Pacific Standard Time': 'America/Los_Angeles', 'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu', 'Atlantic Standard Time': 'America/Halifax', 'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris', 'Central Europe Standard Time': 'Europe/Budapest',
  'E. Europe Standard Time': 'Europe/Bucharest', 'AUS Eastern Standard Time': 'Australia/Sydney', 'India Standard Time': 'Asia/Kolkata',
  'China Standard Time': 'Asia/Shanghai', 'Tokyo Standard Time': 'Asia/Tokyo', 'UTC': 'UTC', 'Coordinated Universal Time': 'UTC',
};
const dtfs = {};
function zone(tz) {
  if (!tz) return null;
  tz = String(tz).replace(/^"|"$/g, '').replace(/^\/+/, '').trim();
  tz = WIN_TZ[tz] || tz;
  if (!(tz in dtfs)) {
    try { dtfs[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch (e) { dtfs[tz] = null; }
  }
  return dtfs[tz] ? tz : null;
}
function offsetAt(ms, tz) {
  const p = {}; for (const x of dtfs[tz].formatToParts(new Date(ms))) p[x.type] = x.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}
// A wall-clock time in a time zone, as an exact moment.
export function wallToUtc(w, tz) {
  const guess = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  if (!tz || tz === 'UTC') return guess;
  const o1 = offsetAt(guess, tz); let t = guess - o1;
  const o2 = offsetAt(t, tz); if (o2 !== o1) t = guess - o2;
  return t;
}

const unescape = s => s.replace(/\\([nN,;\\])/g, (m, c) => (c === 'n' || c === 'N' ? '\n' : c));
function parseLine(line) {
  let i = 0, q = false;
  for (; i < line.length; i++) { const c = line[i]; if (c === '"') q = !q; else if (c === ':' && !q) break; }
  const head = line.slice(0, i), value = line.slice(i + 1), parts = head.split(';'), params = {};
  for (const p of parts.slice(1)) { const k = p.indexOf('='); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ''); }
  return { name: parts[0].toUpperCase(), params, value };
}
// "20261014", "20261014T090000", "20261014T090000Z" → a date or a time with its zone.
function parseWhen(value, params, calTz) {
  const m = String(value).trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const w = { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  if (!m[4] || params.VALUE === 'DATE') return { allDay: true, w };
  if (m[7]) return { w, tz: 'UTC' };
  const tz = zone(params.TZID) || (params.TZID ? null : calTz);
  return tz ? { w, tz } : { w, floating: true };
}
const ymd = w => `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
const fromUtcDate = (dt, w) => ({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), h: w.h, mi: w.mi, s: w.s });
// Comparable key for an instance: exact ms for zoned times, wall-clock for floating times and dates.
const keyOf = (when, w) => when.allDay ? ymd(w) : when.floating ? Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) : wallToUtc(w, when.tz);

function parseDuration(s) {
  const m = String(s || '').match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const ms = (((+m[2] || 0) * 7 + (+m[3] || 0)) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
  return m[1] === '-' ? -ms : ms;
}

export function parseIcs(text) {
  text = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '');
  if (!/BEGIN:VCALENDAR/i.test(text)) return null;
  const lines = text.split('\n'), events = [];
  let name = '', calTz = null, cur = null, depth = 0;
  for (const line of lines) {
    if (!line) continue;
    const { name: key, params, value } = parseLine(line);
    if (key === 'BEGIN') {
      if (value.toUpperCase() === 'VEVENT' && !cur) { cur = { exdates: [], rdates: [] }; depth = 0; } else if (cur) depth++;
      continue;
    }
    if (key === 'END') {
      if (cur && depth) { depth--; continue; }
      if (cur && value.toUpperCase() === 'VEVENT') { events.push(cur); cur = null; }
      continue;
    }
    if (!cur) {
      if (key === 'X-WR-CALNAME') name = unescape(value).trim();
      if (key === 'X-WR-TIMEZONE') calTz = zone(value);
      continue;
    }
    if (depth) continue;   // inside an alarm
    switch (key) {
      case 'UID': cur.uid = value.trim(); break;
      case 'SUMMARY': cur.title = unescape(value).trim(); break;
      case 'DESCRIPTION': cur.notes = unescape(value).trim(); break;
      case 'LOCATION': cur.location = unescape(value).trim(); break;
      case 'STATUS': cur.status = value.trim().toUpperCase(); break;
      case 'DTSTART': cur.startP = [value, params]; break;
      case 'DTEND': cur.endP = [value, params]; break;
      case 'DURATION': cur.duration = parseDuration(value.trim()); break;
      case 'RRULE': cur.rrule = value.trim(); break;
      case 'RECURRENCE-ID': cur.recurP = [value, params]; break;
      case 'EXDATE': for (const v of value.split(',')) cur.exdates.push([v, params]); break;
      case 'RDATE': if (params.VALUE !== 'PERIOD') for (const v of value.split(',')) cur.rdates.push([v, params]); break;
    }
  }
  for (const e of events) {
    e.start = e.startP && parseWhen(e.startP[0], e.startP[1], calTz);
    e.end = e.endP && parseWhen(e.endP[0], e.endP[1], calTz);
    e.recur = e.recurP && parseWhen(e.recurP[0], e.recurP[1], calTz);
  }
  return { name, calTz, events: events.filter(e => e.start) };
}

const WDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
function parseRule(s) {
  const r = {};
  for (const part of s.split(';')) { const [k, v] = part.split('='); if (k && v) r[k.toUpperCase()] = v; }
  return {
    freq: r.FREQ, interval: Math.max(1, +r.INTERVAL || 1), count: r.COUNT ? +r.COUNT : null,
    until: r.UNTIL ? parseWhen(r.UNTIL, {}, 'UTC') : null,
    byday: r.BYDAY ? r.BYDAY.split(',').map(x => { const m = x.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i); return m && { n: m[1] ? +m[1] : 0, wd: WDAYS.indexOf(m[2].toUpperCase()) }; }).filter(Boolean) : null,
    bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number).filter(Boolean) : null,
    bymonth: r.BYMONTH ? r.BYMONTH.split(',').map(Number).filter(Boolean) : null,
    wkst: WDAYS.indexOf((r.WKST || 'MO').toUpperCase()),
  };
}
// Days (as UTC-midnight Dates) a rule produces in one period starting at `p`.
function periodDays(rule, p, start) {
  const y = p.getUTCFullYear(), mo = p.getUTCMonth(), out = [];
  const monthDays = (yy, mm) => {
    const len = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate(), list = [];
    if (rule.byday) {
      for (const b of rule.byday) {
        const all = []; for (let d = 1; d <= len; d++) if (new Date(Date.UTC(yy, mm, d)).getUTCDay() === b.wd) all.push(d);
        if (!b.n) list.push(...all); else { const d = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (d) list.push(d); }
      }
      if (rule.bymonthday) { const keep = new Set(rule.bymonthday.map(n => n < 0 ? len + n + 1 : n)); return list.filter(d => keep.has(d)); }
      return list;
    }
    if (rule.bymonthday) return rule.bymonthday.map(n => n < 0 ? len + n + 1 : n).filter(d => d >= 1 && d <= len);
    return start.d <= len ? [start.d] : [];
  };
  if (rule.freq === 'DAILY') out.push(p);
  else if (rule.freq === 'WEEKLY') {
    const days = rule.byday ? rule.byday.map(b => b.wd) : [new Date(Date.UTC(start.y, start.m - 1, start.d)).getUTCDay()];
    for (let i = 0; i < 7; i++) { const d = new Date(p.getTime() + i * DAY); if (days.includes(d.getUTCDay())) out.push(d); }
  } else if (rule.freq === 'MONTHLY') {
    for (const d of monthDays(y, mo)) out.push(new Date(Date.UTC(y, mo, d)));
  } else if (rule.freq === 'YEARLY') {
    const months = rule.bymonth ? rule.bymonth.map(m => m - 1) : [start.m - 1];
    for (const mm of months) {
      if (rule.byday || rule.bymonthday) for (const d of monthDays(y, mm)) out.push(new Date(Date.UTC(y, mm, d)));
      else { const len = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate(); if (start.d <= len) out.push(new Date(Date.UTC(y, mm, start.d))); }
    }
  }
  if (rule.freq === 'DAILY' && rule.bymonth && !rule.bymonth.includes(mo + 1)) return [];
  if (rule.freq === 'DAILY' && rule.byday && !rule.byday.some(b => b.wd === p.getUTCDay())) return [];
  return out.sort((a, b) => a - b);
}
// Start wall-clock times of every instance up to `toMs` (and the COUNT/UNTIL limits).
export function expandRule(ruleText, start, when, toMs) {
  const rule = parseRule(ruleText); if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(rule.freq)) return [start];
  const first = Date.UTC(start.y, start.m - 1, start.d), out = [];
  let p = new Date(first);
  if (rule.freq === 'WEEKLY') { const back = (p.getUTCDay() - rule.wkst + 7) % 7; p = new Date(first - back * DAY); }
  if (rule.freq === 'MONTHLY') p = new Date(Date.UTC(start.y, start.m - 1, 1));
  if (rule.freq === 'YEARLY') p = new Date(Date.UTC(start.y, 0, 1));
  const untilKey = rule.until ? (rule.until.allDay ? ymd(rule.until.w) : wallToUtc(rule.until.w, 'UTC')) : null;
  let n = 0;
  for (let guard = 0; guard < 4000; guard++) {
    for (const d of periodDays(rule, p, start)) {
      if (d.getTime() < first) continue;
      const w = fromUtcDate(d, start), ms = when.allDay ? d.getTime() : keyOf(when, w);
      if (untilKey !== null && (typeof untilKey === 'string' ? ymd(w) > untilKey : ms > untilKey)) return out;
      if (rule.count !== null && n >= rule.count) return out;
      if (ms > toMs) return out;
      out.push(w); n++;
    }
    if (rule.freq === 'DAILY') p = new Date(p.getTime() + rule.interval * DAY);
    else if (rule.freq === 'WEEKLY') p = new Date(p.getTime() + rule.interval * 7 * DAY);
    else if (rule.freq === 'MONTHLY') p = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() + rule.interval, 1));
    else p = new Date(Date.UTC(p.getUTCFullYear() + rule.interval, 0, 1));
  }
  return out;
}

const pad = n => String(n).padStart(2, '0');
const floatIso = w => `${ymd(w)}T${pad(w.h)}:${pad(w.mi)}`;
// One output event. Timed events carry exact moments (ISO, UTC); all-day events carry dates (end is exclusive).
function emit(e, w, out) {
  const s = e.start;
  const base = { uid: e.uid || '', title: e.title || '', ...(e.location ? { location: e.location.slice(0, 500) } : {}), ...(e.notes ? { notes: e.notes.slice(0, 4000) } : {}) };
  if (s.allDay) {
    const startMs = Date.UTC(w.y, w.m - 1, w.d);
    let len = e.end?.allDay ? Math.round((Date.UTC(e.end.w.y, e.end.w.m - 1, e.end.w.d) - Date.UTC(s.w.y, s.w.m - 1, s.w.d)) / DAY) : e.duration ? Math.round(e.duration / DAY) : 1;
    len = Math.min(Math.max(len, 1), 62);
    out.push({ ...base, allDay: true, date: ymd(w), endDate: new Date(startMs + len * DAY).toISOString().slice(0, 10) });
    return;
  }
  const startMs = keyOf(s, w);
  let dur = e.duration ?? (e.end && !e.end.allDay ? keyOf(e.end, e.end.w) - keyOf(s, s.w) : 0);
  if (!(dur >= 0) || dur > 62 * DAY) dur = 0;
  if (s.floating) { const end = new Date(startMs + dur); out.push({ ...base, floating: true, start: floatIso(w), end: dur ? floatIso({ y: end.getUTCFullYear(), m: end.getUTCMonth() + 1, d: end.getUTCDate(), h: end.getUTCHours(), mi: end.getUTCMinutes() }) : '' }); }
  else out.push({ ...base, start: new Date(startMs).toISOString(), end: dur ? new Date(startMs + dur).toISOString() : '' });
}

// All events between fromMs and toMs, repeats expanded, cancelled ones and exceptions handled.
export function eventsBetween(cal, fromMs, toMs) {
  const out = [], overrides = new Map();
  for (const e of cal.events) if (e.recur && e.uid) {
    const set = overrides.get(e.uid) || new Set(); set.add(String(keyOf(e.recur, e.recur.w))); overrides.set(e.uid, set);
  }
  const endOf = (e, w) => {   // the moment an instance ends, to keep ones that started before `fromMs`
    if (e.start.allDay) { const len = e.end?.allDay ? Date.UTC(e.end.w.y, e.end.w.m - 1, e.end.w.d) - Date.UTC(e.start.w.y, e.start.w.m - 1, e.start.w.d) : DAY; return Date.UTC(w.y, w.m - 1, w.d) + Math.max(len, DAY); }
    const st = keyOf(e.start, w), dur = e.duration ?? (e.end && !e.end.allDay ? keyOf(e.end, e.end.w) - keyOf(e.start, e.start.w) : 0);
    return st + Math.max(dur || 0, 0);
  };
  const startMs = (e, w) => e.start.allDay ? Date.UTC(w.y, w.m - 1, w.d) : keyOf(e.start, w);
  for (const e of cal.events) {
    if (e.status === 'CANCELLED') continue;
    if (e.recur) { if (startMs(e, e.start.w) <= toMs && endOf(e, e.start.w) >= fromMs) emit(e, e.start.w, out); continue; }
    let starts = e.rrule ? expandRule(e.rrule, e.start.w, e.start, toMs) : [e.start.w];
    if (e.rdates.length) for (const [v, p] of e.rdates) { const r = parseWhen(v, p, cal.calTz); if (r) starts.push({ ...r.w, ...(e.start.allDay ? {} : r.allDay ? { h: e.start.w.h, mi: e.start.w.mi, s: e.start.w.s } : {}) }); }
    const skip = new Set(e.exdates.map(([v, p]) => { const x = parseWhen(v, p, cal.calTz); return x && String(x.allDay && !e.start.allDay ? ymd(x.w) : keyOf(e.start.allDay ? { allDay: true } : x, x.w)); }).filter(Boolean));
    const moved = overrides.get(e.uid);
    for (const w of starts) {
      const k = String(keyOf(e.start, w));
      if (skip.has(k) || skip.has(ymd(w)) || moved?.has(k)) continue;
      if (startMs(e, w) > toMs || endOf(e, w) < fromMs) continue;
      emit(e, w, out);
      if (out.length >= MAX_EVENTS) return out;
    }
  }
  return out;
}

// Only public web addresses: no local machines, private networks or bare IP addresses.
export function checkUrl(raw) {
  let s = String(raw || '').trim();
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:\/\//i, 'https://');
  let u; try { u = new URL(s); } catch (e) { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[') || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h)) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  return u;
}

async function fetchIcs(url) {
  let u = url;
  for (let hop = 0; hop < 4; hop++) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
    try {
      const res = await fetch(u, { redirect: 'manual', signal: ctl.signal, headers: { accept: 'text/calendar, */*', 'user-agent': 'Almanac calendar reader' } });
      if (res.status >= 300 && res.status < 400) { const next = checkUrl(new URL(res.headers.get('location') || '', u).href); if (!next) return { error: 'link' }; u = next; continue; }
      if (!res.ok) return { error: res.status === 404 || res.status === 403 || res.status === 401 ? 'gone' : 'down' };
      if (+res.headers.get('content-length') > MAX_BYTES) return { error: 'big' };
      const reader = res.body.getReader(), chunks = []; let size = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_BYTES) { ctl.abort(); return { error: 'big' }; } chunks.push(value); }
      return { text: Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8') };
    } catch (e) { return { error: 'down' }; } finally { clearTimeout(t); }
  }
  return { error: 'link' };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'post' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const url = checkUrl(body?.url);
  if (!url) return res.status(400).json({ error: 'link' });
  const got = await fetchIcs(url);
  if (got.error) return res.status(502).json({ error: got.error });
  const cal = parseIcs(got.text);
  if (!cal) return res.status(422).json({ error: 'notcal' });
  const now = Date.now(), from = +body.from || now - 400 * DAY, to = +body.to || now + 550 * DAY;
  const events = eventsBetween(cal, Math.max(from, now - 3 * 365 * DAY), Math.min(to, now + 3 * 365 * DAY));
  res.status(200).json({ name: cal.name, events, fetched_at: new Date(now).toISOString() });
}
