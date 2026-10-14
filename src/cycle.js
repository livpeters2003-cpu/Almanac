// Cycle tracking: working out period starts, predictions, phases and workout suggestions from the daily log.
// General guidance only, not medical advice.

const DAY = 864e5;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const isoD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addD = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return isoD(d); };
const diff = (a, b) => Math.round((parseD(b) - parseD(a)) / DAY);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

export const FLOW = { spotting: 'Spotting', light: 'Light', medium: 'Medium', heavy: 'Heavy' };
export const SYMPTOMS = ['Cramps', 'Bloating', 'Headache', 'Tender breasts', 'Back pain', 'Acne', 'Cravings', 'Nausea'];
export const MOODS = ['Happy', 'Calm', 'Irritable', 'Anxious', 'Sad'];
export const SLEEP = { poor: 'Poor', ok: 'Okay', good: 'Good' };

// Period runs from the log: days with flow (spotting doesn't start a period), allowing one missed day inside a run.
export function periodStarts(logs, settings = {}) {
  const days = Object.keys(logs).filter(d => logs[d]?.period && logs[d].period !== 'spotting').sort();
  const runs = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && diff(last.end, d) <= 2) last.end = d; else runs.push({ start: d, end: d });
  }
  if (settings.lastStart && !runs.some(r => Math.abs(diff(r.start, settings.lastStart)) <= 7)) {
    runs.push({ start: settings.lastStart, end: addD(settings.lastStart, (settings.periodLength || 5) - 1), assumed: true });
    runs.sort((a, b) => a.start.localeCompare(b.start));
  }
  return runs;
}

// Average cycle and period length from your own history, falling back to what you entered at setup, then 28 and 5.
export function stats(logs, settings = {}) {
  const runs = periodStarts(logs, settings);
  const gaps = [];
  for (let i = 1; i < runs.length; i++) { const g = diff(runs[i - 1].start, runs[i].start); if (g >= 18 && g <= 50) gaps.push(g); }
  const recent = gaps.slice(-6);
  const cycleLength = recent.length ? Math.round(avg(recent)) : clamp(+settings.cycleLength || 28, 18, 50);
  const logged = runs.filter(r => !r.assumed).map(r => diff(r.start, r.end) + 1).slice(-6);
  const periodLength = logged.length ? clamp(Math.round(avg(logged)), 2, 10) : clamp(+settings.periodLength || 5, 2, 10);
  const spread = recent.length >= 2 ? Math.max(...recent) - Math.min(...recent) : null;
  return { runs, cycleLength, periodLength, cyclesLogged: gaps.length, regular: spread !== null ? spread <= 7 : null };
}

export const PHASES = {
  menstrual: { name: 'Period', blurb: 'Your period. Energy is often lower in the first few days.' },
  follicular: { name: 'Follicular phase', blurb: 'After your period. Energy and strength often climb.' },
  ovulation: { name: 'Around ovulation', blurb: 'Often when energy and strength peak.' },
  luteal: { name: 'Luteal phase', blurb: 'After ovulation. Energy is usually steady.' },
  late: { name: 'Late luteal phase', blurb: 'The days before your period. Energy may dip and symptoms can show up.' },
};
function phaseFor(day, cycleLength, periodLength) {
  const ov = cycleLength - 14;
  if (day <= periodLength) return 'menstrual';
  if (day < ov - 1) return 'follicular';
  if (day <= ov + 1) return 'ovulation';
  if (day > cycleLength - 5) return 'late';
  return 'luteal';
}
// Where a date sits in your cycle. `predicted` is true when it's past your latest logged start.
export function dayInfo(date, logs, settings = {}, st = stats(logs, settings)) {
  const runs = st.runs.filter(r => r.start <= date);
  if (!runs.length) return null;
  let start = runs[runs.length - 1].start, predicted = false;
  let day = diff(start, date) + 1;
  while (day > st.cycleLength) { start = addD(start, st.cycleLength); day -= st.cycleLength; predicted = true; }
  if (day > 60) return null;
  const phase = phaseFor(day, st.cycleLength, st.periodLength);
  const loggedFlow = logs[date]?.period || '';
  return { day, phase, cycleStart: start, predicted, nextStart: addD(start, st.cycleLength), loggedFlow, predictedPeriod: !loggedFlow && phase === 'menstrual' && (predicted || date > (runs[runs.length - 1].end || start)) };
}
// Predicted period days within [from, to], from the latest start forward.
export function predictedPeriods(logs, settings, from, to, st = stats(logs, settings)) {
  const out = new Set(); if (!st.runs.length) return out;
  const last = st.runs[st.runs.length - 1];
  for (let s = addD(last.start, st.cycleLength), n = 0; s <= to && n < 30; s = addD(s, st.cycleLength), n++) {
    for (let i = 0; i < st.periodLength; i++) { const d = addD(s, i); if (d >= from && d <= to && !logs[d]?.period) out.add(d); }
  }
  return out;
}

