// Turning a spreadsheet (.xlsx or .csv) into calendar events.
// Workouts: Date, Exercise, Sets, Reps, Weight (one row per exercise, or one row per set).
// Everything else: Date, Title, Time, Notes.

const pad = n => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const validYmd = (y, m, d) => { const t = new Date(y, m - 1, d); return y > 1900 && y < 2200 && t.getMonth() === m - 1 && t.getDate() === d; };
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/* ---------- reading files ---------- */
export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === delim) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}
export async function readTable(file) {
  const name = (file.name || '').toLowerCase();
  if (/\.(csv|tsv|txt)$/.test(name) || /csv|text\/plain/.test(file.type || '')) return { sheets: [{ name: 'Sheet 1', rows: parseCsv(await file.text()) }] };
  if (/\.xls$/.test(name)) throw Object.assign(new Error('old-xls'), { code: 'old-xls' });
  const { default: readExcelFile } = await import('read-excel-file/browser');
  const sheets = await readExcelFile(file);
  return { sheets: sheets.map(s => ({ name: s.sheet, rows: (s.data || []).filter(r => r && r.some(v => v !== null && v !== '')) })) };
}

/* ---------- reading cells ---------- */
const blank = v => v === null || v === undefined || String(v).trim() === '';
export function toDate(v) {
  if (blank(v)) return null;
  if (v instanceof Date) return isNaN(v) ? null : isoOf(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === 'number') {   // Excel day number
    if (v < 20000 || v > 80000) return null;
    const d = new Date(Math.round((Math.floor(v) - 25569) * 864e5));
    return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(v).trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1');
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return validYmd(+m[1], +m[2], +m[3]) ? isoOf(+m[1], +m[2], +m[3]) : null;
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/))) {
    let y = +m[3]; if (y < 100) y += 2000;
    let mo = +m[1], d = +m[2];
    if (mo > 12 && d <= 12) [mo, d] = [d, mo];   // 14/10/2026 is day-first
    return validYmd(y, mo, d) ? isoOf(y, mo, d) : null;
  }
  const mon = w => MON[w.slice(0, 4)] ?? MON[w.slice(0, 3)];
  if ((m = s.match(/(?:^|\s)([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/)) && mon(m[1])) return validYmd(+m[3], mon(m[1]), +m[2]) ? isoOf(+m[3], mon(m[1]), +m[2]) : null;
  if ((m = s.match(/(?:^|\s)(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})/)) && mon(m[2])) return validYmd(+m[3], mon(m[2]), +m[1]) ? isoOf(+m[3], mon(m[2]), +m[1]) : null;
  return null;
}
const hm = (h, mi) => (h >= 0 && h < 24 && mi >= 0 && mi < 60) ? `${pad(h)}:${pad(mi)}` : '';
function oneTime(s, apHint) {
  const m = s.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(a|p|am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return { t: '', ap: '' };
  let h = +m[1]; const mi = +(m[2] || 0), ap = (m[3] || apHint || '')[0] || '';
  if (!m[2] && !ap && h > 24) return { t: '', ap: '' };
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return { t: hm(h, mi), ap: (m[3] || '')[0] || '' };
}
// Returns { start, end } as HH:MM strings ('' when missing).
export function toTimes(v) {
  if (blank(v)) return { start: '', end: '' };
  if (v instanceof Date) return { start: isNaN(v) ? '' : hm(v.getUTCHours(), v.getUTCMinutes()), end: '' };
  if (typeof v === 'number') { const f = v % 1, mins = Math.round(f * 1440) % 1440; return { start: v < 1 || f ? hm(Math.floor(mins / 60), mins % 60) : '', end: '' }; }
  const s = String(v).trim().toLowerCase();
  if (/^(all day|any time|anytime)$/.test(s)) return { start: '', end: '' };
  const parts = s.split(/\s*(?:-|–|—|to|until)\s*/);
  if (parts.length === 2) {
    const b = oneTime(parts[1]), a = oneTime(parts[0], b.ap);
    return { start: a.t, end: b.t };
  }
  return { start: oneTime(s).t, end: '' };
}
export const toNum = v => { if (typeof v === 'number') return v; const m = String(v ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };
const numText = v => { const n = toNum(v); return n === null ? '' : String(Math.round(n * 100) / 100); };
// Durations like 0:45 or 1:30 (minutes:seconds) for planks and other timed holds.
const isClock = v => typeof v === 'string' && /^\s*\d{1,2}:\d{2}\s*$/.test(v);
const clock = v => isClock(v) ? v.trim() : typeof v === 'number' || (typeof v === 'string' && v.trim()) ? String(v).trim() : '';
const text = v => v instanceof Date ? toDate(v) || '' : String(v ?? '').trim();

/* ---------- columns ---------- */
export const FIELDS = {
  workout: [
    ['date', 'Date', true], ['exercise', 'Exercise', true], ['sets', 'Sets'], ['reps', 'Reps'], ['weight', 'Weight'],
    ['title', 'Workout name'], ['time', 'Time'], ['notes', 'Notes'], ['wnotes', 'Workout notes'],
  ],
  events: [['date', 'Date', true], ['title', 'Title', true], ['time', 'Time'], ['end', 'End time'], ['notes', 'Notes']],
};
const NAMES = {
  date: ['date', 'day', 'when', 'startdate'],
  exercise: ['exercise', 'exercisename', 'movement', 'lift', 'exercises'],
  sets: ['sets', 'setcount', 'numberofsets', 'set', 'setnumber', 'setno'],
  reps: ['reps', 'rep', 'repetitions', 'repcount'],
  weight: ['weight', 'load', 'lbs', 'lb', 'kg', 'kgs', 'weightlb', 'weightlbs', 'weightkg', 'pounds'],
  title: ['title', 'event', 'name', 'subject', 'summary', 'what', 'workout', 'workoutname', 'session', 'routine', 'eventname'],
  time: ['time', 'start', 'starttime', 'from', 'begins'],
  end: ['end', 'endtime', 'until', 'to', 'ends', 'finish'],
  notes: ['notes', 'note', 'description', 'details', 'comments', 'comment', 'memo'],
  wnotes: ['workoutnotes', 'sessionnotes', 'daynotes'],
};
const norm = s => String(s ?? '').toLowerCase().replace(/\(.*?\)/g, m => m.replace(/[()]/g, '')).replace(/[^a-z0-9]/g, '');
export function guessMap(headers, kind) {
  const map = {}, used = new Set(), hs = headers.map(norm);
  for (const [f] of FIELDS[kind]) {
    let i = hs.findIndex((h, j) => !used.has(j) && NAMES[f].includes(h));
    if (i < 0) i = hs.findIndex((h, j) => !used.has(j) && h && NAMES[f].some(n => n.length > 2 && h.startsWith(n)));
    if (kind === 'events' && f === 'title' && i < 0) i = hs.findIndex((h, j) => !used.has(j) && h && !['date', 'time', 'end', 'notes'].some(g => NAMES[g].includes(h)) && j !== map.date);
    if (i >= 0) { map[f] = i; used.add(i); }
  }
  return map;
}
// Finds the header row. Returns -1 when the sheet starts straight with data.
export function headerRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i] || [];
    if (r.some(v => toDate(v)) && !r.some(v => NAMES.date.includes(norm(v)))) return i === 0 ? -1 : i - 1;
    if (r.filter(v => typeof v === 'string' && /[a-z]/i.test(v)).length >= 2) return i;
  }
  return 0;
}
export function prepare(rows, kind) {
  const h = headerRow(rows), width = Math.max(0, ...rows.slice(0, 50).map(r => r.length));
  const headers = h >= 0 ? Array.from({ length: width }, (_, i) => text(rows[h][i]) || `Column ${i + 1}`) : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  const map = h >= 0 ? guessMap(headers, kind) : Object.fromEntries((kind === 'workout' ? ['date', 'exercise', 'sets', 'reps', 'weight'] : ['date', 'title', 'time', 'notes']).map((f, i) => [f, i]).filter(([, i]) => i < width));
  return { headers, data: rows.slice(h + 1), map };
}

