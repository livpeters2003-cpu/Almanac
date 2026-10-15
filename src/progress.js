// Workout progress: per-exercise history, personal records and weekly volume, from the sets you've checked off.
// Warm-up sets count toward volume but not toward records.

const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };
// Estimated one-rep max (Epley). Sets over 12 reps are left out because the estimate gets unreliable.
export const e1rm = (w, r) => (w > 0 && r > 0 && r <= 12 ? (r === 1 ? w : w * (1 + r / 30)) : 0);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

const pad = n => String(n).padStart(2, '0');
const isoD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const weekOf = s => { const d = parseD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoD(d); };

// One entry per exercise, with one session per workout it was done in (oldest first).
// `info(x)` gives { key, name, kind, muscle } for an exercise inside a workout.
export function history(events, info) {
  const map = new Map();
  for (const e of events) {
    if (e.format !== 'workout' || !Array.isArray(e.data?.exercises) || typeof e.date !== 'string') continue;
    for (const x of e.data.exercises) {
      const done = (x.sets || []).filter(s => s.done);
      if (!done.length) continue;
      const inf = info(x);
      let h = map.get(inf.key);
      if (!h) map.set(inf.key, h = { key: inf.key, name: inf.name, kind: inf.kind, muscle: inf.muscle, sessions: [] });
      const s = { date: e.date, start: e.start || '', eventId: e.id, sets: done.length, volume: 0, top: 0, topReps: 0, best1rm: 0, maxReps: 0, distance: 0 };
      for (const set of done) {
        const a = num(set.a), b = num(set.b), warm = set.t === 'w';
        if (inf.kind === 'weight') {
          s.volume += a * b;
          if (warm) continue;
          if (a > s.top || (a === s.top && b > s.topReps)) { s.top = a; s.topReps = b; }
          s.best1rm = Math.max(s.best1rm, e1rm(a, b));
          s.maxReps = Math.max(s.maxReps, b);
        } else if (inf.kind === 'reps') { if (!warm) s.maxReps = Math.max(s.maxReps, b); s.volume += b; }
        else if (inf.kind === 'cardio') { if (!warm) s.distance = Math.max(s.distance, a); }
      }
      s.best1rm = round(s.best1rm);
      h.sessions.push(s);
    }
  }
  for (const h of map.values()) h.sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return [...map.values()];
}

// Best ever per measure, plus the moments each one was beaten (for "new record" highlights).
export function records(h) {
  const r = { top: null, best1rm: null, maxReps: null, volume: null, distance: null, broken: [] };
  const fields = h.kind === 'weight' ? ['top', 'best1rm', 'volume'] : h.kind === 'reps' ? ['maxReps', 'volume'] : h.kind === 'cardio' ? ['distance'] : [];
  for (const s of h.sessions) {
    for (const f of fields) {
      if (!(s[f] > 0)) continue;
      const prev = r[f];
      if (!prev || s[f] > prev.value || (f === 'top' && s[f] === prev.value && s.topReps > prev.reps)) {
        r[f] = { value: s[f], date: s.date, eventId: s.eventId, ...(f === 'top' ? { reps: s.topReps } : {}) };
        if (prev) r.broken.push({ field: f, date: s.date, value: s[f], before: prev.value, eventId: s.eventId, ...(f === 'top' ? { reps: s.topReps, beforeReps: prev.reps } : {}) });
      }
    }
  }
  return r;
}

// Weekly totals for the `weeks` weeks ending with the week of `today` (oldest first).
export function weekly(events, info, weeks, today) {
  const end = weekOf(today), list = [], idx = {};
  for (let i = weeks - 1; i >= 0; i--) { const d = parseD(end); d.setDate(d.getDate() - 7 * i); const k = isoD(d); idx[k] = list.length; list.push({ week: k, volume: 0, sets: 0, workouts: 0 }); }
  for (const e of events) {
    if (e.format !== 'workout' || !Array.isArray(e.data?.exercises) || typeof e.date !== 'string') continue;
    const i = idx[weekOf(e.date)]; if (i === undefined) continue;
    let any = false;
    for (const x of e.data.exercises) {
      const kind = info(x).kind;
      for (const s of x.sets || []) if (s.done) { any = true; list[i].sets++; if (kind === 'weight') list[i].volume += num(s.a) * num(s.b); }
    }
    if (any) list[i].workouts++;
  }
  for (const w of list) w.volume = Math.round(w.volume);
  return list;
}