// Your own pattern: average energy you've logged in each phase (needs a few check-ins).
export function energyByPhase(logs, settings, st = stats(logs, settings)) {
  const sums = {};
  for (const [d, v] of Object.entries(logs)) {
    if (!v?.energy) continue;
    const info = dayInfo(d, logs, settings, st); if (!info || info.predicted) continue;
    (sums[info.phase] || (sums[info.phase] = [])).push(+v.energy);
  }
  const out = {};
  for (const k in sums) if (sums[k].length >= 3) out[k] = Math.round(avg(sums[k]) * 10) / 10;
  return out;
}

const BASE = {
  menstrual: { title: 'Go lighter', text: 'Walking, yoga, mobility or easy lifting at about 60–70% of your usual weights with fewer sets. Rest if cramps are bad.' },
  follicular: { title: 'Build strength', text: 'A good time for heavier lifts, adding weight or reps, and interval cardio.' },
  ovulation: { title: 'Go for it', text: 'Strength often peaks: heavy compound lifts or a personal-record attempt. Warm up well.' },
  luteal: { title: 'Steady training', text: 'Moderate weights for 8–12 reps, steady cardio, and normal rest between sets.' },
  late: { title: 'Ease off a little', text: 'Moderate intensity, longer warm-ups and more rest between sets. Pilates or low-impact cardio fit well.' },
};
// A workout suggestion from the phase, today's check-in and what you've logged before.
export function suggestion(info, today = {}, pattern = {}) {
  if (!info) return null;
  const s = { ...BASE[info.phase], why: [] };
  const e = +today.energy || 0, sym = today.symptoms || [];
  if (e && e <= 2) { s.title = 'Take it easy today'; s.text = 'You logged low energy. Try mobility, a walk or a light full-body session, and stop early if you need to.'; s.why.push('your low-energy check-in'); }
  else if (e >= 4 && (info.phase === 'menstrual' || info.phase === 'late')) { s.title = 'Normal session is fine'; s.text = 'You logged good energy, so a regular workout is fine. Listen to your body and keep the warm-up long.'; s.why.push('your good-energy check-in'); }
  else if (!e && pattern[info.phase]) {
    if (pattern[info.phase] <= 2.5 && ['follicular', 'ovulation', 'luteal'].includes(info.phase)) { s.text += ' You’ve usually logged lower energy in this phase, so keep it moderate if you feel the same.'; s.why.push('your past check-ins'); }
    if (pattern[info.phase] >= 3.8 && ['menstrual', 'late'].includes(info.phase)) { s.text += ' You’ve usually felt good in this phase, so a normal session may suit you.'; s.why.push('your past check-ins'); }
  }
  if (sym.includes('Cramps') || sym.includes('Back pain')) { s.text += ' With cramps or back pain, gentle movement and stretching can help; skip heavy core and deadlifts.'; s.why.push('your symptoms'); }
  if (today.sleep === 'poor') { s.text += ' After a poor night’s sleep, skip max-effort lifts.'; s.why.push('your sleep'); }
  return s;
}
export { addD as addDays, diff as daysBetween };