/* ---------- building events ---------- */
const exKey = s => String(s).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
// Looks up an exercise in the library by name, ignoring case and the "(Barbell)" style suffix when that's unambiguous.
export function findExercise(lib, name) {
  const n = name.toLowerCase().trim();
  const exact = lib.find(e => e.name.toLowerCase().trim() === n); if (exact) return exact;
  const k = exKey(name), loose = lib.filter(e => exKey(e.name) === k);
  return loose.length === 1 ? loose[0] : null;
}
// plan: { events, newExercises, skipped: [{row, why}], dupes, range: [first, last] }
export function planWorkouts({ data, map, headers = [] }, { cal, db, today, uid, starter = [], skipDupes = true }) {
  const get = (r, f) => map[f] === undefined ? undefined : r[map[f]];
  const skipped = [], groups = new Map(), newExercises = [];
  data.forEach((r, i) => {
    const date = toDate(get(r, 'date')), name = text(get(r, 'exercise'));
    if (!date) { if (r.some(v => !blank(v))) skipped.push({ row: i, why: 'no date' }); return; }
    if (!name) { skipped.push({ row: i, why: 'no exercise' }); return; }
    const title = text(get(r, 'title')) || 'Workout', key = `${date}\u0000${title.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { date, title, time: toTimes(get(r, 'time')), notes: [], rows: [] });
    const g = groups.get(key), note = text(get(r, 'notes')), wnote = text(get(r, 'wnotes'));
    if (wnote && !g.notes.includes(wnote)) g.notes.push(wnote);
    g.rows.push({ name, sets: get(r, 'sets'), reps: get(r, 'reps'), weight: get(r, 'weight'), note });
  });
  const setCol = map.sets !== undefined ? norm(headers[map.sets]) : '';
  const perSetHeader = ['set', 'setnumber', 'setno'].includes(setCol);
  const lib = [...db.exercises], events = [];
  let dupes = 0;
  for (const g of groups.values()) {
    if (db.events.some(e => e.calId === cal.id && e.date === g.date && e.format === 'workout')) { dupes++; if (skipDupes) continue; }
    const exercises = [], byName = new Map();
    const order = [];
    for (const r of g.rows) { const k = r.name.toLowerCase(); if (!byName.has(k)) { byName.set(k, []); order.push(k); } byName.get(k).push(r); }
    for (const k of order) {
      const rs = byName.get(k), name = rs[0].name;
      let ex = findExercise(lib, name);
      const hasW = rs.some(r => toNum(r.weight) !== null && !isClock(r.weight)), hasT = rs.some(r => isClock(r.weight) || isClock(r.reps));
      if (!ex) {   // new to the library: borrow muscle and equipment from the common list when the name matches
        const known = findExercise(starter, name);
        ex = known ? { ...known, id: uid() } : { id: uid(), name, muscle: 'Other', equipment: 'Other', kind: hasT ? 'time' : hasW ? 'weight' : 'reps' };
        lib.push(ex); newExercises.push(ex);
      }
      const nums = rs.map(r => toNum(r.sets));
      const perSet = perSetHeader || (rs.length > 1 && nums.every((n, j) => n === j + 1));
      const done = g.date <= today, sets = [];
      for (const r of rs) {
        const n = perSet ? 1 : Math.min(Math.max(1, Math.round(toNum(r.sets) || 1)), 20);
        const set = ex.kind === 'time' ? { a: clock(r.weight) || clock(r.reps), b: '' } : { a: ex.kind === 'reps' ? '' : numText(r.weight), b: numText(r.reps) };
        for (let j = 0; j < n; j++) sets.push({ t: 'n', ...set, done });
      }
      const note = [...new Set(rs.map(r => r.note).filter(Boolean))].join('; ');
      exercises.push({ exId: ex.id, name: ex.name, kind: ex.kind, muscle: ex.muscle, note, sets });
    }
    events.push({ id: uid(), calId: cal.id, date: g.date, title: g.title, start: g.time.start, end: g.time.end, format: 'workout', data: { exercises, notes: g.notes.join('\n\n') } });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  return { events, newExercises, skipped, dupes, range: events.length ? [events[0].date, events[events.length - 1].date] : null };
}
export function planEvents({ data, map }, { cal, db, uid, blankData, notesKey, skipDupes = true }) {
  const get = (r, f) => map[f] === undefined ? undefined : r[map[f]];
  const skipped = [], events = [], seen = new Set();
  let dupes = 0;
  data.forEach((r, i) => {
    const date = toDate(get(r, 'date'));
    if (!date) { if (r.some(v => !blank(v))) skipped.push({ row: i, why: 'no date' }); return; }
    const title = text(get(r, 'title')), t = toTimes(get(r, 'time')), e2 = toTimes(get(r, 'end')).start;
    if (!title && blank(get(r, 'notes'))) { skipped.push({ row: i, why: 'no title' }); return; }
    const key = `${date}\u0000${title.toLowerCase()}`;
    if (seen.has(key) || db.events.some(e => e.calId === cal.id && e.date === date && (e.title || '').toLowerCase() === title.toLowerCase())) { dupes++; if (skipDupes) return; }
    seen.add(key);
    const format = cal.format || 'notes', data = blankData(format), nk = notesKey(format, data);
    const note = text(get(r, 'notes'));
    if (note && nk) data[nk] = note;
    events.push({ id: uid(), calId: cal.id, date, title: title || note.slice(0, 60), start: t.start, end: e2 || t.end, format, data });
  });
  events.sort((a, b) => a.date.localeCompare(b.date));
  return { events, newExercises: [], skipped, dupes, range: events.length ? [events[0].date, events[events.length - 1].date] : null };
}

export const SAMPLE_CSV = {
  workout: 'Date,Exercise,Sets,Reps,Weight\n2026-10-13,Squat (Barbell),3,8,135\n2026-10-13,Romanian Deadlift (Barbell),3,10,95\n2026-10-15,Bench Press (Barbell),4,6,85\n2026-10-15,Lat Pulldown (Cable),3,12,70\n',
  events: 'Date,Title,Time,Notes\n2026-10-20,Dentist,9:30 AM,Bring insurance card\n2026-10-24,Dinner with Sam,7-9pm,\n2026-11-02,Project due,,Submit by midnight\n',
};
