import './styles.css';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { holidaysFor, COUNTRIES } from './holidays.js';

/* ---------- constants ---------- */
const WD = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SWATCHES = ['#e8590c','#d6336c','#ae3ec9','#7048e8','#4263eb','#1c7ed6','#0c8599','#2f9e44','#74b816','#f08c00','#868e96','#8d5a3b'];
const MUSCLES = ['Chest','Back','Shoulders','Arms','Quads','Hamstrings','Glutes','Calves','Core','Cardio','Full body','Other'];
const EQUIP = ['Barbell','Dumbbell','Machine','Cable','Bodyweight','Kettlebell','Band','Other'];
const KINDS = { weight: 'Weight & reps', reps: 'Reps only', time: 'Time', cardio: 'Distance & time' };

const ICONS = {
  workout: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  birthday: '<path d="M4 21h16M5.5 21v-8h13v8M5.5 16.5c2 1.3 4.5 1.3 6.5 0s4.5-1.3 6.5 0M12 13V9.5M12 6.8c-1-1-.6-2.3 0-3.3.6 1 1 2.3 0 3.3z"/>',
  class: '<path d="M4 19.5V5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5 2.5 2.5 0 0 0 6.5 23H20M8 7.5h8M8 11h5"/>',
  trip: '<path d="M10.2 13.8 6 18l-2.5-.5L3 16l4.3-1.7M13.8 10.2 18 6c1-1 2.5-1.5 3-1 .5.5 0 2-1 3l-4.2 4.2 1.7 7.3-1.5 1.5-3.3-6.3-3.3 3.3.4 2.3-1.3 1.2-1.6-3.2-3.2-1.6 1.2-1.3 2.3.4 3.3-3.3L4.2 7.7l1.5-1.5z"/>',
  notes: '<path d="M6 3h9l4 4v14H6zM14.5 3v4.5H19M9 12h7M9 16h5"/>',
  custom: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM16.5 13.5v6M13.5 16.5h6"/>',
};
const isCustom = f => typeof f === 'string' && f.startsWith('c:');
const icon = f => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[f] || (isCustom(f) ? ICONS.custom : ICONS.notes)}</svg>`;
const BLOCKS = {
  field: { label: 'Text field', def: 'Field' }, notes: { label: 'Long notes', def: 'Notes' }, checklist: { label: 'Checklist', def: 'Checklist' },
  number: { label: 'Number', def: 'Number' }, date: { label: 'Date', def: 'Date' }, link: { label: 'Link', def: 'Link' },
  rating: { label: 'Star rating', def: 'Rating' }, heading: { label: 'Section heading', def: 'Section' },
};
const STYLES = { clean: { name: 'Clean', skin: '' }, notebook: { name: 'Notebook', skin: 'fmt-class' }, dark: { name: 'Dark', skin: 'fmt-workout' }, pastel: { name: 'Pastel', skin: 'fmt-birthday' } };

const FORMATS = {
  workout: { name: 'Workout', blurb: 'A gym-tracker page: exercises from your library, sets with weight and reps, last time’s numbers, and volume.' },
  birthday: { name: 'Birthday', blurb: 'A countdown, who’s turning what, gift ideas with prices, party plans and a card message.' },
  class: { name: 'Class', blurb: 'Notebook paper with course, room, instructor, assignments with due dates and lecture notes.' },
  trip: { name: 'Trip', blurb: 'A boarding pass with your route, booking code and seat, where you’re staying and a packing list.' },
  notes: { name: 'Notes', blurb: 'A clean page with a title and notes, for anything that doesn’t need a special layout.' },
};
const THUMBS = {
  workout: '<b>Bench Press (Barbell)</b><i></i><i class="ok"></i><i class="ok"></i><em>+ Add set</em>',
  birthday: '<b>12</b><small>days to go</small><span>Sam turns 30</span>',
  class: '<b>BIO 110</b><i></i><i></i><i></i>',
  trip: `<div><b>LAX</b><svg class="ic" viewBox="0 0 24 24">${ICONS.trip}</svg><b>JFK</b><span></span></div>`,
  notes: '<b>Notes</b><i></i><i></i><i></i><i></i>',
};

const STARTER = [
  ['Bench Press (Barbell)','Chest','Barbell'],['Incline Bench Press (Barbell)','Chest','Barbell'],['Bench Press (Dumbbell)','Chest','Dumbbell'],['Incline Press (Dumbbell)','Chest','Dumbbell'],['Chest Fly (Cable)','Chest','Cable'],['Push-up','Chest','Bodyweight','reps'],['Dips','Chest','Bodyweight','reps'],
  ['Deadlift (Barbell)','Back','Barbell'],['Pull-up','Back','Bodyweight','reps'],['Chin-up','Back','Bodyweight','reps'],['Lat Pulldown (Cable)','Back','Cable'],['Bent Over Row (Barbell)','Back','Barbell'],['Single Arm Row (Dumbbell)','Back','Dumbbell'],['Seated Row (Cable)','Back','Cable'],['Face Pull (Cable)','Back','Cable'],
  ['Overhead Press (Barbell)','Shoulders','Barbell'],['Shoulder Press (Dumbbell)','Shoulders','Dumbbell'],['Lateral Raise (Dumbbell)','Shoulders','Dumbbell'],['Rear Delt Fly (Dumbbell)','Shoulders','Dumbbell'],
  ['Bicep Curl (Barbell)','Arms','Barbell'],['Bicep Curl (Dumbbell)','Arms','Dumbbell'],['Hammer Curl (Dumbbell)','Arms','Dumbbell'],['Triceps Pushdown (Cable)','Arms','Cable'],['Skullcrusher (Barbell)','Arms','Barbell'],['Overhead Triceps Extension (Dumbbell)','Arms','Dumbbell'],
  ['Squat (Barbell)','Quads','Barbell'],['Front Squat (Barbell)','Quads','Barbell'],['Leg Press (Machine)','Quads','Machine'],['Bulgarian Split Squat (Dumbbell)','Quads','Dumbbell'],['Walking Lunge (Dumbbell)','Quads','Dumbbell'],['Leg Extension (Machine)','Quads','Machine'],
  ['Romanian Deadlift (Barbell)','Hamstrings','Barbell'],['Lying Leg Curl (Machine)','Hamstrings','Machine'],
  ['Hip Thrust (Barbell)','Glutes','Barbell'],['Glute Bridge','Glutes','Bodyweight','reps'],['Cable Kickback','Glutes','Cable'],
  ['Standing Calf Raise (Machine)','Calves','Machine'],['Seated Calf Raise (Machine)','Calves','Machine'],
  ['Plank','Core','Bodyweight','time'],['Hanging Leg Raise','Core','Bodyweight','reps'],['Cable Crunch','Core','Cable'],['Russian Twist','Core','Bodyweight','reps'],
  ['Running','Cardio','Other','cardio'],['Cycling','Cardio','Machine','cardio'],['Rowing (Machine)','Cardio','Machine','cardio'],['Jump Rope','Cardio','Other','time'],
  ['Kettlebell Swing','Full body','Kettlebell'],['Burpee','Full body','Bodyweight','reps'],
];

/* ---------- helpers ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); };
const fmtTime = t => { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const todayS = () => iso(new Date());
const byTime = (a, b) => (a.start || '99').localeCompare(b.start || '99');
const longDate = d => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const shortDate = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const clone = o => JSON.parse(JSON.stringify(o));
const okColor = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#868e96';
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);

const customOf = f => isCustom(f) ? (db.formats || []).find(x => 'c:' + x.id === f) || null : null;
const fmtName = f => FORMATS[f]?.name || customOf(f)?.name || (isCustom(f) ? 'Untitled format' : 'Notes');
const allFormats = () => [...Object.entries(FORMATS).map(([k, v]) => [k, v.name]), ...(db.formats || []).map(x => ['c:' + x.id, x.name || 'Untitled format'])];
const fmtOptions = v => allFormats().map(([k, n]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(n)}</option>`).join('');
const blockDefault = t => t === 'checklist' ? [] : t === 'rating' ? 0 : '';

function blankData(f) {
  const cf = customOf(f);
  if (cf) { const d = {}; for (const b of cf.blocks) if (b.type !== 'heading') d[b.id] = blockDefault(b.type); return d; }
  return clone({
    workout: { exercises: [], notes: '' },
    birthday: { person: '', turning: '', gifts: [], where: '', theme: '', message: '', notes: '' },
    class: { code: '', room: '', instructor: '', tasks: [], notes: '' },
    trip: { from: '', fromCity: '', to: '', toCity: '', ref: '', seat: '', stay: '', packing: [], notes: '' },
    notes: { notes: '' },
  }[f] || { notes: '' });
}
function resetDone(data) {
  for (const k in data) if (Array.isArray(data[k])) data[k].forEach(it => { if (it && typeof it === 'object') { it.done = false; (it.sets || []).forEach(s => (s.done = false)); } });
  return data;
}

/* ---------- storage ---------- */
// Each account keeps its own copy on the device, so the app opens instantly and works offline.
const GUEST = 'guest';
const keyFor = who => `almanac-db:${who}`;
const DEFAULT_PREFS = () => ({ theme: 'auto', holidays: { on: true, countries: ['US'] }, news: true });
function blankDb() { return { v: 3, unit: 'lb', calendars: [], events: [], saved: [], exercises: [], formats: [], prefs: DEFAULT_PREFS() }; }
function normalize(d) {
  if (!d || typeof d !== 'object') d = blankDb();
  for (const k of ['calendars', 'events', 'saved', 'exercises', 'formats']) if (!Array.isArray(d[k])) d[k] = [];
  if (d.unit !== 'kg') d.unit = 'lb';
  d.prefs = { ...DEFAULT_PREFS(), ...(d.prefs && typeof d.prefs === 'object' ? d.prefs : {}) };
  if (!d.prefs.holidays || typeof d.prefs.holidays !== 'object') d.prefs.holidays = DEFAULT_PREFS().holidays;
  if (!Array.isArray(d.prefs.holidays.countries)) d.prefs.holidays.countries = ['US'];
  for (const c of d.calendars) if (c.sharing !== 'friends') c.sharing = 'private';
  d.v = 3;
  return d;
}
function loadLocal(who) { try { return normalize(JSON.parse(localStorage.getItem(keyFor(who)))); } catch (e) { return normalize(null); } }
let owner = GUEST;
let db = loadLocal(GUEST);
const persistLocal = () => { try { localStorage.setItem(keyFor(owner), JSON.stringify(db)); } catch (e) {} };
const save = () => { persistLocal(); scheduleSync(); };
// Bring calendars, events, templates, exercises and formats from another copy into this one, skipping ids already here.
function mergeInto(target, src) {
  src = normalize(src);
  for (const k of ['calendars', 'events', 'saved', 'formats']) {
    const ids = new Set(target[k].map(x => x.id));
    target[k].push(...src[k].filter(x => x && x.id && !ids.has(x.id)));
  }
  const names = new Set(target.exercises.map(e => e.name));
  target.exercises.push(...src.exercises.filter(e => e && e.name && !names.has(e.name)));
  return target;
}
const hasData = d => d.calendars.length || d.events.length || d.saved.length || d.formats.length;

/* ---------- sync across devices (Supabase, private to the signed-in person) ---------- */
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
let user = null, guestMode = false, authReady = false;
let syncTimer = null, syncing = false, syncAgain = false, needRender = false, pullTimer = null, channel = null;
let synced = { settings: null, calendars: {}, events: {}, saved: {} };   // rows last known to be on the server, as JSON
let ready = false;
const TABLES = {
  calendars: {
    table: 'calendars',
    toRow: (c, i) => ({ id: c.id, user_id: user.id, body: { name: c.name || '', color: c.color, format: c.format, hidden: !!c.hidden }, sharing: c.sharing === 'friends' ? 'friends' : 'private', position: i }),
    fromRow: r => ({ id: r.id, ...r.body, sharing: r.sharing }),
    order: 'position',
  },
  events: {
    table: 'events',
    toRow: e => ({ id: e.id, user_id: user.id, cal_id: e.calId || '', date: e.date, body: e }),
    fromRow: r => r.body,
    order: 'date',
  },
  saved: {
    table: 'templates',
    toRow: s => ({ id: s.id, user_id: user.id, body: s }),
    fromRow: r => r.body,
    order: 'id',
  },
};
const settingsRow = () => ({ user_id: user.id, unit: db.unit, exercises: db.exercises, formats: db.formats, prefs: db.prefs });
function setStatus(s) {
  const el = document.getElementById('sync-status'); if (!el) return;
  el.dataset.s = s;
  el.textContent = { checking: 'Connecting…', local: 'This device only', saving: 'Saving…', synced: 'Synced', offline: 'Offline, will sync', error: 'Sync paused, retrying' }[s] || '';
  el.title = s === 'local' ? 'Sign in under Settings to sync between your phone and computer.' : s === 'synced' ? 'Saved to your Almanac account and available on your other devices.' : '';
}
function scheduleSync() { if (!user) return; clearTimeout(syncTimer); setStatus('saving'); syncTimer = setTimeout(flush, 700); }
async function flush() {
  if (!user || !ready) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try {
    const s = JSON.stringify(settingsRow());
    if (s !== synced.settings) { const { error } = await supa.from('planner_settings').upsert(JSON.parse(s)); if (error) throw error; synced.settings = s; }
    for (const key of Object.keys(TABLES)) {
      const T = TABLES[key], live = new Set(), changed = [];
      db[key].forEach((x, i) => { live.add(x.id); const j = JSON.stringify(T.toRow(x, i)); if (synced[key][x.id] !== j) changed.push(j); });
      for (let i = 0; i < changed.length; i += 400) {
        const rows = changed.slice(i, i + 400).map(j => JSON.parse(j));
        const { error } = await supa.from(T.table).upsert(rows, { onConflict: 'user_id,id' }); if (error) throw error;
        rows.forEach((r, n) => (synced[key][r.id] = changed[i + n]));
      }
      const gone = Object.keys(synced[key]).filter(id => !live.has(id));
      for (let i = 0; i < gone.length; i += 200) {
        const ids = gone.slice(i, i + 200);
        const { error } = await supa.from(T.table).delete().eq('user_id', user.id).in('id', ids); if (error) throw error;
        ids.forEach(id => delete synced[key][id]);
      }
    }
    setStatus('synced');
  } catch (e) { setStatus(navigator.onLine ? 'error' : 'offline'); clearTimeout(syncTimer); syncTimer = setTimeout(flush, 6000); }
  syncing = false;
  if (syncAgain) { syncAgain = false; flush(); }
}
function softRender() {
  const a = document.activeElement;
  if (modal || (a && a.matches('input, textarea, select'))) { needRender = true; return; }
  needRender = false; const y = scrollY; render(); scrollTo(0, y);
}
document.addEventListener('focusout', ev => { if (needRender && !ev.relatedTarget) setTimeout(softRender, 0); });
async function fetchAll(T) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa.from(T.table).select('*').eq('user_id', user.id).order(T.order).order('id').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
// Pull everything from the server and merge it with this device's copy.
// Local edits that haven't reached the server yet win; items deleted on another device disappear here.
async function pull() {
  if (!user) return;
  const me = user.id;
  try {
    const [settingsRes, ...lists] = await Promise.all([
      supa.from('planner_settings').select('*').eq('user_id', me).maybeSingle(),
      ...Object.values(TABLES).map(fetchAll),
    ]);
    if (settingsRes.error) throw settingsRes.error;
    if (!user || user.id !== me) return;
    const first = !ready;
    const r = settingsRes.data;
    const pendingSettings = !first && synced.settings !== null && JSON.stringify(settingsRow()) !== synced.settings;
    if (r && !pendingSettings) {
      const remote = { user_id: me, unit: r.unit === 'kg' ? 'kg' : 'lb', exercises: r.exercises || [], formats: r.formats || [], prefs: { ...DEFAULT_PREFS(), ...(r.prefs || {}) } };
      if (first) {
        // first contact on this device: keep anything made here before syncing
        const names = new Set(remote.exercises.map(e => e.name)), fids = new Set(remote.formats.map(f => f.id));
        db.unit = remote.unit; if (r.prefs && Object.keys(r.prefs).length) db.prefs = remote.prefs;
        db.exercises = [...clone(remote.exercises), ...db.exercises.filter(e => !names.has(e.name))];
        db.formats = [...clone(remote.formats), ...db.formats.filter(f => !fids.has(f.id))];
        synced.settings = JSON.stringify(remote);
      } else {
        synced.settings = JSON.stringify(remote);
        db.unit = remote.unit; db.exercises = clone(remote.exercises); db.formats = clone(remote.formats); db.prefs = clone(remote.prefs);
      }
      db = normalize(db);
    }
    Object.keys(TABLES).forEach((key, n) => {
      const T = TABLES[key], rows = lists[n];
      const remote = {}; rows.forEach((row, i) => { remote[row.id] = { item: T.fromRow(row), json: JSON.stringify(T.toRow(T.fromRow(row), key === 'calendars' ? i : 0)) }; });
      const local = Object.fromEntries(db[key].map(e => [e.id, e]));
      const out = [];
      for (const id in remote) {
        const l = local[id], pending = l && synced[key][id] !== undefined && JSON.stringify(T.toRow(l, db[key].indexOf(l))) !== synced[key][id];
        if (pending) out.push(l); else { out.push(clone(remote[id].item)); synced[key][id] = remote[id].json; }
      }
      for (const id in local) if (!(id in remote)) {
        if (synced[key][id] === undefined) out.push(local[id]);   // new here, not uploaded yet
        else delete synced[key][id];                              // deleted on another device
      }
      if (key === 'events') out.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      db[key] = out;
    });
    ready = true; persistLocal(); applyTheme(); flush();
    if (!syncTimer && !syncing) setStatus('synced');
    softRender();
  } catch (e) {
    setStatus(navigator.onLine ? 'error' : 'offline');
    clearTimeout(pullTimer); pullTimer = setTimeout(pull, 8000);
  }
}
const pullSoon = () => { clearTimeout(pullTimer); pullTimer = setTimeout(pull, 400); };
function listen() {
  if (channel) supa.removeChannel(channel);
  channel = supa.channel('almanac-' + user.id);
  for (const table of ['planner_settings', 'calendars', 'events', 'templates']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { if (!syncing) pullSoon(); });
  channel.subscribe();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (user) pullSoon(); loadNews(); } });
window.addEventListener('online', () => { if (user) { pullSoon(); flush(); } });

function startSession(u) {
  if (user && u && user.id === u.id) return;
  user = u; guestMode = false;
  try { localStorage.removeItem('almanac-guest'); } catch (e) {}
  owner = u.id;
  const mine = loadLocal(u.id), guest = loadLocal(GUEST);
  db = hasData(guest) ? mergeInto(mine, guest) : mine;
  if (hasData(guest)) { try { localStorage.removeItem(keyFor(GUEST)); } catch (e) {} }
  synced = { settings: null, calendars: {}, events: {}, saved: {} }; ready = false;
  persistLocal(); applyTheme(); setStatus('checking');
  if (view.mode === 'welcome') view = { mode: 'week', date: todayS() };
  render(); pull(); listen(); loadNews();
}
function endSession() {
  if (channel) { supa.removeChannel(channel); channel = null; }
  user = null; ready = false; owner = GUEST; db = loadLocal(GUEST);
  synced = { settings: null, calendars: {}, events: {}, saved: {} };
  news = {}; applyTheme();
}

/* ---------- state ---------- */
let view = { mode: 'week', date: todayS() };
let modal = null;
let preview = null;
let confirmDel = false, confirmCal = null, confirmSaved = null;
let libTab = 'formats', libQ = '', libMuscle = '';
let newCal = { color: SWATCHES[0], format: 'notes' };

const $ = id => document.getElementById(id);
const calOf = o => db.calendars.find(c => c.id === o.calId);
const visibleEvents = () => db.events.filter(e => { const c = calOf(e); return c && !c.hidden; });
/* ---------- repeating events ---------- */
// A repeating event is stored once with a `repeat` rule. Its later dates are drawn from the rule;
// opening one of them turns that day into its own event (so a workout's sets are tracked per day).
const REPEATS = { daily: 'Every day', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month', yearly: 'Every year' };
const isoDow = d => (d.getDay() + 6) % 7;   // Monday = 0
const occId = (id, s) => `${id}@${s}`;
function occurrences(e, from, to) {
  const r = e.repeat; if (!r || !REPEATS[r.freq] || !e.date) return [];
  const out = [], start = parse(e.date), end = r.until && r.until < to ? r.until : to, skip = new Set(r.skip || []);
  if (end < from) return out;
  const lo = from > e.date ? from : e.date;
  const push = d => { const s = iso(d); if (s > e.date && s >= from && s <= end && !skip.has(s)) out.push(s); };
  if (r.freq === 'daily') {
    for (let d = parse(lo); iso(d) <= end; d = addDays(d, 1)) push(d);
  } else if (r.freq === 'weekly' || r.freq === 'biweekly') {
    const step = r.freq === 'biweekly' ? 2 : 1, days = [...(Array.isArray(r.days) && r.days.length ? r.days : [isoDow(start)])].sort();
    const ws0 = startOfWeek(start);
    let ws = startOfWeek(parse(lo));
    const off = Math.round((ws - ws0) / (7 * 864e5)) % step;
    if (off) ws = addDays(ws, 7 * (step - off));
    for (; iso(ws) <= end; ws = addDays(ws, 7 * step)) for (const dd of days) push(addDays(ws, dd));
  } else if (r.freq === 'monthly') {
    const day = start.getDate(), l = parse(lo);
    for (let y = l.getFullYear(), mo = l.getMonth(), n = 0; n < 1200; n++, mo++) {
      const d = new Date(y, mo, day); if (iso(new Date(y, mo, 1)) > end) break;
      if (d.getDate() === day) push(d);
    }
  } else if (r.freq === 'yearly') {
    for (let y = parse(lo).getFullYear(); y <= parse(end).getFullYear(); y++) {
      const d = new Date(y, start.getMonth(), start.getDate());
      if (d.getMonth() === start.getMonth()) push(d);
    }
  }
  return out;
}
function repeatText(e) {
  const r = e.repeat; if (!r || !REPEATS[r.freq]) return '';
  let t = REPEATS[r.freq];
  if ((r.freq === 'weekly' || r.freq === 'biweekly') && Array.isArray(r.days) && r.days.length) t += ' on ' + [...r.days].sort().map(d => WD[d]).join(', ');
  return t + (r.until ? ` until ${shortDate(parse(r.until))}` : '');
}
// Turn one drawn date of a repeating event into a real event and return its id.
function materialize(occ) {
  const [mid, date] = String(occ).split('@'), m = db.events.find(e => e.id === mid);
  if (!m || !date) return null;
  const ev = { ...clone(m), id: uid(), date, seriesId: m.id, data: resetDone(clone(m.data)) };
  delete ev.repeat;
  m.repeat = { ...m.repeat, skip: [...new Set([...(m.repeat?.skip || []), date])] };
  db.events.push(ev); save();
  return ev.id;
}
const rangeAround = () => { const y = parse(view.date).getFullYear(); return [iso(new Date(y, 0, -6)), iso(new Date(y, 11, 38))]; };
function byDate() {
  const [from, to] = rangeAround(), m = {}, add = (s, e) => (m[s] || (m[s] = [])).push(e);
  for (const e of visibleEvents()) {
    if (!(e.repeat?.skip || []).includes(e.date)) add(e.date, e);
    for (const s of occurrences(e, from, to)) add(s, { ...e, id: occId(e.id, s), date: s, _occ: e.id });
  }
  for (const k in m) m[k].sort(byTime);
  return m;
}

/* ---------- holidays ---------- */
const HOLIDAY_COLOR = '#f08c00';
const holidaysOn = () => db.prefs.holidays?.on !== false;
function holidayMap() {
  if (!holidaysOn()) return {};
  const y = parse(view.date).getFullYear(), countries = db.prefs.holidays.countries?.length ? db.prefs.holidays.countries : ['US'];
  const m = {}, multi = countries.length > 1;
  for (const yr of [y - 1, y, y + 1]) for (const h of holidaysFor(yr, countries, () => softRender())) (m[h.date] || (m[h.date] = [])).push(multi ? { ...h, name: `${h.name} · ${h.country}` } : h);
  return m;
}
const holChip = h => `<span class="hol" style="--c:${HOLIDAY_COLOR}" title="${esc(h.name)}">${esc(h.name)}</span>`;
function curObj() {
  if (view.mode !== 'doc') return null;
  if (view.kind === 'preview') return preview;
  return (view.kind === 'saved' ? db.saved : db.events).find(x => x.id === view.id);
}
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2400); }

/* ---------- workout helpers ---------- */
const exInfo = x => { const l = db.exercises.find(e => e.id === x.exId); return { name: l?.name || x.name || 'Exercise', kind: l?.kind || x.kind || 'weight', muscle: l?.muscle || x.muscle || '', equipment: l?.equipment || '' }; };
const cols = k => ({ weight: [db.unit.toUpperCase(), 'Reps'], reps: [null, 'Reps'], time: ['Time', null], cardio: ['Distance', 'Time'] }[k] || [db.unit.toUpperCase(), 'Reps']);
function fmtSet(k, s) {
  if (k === 'weight') return `${s.a || 0} ${db.unit} × ${s.b || 0}`;
  if (k === 'reps') return `× ${s.b || 0}`;
  if (k === 'time') return s.a || '—';
  return [s.a, s.b].filter(Boolean).join(' · ') || '—';
}
function prevSets(x, o) {
  if (view.kind !== 'event') return null;
  let best = null;
  for (const e of db.events) {
    if (e.id === o.id || e.format !== 'workout' || e.date > o.date || (e.date === o.date && e.start >= o.start)) continue;
    const m = (e.data.exercises || []).find(y => (x.exId ? y.exId === x.exId : y.name === x.name) && y.sets.some(s => s.done));
    if (m && (!best || e.date > best.date)) best = { date: e.date, sets: m.sets.filter(s => s.done) };
  }
  return best && best.sets;
}
function wStats(o) {
  let tot = 0, done = 0, vol = 0;
  for (const x of o.data.exercises) { const k = exInfo(x).kind; for (const s of x.sets) { tot++; if (s.done) { done++; if (k === 'weight') vol += (parseFloat(s.a) || 0) * (parseFloat(s.b) || 0); } } }
  return { tot, done, vol: `${Math.round(vol).toLocaleString()} ${db.unit}` };
}
function duration(o) {
  if (!o.start || !o.end) return '—';
  let m = (+o.end.slice(0, 2) * 60 + +o.end.slice(3)) - (+o.start.slice(0, 2) * 60 + +o.start.slice(3));
  if (m <= 0) return '—';
  return (m >= 60 ? Math.floor(m / 60) + 'h ' : '') + (m % 60 ? (m % 60) + 'min' : '').trim();
}

/* ---------- summaries ---------- */
function summary(e) {
  const d = e.data || {};
  switch (e.format) {
    case 'workout': { const s = wStats(e); const n = d.exercises.length; return n ? `${n} exercise${n > 1 ? 's' : ''} · ${s.tot} sets${s.done ? ` · ${s.done} done` : ''}` : ''; }
    case 'birthday': return [d.person && (d.person + (d.turning ? ` turns ${d.turning}` : '')), d.gifts.length && `${d.gifts.length} gift idea${d.gifts.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
    case 'class': { const open = d.tasks.filter(t => !t.done).length; return [d.code, d.room, open && `${open} assignment${open > 1 ? 's' : ''} open`].filter(Boolean).join(' · '); }
    case 'trip': return [d.from && d.to && `${d.from.toUpperCase()} → ${d.to.toUpperCase()}`, d.stay].filter(Boolean).join(' · ');
    default: {
      const cf = customOf(e.format);
      if (cf) { for (const b of cf.blocks) { const v = d[b.id]; if (typeof v === 'string' && v.trim()) return v.split('\n')[0]; } return ''; }
      return (d.notes || '').split('\n')[0];
    }
  }
}

/* ---------- header ---------- */
function renderSub() {
  for (const m of ['year', 'week', 'day', 'library', 'calendars', 'settings']) $('m-' + m).setAttribute('aria-pressed', view.mode === m || (m === 'library' && view.mode === 'builder'));
  if (!['year', 'week', 'day'].includes(view.mode)) { $('sub').hidden = true; return; }
  $('sub').hidden = false;
  const d = parse(view.date);
  let title = '';
  if (view.mode === 'year') title = `<small>Year</small>${d.getFullYear()}`;
  if (view.mode === 'week') { const ws = startOfWeek(d), we = addDays(ws, 6); title = `<small>Week ${isoWeek(ws)}</small>${shortDate(ws)} – ${shortDate(we)}, ${we.getFullYear()}`; }
  if (view.mode === 'day') title = `<small>Week ${isoWeek(d)}</small>${longDate(d)}`;
  let h = `<h1>${title}</h1><div class="navs"><button class="btn icon" data-act="nav" data-dir="-1" aria-label="Previous">‹</button><button class="btn" data-act="today">Today</button><button class="btn icon" data-act="nav" data-dir="1" aria-label="Next">›</button></div>`;
  h += `<div class="legend" aria-label="Show calendars">` + db.calendars.map(c => `<button data-act="cal-toggle" data-id="${c.id}" aria-pressed="${!c.hidden}" style="--c:${okColor(c.color)}"><span class="dot"></span>${esc(c.name || 'Untitled')}</button>`).join('') + `<button data-act="hol-toggle" aria-pressed="${holidaysOn()}" style="--c:${HOLIDAY_COLOR}"><span class="dot"></span>Holidays</button></div>`;
  $('sub').innerHTML = h;
}
const onboarding = () => db.calendars.length ? '' : `<div class="banner"><div><h2>Make your first calendar</h2><p>Calendars hold your events, like Workouts, School or Family. You choose the name, the color and which Library format its events use.</p></div><button class="btn primary" data-act="mode" data-mode="calendars">Create a calendar</button></div>`;

/* ---------- year / week / day ---------- */
function renderYear() {
  const y = parse(view.date).getFullYear(), map = byDate(), hol = holidayMap(), t = todayS(), now = new Date();
  let h = onboarding() + '<div class="year">';
  for (let mo = 0; mo < 12; mo++) {
    const first = new Date(y, mo, 1), last = new Date(y, mo + 1, 0);
    let count = 0;
    for (let i = 1; i <= last.getDate(); i++) count += (map[iso(new Date(y, mo, i))] || []).length;
    h += `<section class="month${now.getFullYear() === y && now.getMonth() === mo ? ' current' : ''}"><h3>${MONTHS[mo]}<span>${count ? count + ' event' + (count > 1 ? 's' : '') : ''}</span></h3><div class="mgrid"><span class="h">Wk</span>` + WD.map(w => `<span class="h">${w[0]}</span>`).join('');
    for (let ws = startOfWeek(first); ws <= last; ws = addDays(ws, 7)) {
      const wn = isoWeek(ws);
      h += `<button class="wk" data-act="week" data-date="${iso(ws)}" title="Open week ${wn}">${wn}</button>`;
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i), s = iso(d);
        if (d.getMonth() !== mo) { h += '<span class="d out"></span>'; continue; }
        const evs = map[s] || [], hs = hol[s] || [];
        const dots = (hs.length ? `<i style="--c:${HOLIDAY_COLOR}"></i>` : '') + evs.slice(0, hs.length ? 2 : 3).map(e => `<i style="--c:${okColor(calOf(e).color)}"></i>`).join('');
        const label = longDate(d) + (hs.length ? `, ${hs.map(x => x.name).join(', ')}` : '') + (evs.length ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}` : '');
        h += `<button class="d${s === t ? ' today' : ''}${i > 4 ? ' wkend' : ''}${hs.length ? ' hday' : ''}" data-act="day" data-date="${s}" title="${esc(hs.map(x => x.name).join(', '))}" aria-label="${esc(label)}">${d.getDate()}<span class="dots">${dots}</span></button>`;
      }
    }
    h += '</div></section>';
  }
  return h + '</div>';
}
const REP_IC = '<svg class="ic rep" viewBox="0 0 24 24" aria-label="Repeats"><path d="M17 2.5 20.5 6 17 9.5M3.5 11V9.5A3.5 3.5 0 0 1 7 6h13.5M7 21.5 3.5 18 7 14.5M20.5 13v1.5A3.5 3.5 0 0 1 17 18H3.5"/></svg>';
const isRep = e => !!(e._occ || (e.repeat && REPEATS[e.repeat.freq]));
const chip = e => `<button class="chip" data-act="open" data-id="${e.id}" style="--c:${okColor(calOf(e).color)}"><span class="t">${icon(e.format)}${e.start ? fmtTime(e.start) : 'Any time'}${isRep(e) ? REP_IC : ''}</span><span class="n">${esc(e.title || 'Untitled')}</span></button>`;
function renderWeek() {
  const ws = startOfWeek(parse(view.date)), map = byDate(), hol = holidayMap(), t = todayS();
  let h = onboarding() + '<div class="week">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), s = iso(d);
    h += `<div class="wday${s === t ? ' today' : ''}"><button class="wday-h" data-act="day" data-date="${s}" aria-label="Open ${esc(longDate(d))}"><b>${d.getDate()}</b><span>${WD[i]}${d.getDate() === 1 || i === 0 ? ' · ' + MONTHS[d.getMonth()].slice(0, 3) : ''}</span></button><div class="wday-l">${(hol[s] || []).map(holChip).join('')}${(map[s] || []).map(chip).join('')}<button class="add-mini" data-act="new" data-date="${s}">+ Add</button></div></div>`;
  }
  return h + '</div>';
}
function renderDay() {
  const s = view.date, evs = byDate()[s] || [], hs = holidayMap()[s] || [];
  let h = onboarding() + '<div class="day">';
  if (hs.length) h += `<div class="hol-day">${hs.map(holChip).join('')}</div>`;
  if (db.calendars.length) h += '<div class="quick">' + db.calendars.map(c => `<button class="btn" data-act="new" data-cal="${c.id}" data-date="${s}" style="--c:${okColor(c.color)}"><span class="dot"></span>+ ${esc(c.name || 'Untitled')}</button>`).join('') + '</div>';
  if (!evs.length) h += `<div class="empty">Nothing planned for this day.${db.calendars.length ? ' Add something with the buttons above.' : ''}</div>`;
  for (const e of evs) {
    const c = calOf(e), sm = summary(e);
    h += `<button class="card" data-act="open" data-id="${e.id}" style="--c:${okColor(c.color)}"><div class="time">${e.start ? `<b>${fmtTime(e.start)}</b>${e.end ? fmtTime(e.end) : ''}` : '<b>Any time</b>'}</div><div style="min-width:0"><h4>${esc(e.title || 'Untitled')}</h4>${sm ? `<p>${esc(sm)}</p>` : ''}${isRep(e) ? `<p class="rep-line">${REP_IC}${esc(repeatText(e._occ ? db.events.find(x => x.id === e._occ) || e : e))}</p>` : ''}</div><span class="tag">${icon(e.format)}${esc(c.name)}</span></button>`;
  }
  return h + renderNews(s) + '</div>';
}

/* ---------- daily news brief (written each morning into news_briefs) ---------- */
let news = {}, newsLoading = false, newsCheckedAt = 0;
const safeUrl = u => /^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? u : null;
const newsOn = () => !!user && db.prefs.news !== false;
// Loads the newest briefs every time the app opens or comes back to the front.
async function loadNews(force) {
  if (!newsOn() || newsLoading) return;
  newsLoading = true; if (force && view.mode === 'day') softRender();
  try {
    const { data, error } = await supa.from('news_briefs').select('date, items, generated_at').order('date', { ascending: false }).limit(60);
    if (!error) { const m = {}; for (const v of data || []) if (v && typeof v.date === 'string') m[v.date] = v; news = m; newsCheckedAt = Date.now(); }
  } catch (e) {}
  newsLoading = false;
  if (view.mode === 'day') softRender();
}
function renderNews(s) {
  if (!newsOn()) return '';
  const n = news[s], t = todayS();
  const when = n?.generated_at ? `Written ${esc(new Date(n.generated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}` : '';
  const head = `<header><div><span class="eyebrow">Daily news brief</span><h3>${s === t ? 'Today’s news' : 'News for ' + shortDate(parse(s))}</h3></div><div class="news-act"><span class="muted">${newsLoading ? 'Checking for news…' : when}</span><button class="btn" data-act="news-refresh"${newsLoading ? ' disabled' : ''}>Refresh</button></div></header>`;
  if (!n || !Array.isArray(n.items) || !n.items.length) {
    const msg = s > t ? 'This day’s brief will be written that morning.' : s === t ? 'Today’s brief hasn’t arrived yet. It’s written each morning; tap Refresh to check again.' : 'No brief was saved for this day.';
    return `<section class="news">${head}<p class="muted" style="margin:0">${msg}</p></section>`;
  }
  return `<section class="news">${head}<div class="news-grid">` + n.items.map(it => `<article class="news-i"><span class="topic">${esc(it.topic)}</span><h4>${esc(it.headline)}</h4><p>${esc(it.summary)}</p>${Array.isArray(it.sources) && it.sources.length ? `<div class="src">${it.sources.map(x => safeUrl(x.url) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.name || 'Source')}</a>` : `<span>${esc(x.name)}</span>`).join('')}</div>` : ''}</article>`).join('') + `</div><p class="muted news-foot">Facts only, attributed to their sources. Written automatically by Claude from news reports, so check the linked articles for full context.</p></section>`;
}

/* ---------- library ---------- */
function renderLibrary() {
  let h = `<div class="page"><h1>Library</h1><p class="lede">Formats are the page designs your events can use. Pick one when you make a calendar or an event. Save any event as a template to reuse it.</p>
  <div class="tabs"><div class="seg" role="group" aria-label="Library section">
    <button data-act="lib-tab" data-tab="formats" aria-pressed="${libTab === 'formats'}">Formats</button>
    <button data-act="lib-tab" data-tab="saved" aria-pressed="${libTab === 'saved'}">My templates (${db.saved.length})</button>
    <button data-act="lib-tab" data-tab="exercises" aria-pressed="${libTab === 'exercises'}">Exercises (${db.exercises.length})</button>
  </div></div>`;
  if (libTab === 'formats') {
    h += '<div class="gallery">';
    h += `<article class="fcard"><button class="th th-create" data-act="bf-new" aria-label="Create a format from blank"><span>+</span></button><div class="body"><h3>${icon('c:')}Create your own</h3><p>Start from a blank page and add the sections you want: fields, checklists, notes, numbers, dates, links and star ratings.</p><div class="row"><button class="btn primary" data-act="bf-new">Start from blank</button></div></div></article>`;
    h += db.formats.map(cf => `<article class="fcard"><button class="th th-custom" style="--c:${okColor(cf.color)}" data-act="bf-edit" data-id="${cf.id}" aria-label="Edit ${esc(cf.name || 'format')}"><b>${esc(cf.name || 'Untitled format')}</b>${cf.blocks.slice(0, 4).map(b => `<i>${esc(b.label || BLOCKS[b.type].def)}</i>`).join('')}</button><div class="body"><h3>${icon('c:')}${esc(cf.name || 'Untitled format')}</h3><p>Your format · ${cf.blocks.length} section${cf.blocks.length === 1 ? '' : 's'} · ${STYLES[cf.style]?.name || 'Clean'} style</p><div class="row"><button class="btn" data-act="bf-edit" data-id="${cf.id}">Edit</button><button class="btn primary" data-act="new" data-fmt="c:${cf.id}">Use for an event</button></div></div></article>`).join('');
    h += Object.entries(FORMATS).map(([k, f]) => `<article class="fcard"><button class="th th-${k}" data-act="preview" data-fmt="${k}" aria-label="Preview ${f.name}">${THUMBS[k]}</button><div class="body"><h3>${icon(k)}${f.name}</h3><p>${f.blurb}</p><div class="row"><button class="btn" data-act="preview" data-fmt="${k}">Preview</button><button class="btn primary" data-act="new" data-fmt="${k}">Use for an event</button></div></div></article>`).join('') + '</div>';
  }
  if (libTab === 'saved') {
    h += `<div class="panel m-row" style="align-items:end;margin-bottom:16px"><label class="field" style="flex:1 1 220px"><span>New template using format</span><select id="nt-fmt">${fmtOptions('workout')}</select></label><button class="btn primary" data-act="nt-create">Create template</button></div>`;
    if (!db.saved.length) h += `<div class="empty">No templates yet. Create one above, or open any event and choose <b>Save as template</b>. A workout you save here, like “Push day”, can then be added to any date with its exercises already filled in.</div>`;
    else h += '<div class="gallery">' + db.saved.map(s => {
      const sm = summary(s);
      return `<article class="fcard"><div class="body"><span class="eyebrow">${icon(s.format)} ${esc(fmtName(s.format))}</span><h3>${esc(s.title || 'Untitled')}</h3><p>${esc(sm) || '&nbsp;'}</p><div class="row">
        <button class="btn primary" data-act="new" data-saved="${s.id}">Add to calendar</button><button class="btn" data-act="open-saved" data-id="${s.id}">Edit</button>
        ${confirmSaved === s.id ? `<button class="btn danger solid" data-act="saved-del-confirm" data-id="${s.id}">Delete</button><button class="btn" data-act="saved-del-cancel">Keep</button>` : `<button class="btn danger" data-act="saved-del" data-id="${s.id}">Delete</button>`}
      </div></div></article>`;
    }).join('') + '</div>';
  }
  if (libTab === 'exercises') {
    h += `<p class="muted" style="margin:0 0 12px">These are the exercises you can pick from on Workout pages. ${db.exercises.length ? '' : 'Start with a common list or add your own.'}</p>`;
    h += `<div class="panel" style="margin-bottom:14px"><div class="m-row" style="align-items:end">
      <label class="field" style="flex:2 1 200px"><span>New exercise</span><input id="nx-name" placeholder="e.g. Cable Lateral Raise"></label>
      <label class="field" style="flex:1 1 120px"><span>Muscle</span><select id="nx-muscle">${MUSCLES.map(m => `<option>${m}</option>`).join('')}</select></label>
      <label class="field" style="flex:1 1 120px"><span>Equipment</span><select id="nx-equip">${EQUIP.map(m => `<option>${m}</option>`).join('')}</select></label>
      <label class="field" style="flex:1 1 140px"><span>Track</span><select id="nx-kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <button class="btn primary" data-act="nx-add">Add</button></div></div>`;
    if (!db.exercises.length) h += `<div class="empty"><p style="margin:0 0 12px">Your exercise library is empty.</p><button class="btn primary" data-act="ex-starter">Add ${STARTER.length} common exercises</button></div>`;
    else h += `<input class="search" id="lib-q" placeholder="Search exercises" value="${esc(libQ)}" aria-label="Search exercises"><div class="filters">${['', ...MUSCLES].map(m => `<button data-act="lib-muscle" data-m="${m}" aria-pressed="${libMuscle === m}">${m || 'All'}</button>`).join('')}</div><div id="ex-list">${exList()}</div>`;
  }
  return h + '</div>';
}
function exList() {
  const q = libQ.trim().toLowerCase();
  const rows = db.exercises.filter(e => (!libMuscle || e.muscle === libMuscle) && (!q || e.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
  if (!rows.length) return `<div class="empty">No exercises match.</div>`;
  const sel = (id, f, opts, v) => `<select data-xl="${id}" data-xf="${f}" aria-label="${f}">${opts.map(o => Array.isArray(o) ? `<option value="${o[0]}"${o[0] === v ? ' selected' : ''}>${o[1]}</option>` : `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
  return `<div class="ex-scroll"><div class="exlist"><div class="exrow head"><span>Exercise</span><span>Muscle</span><span>Equipment</span><span>Track</span><span></span></div>` + rows.map(e => `<div class="exrow"><input data-xl="${e.id}" data-xf="name" value="${esc(e.name)}" aria-label="Name">${sel(e.id, 'muscle', MUSCLES, e.muscle)}${sel(e.id, 'equipment', EQUIP, e.equipment)}${sel(e.id, 'kind', Object.entries(KINDS), e.kind)}<button class="x" data-act="ex-del" data-id="${e.id}" aria-label="Delete ${esc(e.name)}">×</button></div>`).join('') + '</div></div>';
}

/* ---------- calendars ---------- */
function renderCalendars() {
  const fmtOpts = fmtOptions;
  let h = `<div class="page"><h1>Calendars</h1><p class="lede">Each calendar has its own color and a default format from the Library. New events in that calendar open in that format, and you can switch any single event to another one.</p><div class="stack">`;
  for (const c of db.calendars) {
    const n = db.events.filter(e => e.calId === c.id).length;
    h += `<div class="panel calrow" style="--c:${okColor(c.color)}"><div class="fields">
      <label class="field" style="flex:1 1 180px"><span>Name</span><input data-cal="${c.id}" data-cf="name" value="${esc(c.name)}" placeholder="Calendar name"></label>
      <label class="field" style="flex:1 1 140px"><span>Default format</span><select data-cal="${c.id}" data-cf="format">${fmtOpts(c.format)}</select></label>
      <div class="field"><span>Color</span><div class="swatches">${SWATCHES.map(s => `<button class="sw" style="--c:${s}" data-act="cal-color" data-id="${c.id}" data-color="${s}" aria-pressed="${s === c.color}" aria-label="Color ${s}"></button>`).join('')}</div></div>
    </div><div class="grp" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="muted">${n} event${n === 1 ? '' : 's'}</span>
      ${confirmCal === c.id ? `<button class="btn" data-act="cal-del-cancel">Keep</button><button class="btn danger solid" data-act="cal-del-confirm" data-id="${c.id}">Delete calendar${n ? ` and ${n} event${n > 1 ? 's' : ''}` : ''}</button>` : `<button class="btn danger" data-act="cal-del" data-id="${c.id}">Delete</button>`}
    </div></div>`;
  }
  h += `<div class="panel" style="--c:${newCal.color}"><h2 class="sec" style="margin-top:0">New calendar</h2><div class="stack">
    <div class="m-row" style="align-items:end"><label class="field" style="flex:1 1 220px"><span>Name</span><input id="nc-name" placeholder="e.g. Workouts, School, Family"></label>
    <label class="field" style="flex:1 1 160px"><span>Default format</span><select id="nc-format"><option value="__blank"${newCal.format === '__blank' ? ' selected' : ''}>Blank – design my own</option>${fmtOpts(newCal.format)}</select></label></div>
    <div class="field"><span>Color</span><div class="swatches">${SWATCHES.map(s => `<button class="sw" style="--c:${s}" data-act="nc-color" data-color="${s}" aria-pressed="${s === newCal.color}" aria-label="Color ${s}"></button>`).join('')}</div></div>
    <div><button class="btn primary" data-act="nc-create">Create calendar</button></div></div></div>`;
  return h + '</div></div>';
}

/* ---------- event page ---------- */
function list(o, key, ph, extra = []) {
  return `<div class="list">` + o.data[key].map((it, i) => `<div class="li${it.done ? ' done' : ''}" id="li-${key}-${i}"><input type="checkbox" data-li="${key}.${i}" data-lf="done" ${it.done ? 'checked' : ''} aria-label="Done"><input type="text" class="li-t" id="li-${key}-${i}-t" data-li="${key}.${i}" data-lf="text" value="${esc(it.text)}" placeholder="${ph}">${extra.map(e => `<input type="${e.type || 'text'}" class="li-x" style="width:${e.w}" data-li="${key}.${i}" data-lf="${e.f}" value="${esc(it[e.f] || '')}" placeholder="${e.ph || ''}" aria-label="${e.label}">`).join('')}<button class="li-del" data-act="li-del" data-key="${key}" data-i="${i}" aria-label="Remove">×</button></div>`).join('') + `<button class="li-add" data-act="li-add" data-key="${key}">+ Add</button></div>`;
}
const dfield = (o, f, label, ph = '', extra = '') => `<label class="field"><span>${label}</span><input id="d-${f}" data-d="${f}" value="${esc(o.data[f])}" placeholder="${ph}" ${extra}></label>`;
const notesBlock = (o, label, ph) => `<h2>${label}</h2><textarea class="notes" id="d-notes" data-d="notes" placeholder="${ph}">${esc(o.data.notes)}</textarea>`;

function bodyWorkout(o) {
  const st = wStats(o), isT = view.kind === 'saved';
  let h = `<div class="w-stats"><div><span>Duration</span><b>${duration(o)}</b></div><div><span>Volume</span><b id="st-vol">${st.vol}</b></div><div><span>Sets</span><b id="st-sets">${isT ? st.tot : `${st.done}/${st.tot}`}</b></div></div>`;
  if (!o.data.exercises.length) h += `<div class="w-empty"><b>No exercises yet</b>Add exercises from your library to plan this workout.</div>`;
  o.data.exercises.forEach((x, ei) => {
    const inf = exInfo(x), [la, lb] = cols(inf.kind), prev = prevSets(x, o);
    const tmpl = ['44px', isT ? null : 'minmax(60px,1fr)', la ? (isT ? '1fr' : '74px') : null, lb ? (isT ? '1fr' : '64px') : null, isT ? null : '44px', '22px'].filter(Boolean).join(' ');
    let n = 0;
    h += `<section class="w-ex"><header><div><h3>${esc(inf.name)}</h3><span>${esc([inf.muscle, inf.equipment].filter(Boolean).join(' · '))}</span></div><button class="w-x" data-act="ex-remove" data-ei="${ei}">Remove</button></header>
      <input class="w-note" id="exn-${ei}" data-exnote="${ei}" value="${esc(x.note)}" placeholder="Add notes here…" aria-label="Exercise notes">
      <div class="w-tbl" style="--cols:${tmpl}"><div class="w-row h"><span style="text-align:center">Set</span>${isT ? '' : '<span style="text-align:center">Previous</span>'}${la ? `<span style="text-align:center">${la}</span>` : ''}${lb ? `<span style="text-align:center">${lb}</span>` : ''}${isT ? '' : '<span style="text-align:center">✓</span>'}<span></span></div>`;
    x.sets.forEach((s, si) => {
      const lab = s.t === 'n' ? ++n : s.t.toUpperCase(), p = prev?.[si];
      const inp = (f, lbl) => `<input id="s-${ei}-${si}-${f}" data-set="${ei}.${si}" data-sf="${f}" value="${esc(s[f])}" placeholder="${esc(p?.[f] || (isT ? '' : '–'))}" aria-label="${lbl}" ${(inf.kind === 'weight' || (inf.kind === 'reps' && f === 'b')) ? 'inputmode="decimal"' : ''}>`;
      h += `<div class="w-row${s.done ? ' done' : ''}" id="row-${ei}-${si}"><button class="w-set t-${s.t}" data-act="set-type" data-ei="${ei}" data-si="${si}" title="Tap to switch: normal, warm-up, drop set, failure">${lab}</button>${isT ? '' : `<span class="w-prev">${p ? esc(fmtSet(inf.kind, p)) : '–'}</span>`}${la ? inp('a', la) : ''}${lb ? inp('b', lb) : ''}${isT ? '' : `<input type="checkbox" data-set="${ei}.${si}" data-sf="done" ${s.done ? 'checked' : ''} aria-label="Set done">`}<button class="w-del" data-act="set-del" data-ei="${ei}" data-si="${si}" aria-label="Remove set">×</button></div>`;
    });
    h += `</div><button class="w-addset" data-act="set-add" data-ei="${ei}">+ Add set</button></section>`;
  });
  h += `<button class="w-add" data-act="pick-open">+ Add exercise</button>`;
  return h + notesBlock(o, 'Workout notes', 'Warm-up, how it felt, what to change next time…');
}
function countdown(o) {
  if (view.kind === 'saved' || !o.date) return `<div class="b-count">🎂<small>pick a date to start the countdown</small></div>`;
  const n = daysBetween(todayS(), o.date);
  if (n === 0) return `<div class="b-count">Today!<small>happy birthday</small></div>`;
  if (n === 1) return `<div class="b-count">1<small>day to go</small></div>`;
  if (n > 1) return `<div class="b-count">${n}<small>days to go</small></div>`;
  return `<div class="b-count">${-n}<small>day${n === -1 ? '' : 's'} ago</small></div>`;
}
const whoLine = d => d.person ? `${esc(d.person)}${d.turning ? ` turns ${esc(d.turning)}` : ''}` : 'Whose birthday is it?';
const giftTotal = d => { const t = d.gifts.reduce((s, g) => s + (parseFloat(String(g.price || '').replace(/[^0-9.]/g, '')) || 0), 0); return t ? `Total $${t.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''; };
function bodyBirthday(o) {
  const d = o.data;
  return `<div class="b-hero">${countdown(o)}<div class="b-who" id="b-who">${whoLine(d)}</div></div>
    <div class="grid2" style="margin-top:18px">${dfield(o, 'person', 'Birthday person', 'Name')}${dfield(o, 'turning', 'Turning', 'Age', 'inputmode="numeric"')}</div>
    <h2>Gift ideas <small id="gift-total">${giftTotal(d)}</small></h2>${list(o, 'gifts', 'Gift idea', [{ f: 'price', ph: '$0', w: '86px', label: 'Price' }])}
    <h2>Party plans</h2><div class="grid2">${dfield(o, 'where', 'Where', 'Restaurant, park, home…')}${dfield(o, 'theme', 'Theme or vibe', 'Picnic, karaoke, tacos…')}</div>
    <h2>Card message</h2><textarea class="b-card" id="d-message" data-d="message" placeholder="Write something sweet…">${esc(d.message)}</textarea>
    ${notesBlock(o, 'Notes', 'Who to invite, what to bring…')}`;
}
function bodyClass(o) {
  return `<div class="grid2" style="margin-top:14px">${dfield(o, 'code', 'Course code', 'BIO 110')}${dfield(o, 'room', 'Room', 'Building & room')}${dfield(o, 'instructor', 'Instructor', 'Name')}</div>
    <h2>Assignments</h2>${list(o, 'tasks', 'Reading, homework, exam…', [{ f: 'due', type: 'date', w: '150px', label: 'Due date' }])}
    <h2>Lecture notes</h2><textarea class="c-notes" id="d-notes" data-d="notes" placeholder="Today we covered…">${esc(o.data.notes)}</textarea>`;
}
function bodyTrip(o) {
  const d = o.data;
  const dateTxt = view.kind === 'saved' || !o.date ? '—' : parse(o.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }).toUpperCase();
  return `<div class="pass"><div class="pass-band"><span>Boarding pass</span><span>${esc(d.ref || '')}</span></div>
    <div class="pass-main"><div class="pass-route">
      <div class="end"><span>From</span><input class="code" id="d-from" data-d="from" value="${esc(d.from)}" placeholder="LAX" maxlength="4" aria-label="From code"><input class="city" id="d-fromCity" data-d="fromCity" value="${esc(d.fromCity)}" placeholder="City" aria-label="From city"></div>
      <div class="plane"><i></i><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS.trip}</svg><i></i></div>
      <div class="end"><span>To</span><input class="code" id="d-to" data-d="to" value="${esc(d.to)}" placeholder="JFK" maxlength="4" aria-label="To code"><input class="city" id="d-toCity" data-d="toCity" value="${esc(d.toCity)}" placeholder="City" aria-label="To city"></div>
    </div><div class="pass-meta">
      <div><span>Date</span><b>${dateTxt}</b></div><div><span>Departs</span><b>${o.start ? fmtTime(o.start).toUpperCase() : '—'}</b></div>
      <div><span>Booking</span><input id="d-ref" data-d="ref" value="${esc(d.ref)}" placeholder="ABC123"></div><div><span>Seat</span><input id="d-seat" data-d="seat" value="${esc(d.seat)}" placeholder="14A"></div>
    </div></div>
    <div class="pass-stub"><span>Staying at</span><textarea id="d-stay" data-d="stay" placeholder="Hotel or address">${esc(d.stay)}</textarea><div class="barcode"></div></div></div>
    <h2>Packing list</h2>${list(o, 'packing', 'Passport, charger, …')}
    ${notesBlock(o, 'Notes', 'Plans, reservations, places to try…')}`;
}
const bodyNotes = o => `<textarea class="notes" id="d-notes" data-d="notes" style="min-height:320px;margin-top:16px" placeholder="Write anything…">${esc(o.data.notes)}</textarea>`;
const BODIES = { workout: bodyWorkout, birthday: bodyBirthday, class: bodyClass, trip: bodyTrip, notes: bodyNotes };
function bodyFor(o) {
  if (BODIES[o.format]) return BODIES[o.format](o);
  const cf = customOf(o.format);
  if (cf) return bodyCustom(o, cf);
  if (o.data.notes === undefined) o.data.notes = '';
  return bodyNotes(o);
}
function bodyCustom(o, cf) {
  let h = '', group = [];
  const flushGroup = () => { if (group.length) { h += `<div class="grid2" style="margin-top:14px">${group.join('')}</div>`; group = []; } };
  for (const b of cf.blocks) {
    const lab = esc(b.label || BLOCKS[b.type].def), ph = esc(b.placeholder || '');
    if (b.type !== 'heading' && o.data[b.id] === undefined) o.data[b.id] = blockDefault(b.type);
    const v = o.data[b.id];
    switch (b.type) {
      case 'field': case 'number': case 'date': case 'link': {
        const type = b.type === 'date' ? 'date' : b.type === 'link' ? 'url' : 'text';
        group.push(`<label class="field"><span>${lab}</span><span class="inrow"><input type="${type}" id="d-${b.id}" data-d="${b.id}" value="${esc(v)}" placeholder="${ph}" ${b.type === 'number' ? 'inputmode="decimal"' : ''}>${b.type === 'link' && safeUrl(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}</span></label>`);
        break;
      }
      case 'heading': flushGroup(); h += `<h2>${lab}</h2>`; break;
      case 'rating': flushGroup(); h += `<h2>${lab}</h2><div class="stars">${[1, 2, 3, 4, 5].map(n => `<button data-act="rate" data-b="${b.id}" data-v="${n}" aria-label="${n} of 5" aria-pressed="${(+v || 0) >= n}">★</button>`).join('')}</div>`; break;
      case 'checklist': flushGroup(); h += `<h2>${lab}</h2>` + list(o, b.id, ph || 'Add an item'); break;
      case 'notes': flushGroup(); h += `<h2>${lab}</h2><textarea class="${cf.style === 'notebook' ? 'c-notes' : 'notes'}" id="d-${b.id}" data-d="${b.id}" placeholder="${ph || 'Write anything…'}">${esc(v)}</textarea>`; break;
    }
  }
  flushGroup();
  if (!cf.blocks.length) h += `<p style="color:var(--d-muted);margin-top:18px">This format has no sections yet. Add some in Library → Formats.</p>`;
  return h;
}
const docSkin = f => { const cf = customOf(f); return cf ? `custom ${STYLES[cf.style]?.skin || ''}` : `fmt-${FORMATS[f] ? f : 'notes'}`; };
const docAccent = f => { const cf = customOf(f); return cf ? `;--d-accent:${okColor(cf.color)}` : ''; };

/* ---------- format builder ---------- */
function newFormat(name, color) {
  const f = { id: uid(), name: name || '', style: 'clean', color: color || SWATCHES[4], blocks: [{ id: uid(), type: 'notes', label: 'Notes', placeholder: '' }] };
  db.formats.push(f); save(); return f;
}
function openBuilder(id, backMode) {
  leaveDoc(); modal = null; confirmFmt = false;
  view = { mode: 'builder', id, date: view.date, back: { mode: backMode || (view.mode === 'builder' ? view.back.mode : view.mode) } };
  render(); window.scrollTo(0, 0);
}
function builderPreview(cf) {
  const o = { id: 'bf-preview', format: 'c:' + cf.id, title: '', date: todayS(), start: '', end: '', data: blankData('c:' + cf.id) };
  return `<article class="doc ${docSkin(o.format)}" style="--c:${okColor(cf.color)}${docAccent(o.format)}"><input class="ttl" value="" placeholder="${esc(cf.name || 'Event title')}" aria-label="Title" tabindex="-1">${bodyCustom(o, cf)}</article>`;
}
let confirmFmt = false;
function renderBuilder() {
  const cf = db.formats.find(x => x.id === view.id);
  if (!cf) { view = { mode: 'library', date: view.date }; return renderLibrary(); }
  const used = db.events.filter(e => e.format === 'c:' + cf.id).length;
  const blocks = cf.blocks.map((b, i) => `<div class="blk"><span class="blk-t">${BLOCKS[b.type].label}</span><div class="blk-a"><button data-act="bf-up" data-i="${i}" aria-label="Move up"${i ? '' : ' disabled'}>↑</button><button data-act="bf-down" data-i="${i}" aria-label="Move down"${i < cf.blocks.length - 1 ? '' : ' disabled'}>↓</button><button data-act="bf-del" data-i="${i}" aria-label="Remove section">×</button></div>
      <input id="bb-${b.id}" data-bb="${i}" data-bbf="label" value="${esc(b.label)}" placeholder="Label" aria-label="Label">
      ${['field', 'notes', 'checklist', 'number', 'link'].includes(b.type) ? `<input id="bbp-${b.id}" data-bb="${i}" data-bbf="placeholder" value="${esc(b.placeholder || '')}" placeholder="Hint text (optional)" aria-label="Hint text">` : ''}</div>`).join('');
  return `<div class="page builder"><button class="back-plain" data-act="bf-back">‹ ${view.back.mode === 'calendars' ? 'Calendars' : 'Library'}</button>
    <span class="eyebrow">Format builder</span>
    <input class="bf-name" id="bf-name" data-bf="name" value="${esc(cf.name)}" placeholder="Name this format, e.g. Doctor visit" aria-label="Format name">
    <div class="bf-grid"><div class="bf-side">
      <div class="panel stack">
        <div class="field"><span>Style</span><div class="pick">${Object.entries(STYLES).map(([k, s]) => `<button data-act="bf-style" data-v="${k}" aria-pressed="${cf.style === k}">${s.name}</button>`).join('')}</div></div>
        <div class="field"><span>Accent color</span><div class="swatches">${SWATCHES.map(s => `<button class="sw" style="--c:${s}" data-act="bf-color" data-v="${s}" aria-pressed="${s === cf.color}" aria-label="Color ${s}"></button>`).join('')}</div></div>
      </div>
      <div class="panel"><h2 class="sec" style="margin-top:0">Sections</h2>
        <div class="blocks">${blocks || '<p class="muted" style="margin:0">No sections yet. Add some below.</p>'}</div>
        <span class="eyebrow" style="margin:16px 0 8px">Add a section</span>
        <div class="pick">${Object.entries(BLOCKS).map(([k, v]) => `<button data-act="bf-add" data-type="${k}">+ ${v.label}</button>`).join('')}</div>
      </div>
      <div class="m-row"><button class="btn primary" data-act="new" data-fmt="c:${cf.id}">Use for an event</button>
        ${confirmFmt ? `<button class="btn" data-act="bf-delete-cancel">Keep</button><button class="btn danger solid" data-act="bf-delete-confirm">Delete format${used ? ` (${used} event${used > 1 ? 's' : ''} switch to Notes)` : ''}</button>` : `<button class="btn danger" data-act="bf-delete">Delete format</button>`}</div>
      <p class="muted" style="margin:0">Changes save automatically. Events already using this format update to match.</p>
    </div>
    <div class="bf-prev-wrap"><span class="eyebrow" style="margin-bottom:8px">Live preview</span><div id="bf-prev" inert>${builderPreview(cf)}</div></div></div></div>`;
}

function renderDoc() {
  const o = curObj();
  if (!o) { view = { mode: 'week', date: view.date }; return renderWeek(); }
  const k = view.kind, cal = k === 'event' ? calOf(o) : null, f = o.format;
  const backLabel = k === 'event' ? { year: 'Year', week: 'Week', day: 'Day', library: 'Library', calendars: 'Calendars' }[view.back.mode] : 'Library';
  const tag = [esc(fmtName(f)), cal && esc(cal.name), k === 'saved' && 'Template', k === 'preview' && 'Preview'].filter(Boolean).join(' · ');
  let h = `<article class="doc ${docSkin(f)}" style="--c:${okColor(cal?.color || '#4263eb')}${docAccent(f)}">
    <div class="doc-top"><button class="back" data-act="back">‹ ${backLabel}</button><span class="eyebrow">${icon(f)}${tag}</span></div>
    <input class="ttl" id="f-title" data-f="title" value="${esc(o.title)}" placeholder="${{ workout: 'Workout name', birthday: 'Whose birthday?', class: 'Class name', trip: 'Trip name' }[f] || 'Title'}" aria-label="Title">
    <div class="meta">
      ${k === 'event' ? `<label class="field"><span>Calendar</span><select id="f-calId" data-f="calId">${db.calendars.map(c => `<option value="${c.id}"${c.id === o.calId ? ' selected' : ''}>${esc(c.name || 'Untitled')}</option>`).join('')}</select></label>` : ''}
      ${k !== 'preview' ? `<label class="field"><span>Format</span><select id="f-format" data-f="format">${fmtOptions(f)}</select></label>` : ''}
      ${k !== 'saved' ? `<label class="field"><span>Date</span><input type="date" id="f-date" data-f="date" value="${o.date}"></label>` : ''}
      <label class="field"><span>Start</span><input type="time" id="f-start" data-f="start" value="${o.start}"></label>
      <label class="field"><span>End</span><input type="time" id="f-end" data-f="end" value="${o.end}"></label>
      ${k === 'event' && !o.seriesId ? `<label class="field"><span>Repeats</span><select id="f-rep" data-rep="freq"><option value="">Doesn’t repeat</option>${Object.entries(REPEATS).map(([v, n]) => `<option value="${v}"${o.repeat?.freq === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      ${o.repeat ? `<label class="field"><span>Until</span><input type="date" id="f-until" data-rep="until" value="${esc(o.repeat.until || '')}" min="${o.date}"></label>` : ''}` : ''}
    </div>
    ${k === 'event' && (o.repeat?.freq === 'weekly' || o.repeat?.freq === 'biweekly') ? `<div class="repdays" role="group" aria-label="Repeat on">${WD.map((w, i) => `<button data-act="rep-day" data-d="${i}" aria-pressed="${(o.repeat.days?.length ? o.repeat.days : [isoDow(parse(o.date))]).includes(i)}">${w}</button>`).join('')}</div>` : ''}
    ${k === 'event' && o.seriesId ? `<p class="rep-note">${REP_IC}One day of a repeating event. Changes here only affect this day.${db.events.some(x => x.id === o.seriesId) ? ` <button class="linkish" data-act="open" data-id="${o.seriesId}">Edit the whole series</button>` : ''}</p>` : ''}
    ${k === 'event' && o.repeat ? `<p class="rep-note">${REP_IC}${esc(repeatText(o))}. Edits here apply to the days you haven’t opened yet.</p>` : ''}`;
  h += bodyFor(o);
  h += '<div class="tools">';
  if (k === 'event') h += `<div class="grp"><button class="btn" data-act="save-tpl">Save as template</button></div>
      <div class="grp"><label class="field"><span>Copy to a date</span><input type="date" id="dup-date" value="${iso(addDays(parse(o.date), 1))}"></label><button class="btn" data-act="dup">Copy</button></div>`;
  if (k === 'saved') h += `<div class="grp"><button class="btn primary" data-act="new" data-saved="${o.id}">Add to calendar</button></div>`;
  if (k === 'preview') h += `<div class="grp"><span style="color:var(--d-muted);font-size:14px">This is a sample. Changes here aren't saved.</span></div><div class="grp"><button class="btn primary" data-act="new" data-fmt="${f}">Use for an event</button></div>`;
  else if (confirmDel && k === 'event' && o.repeat) h += `<div class="grp"><button class="btn" data-act="del-cancel">Keep</button><button class="btn danger" data-act="del-one">Delete only ${esc(shortDate(parse(o.date)))}</button><button class="btn danger solid" data-act="del-confirm">Delete it and all repeats</button></div>`;
  else h += `<div class="grp">${confirmDel ? `<button class="btn" data-act="del-cancel">Keep</button><button class="btn danger solid" data-act="del-confirm">Delete for good</button>` : `<button class="btn danger" data-act="del">Delete ${k === 'saved' ? 'template' : 'event'}</button>`}</div>`;
  return h + '</div></article>';
}

/* ---------- samples for previews ---------- */
function sample(f) {
  const date = iso(addDays(new Date(), 12));
  const set = (a, b, done, t = 'n') => ({ t, a, b, done });
  const D = {
    workout: { title: 'Push Day', start: '06:30', end: '07:35', data: { notes: 'Felt strong. Add 5 lb to bench next week.', exercises: [
      { exId: null, name: 'Bench Press (Barbell)', kind: 'weight', muscle: 'Chest', note: 'Pause on the chest', sets: [set('95', '10', true, 'w'), set('135', '8', true), set('135', '8', true), set('135', '7', false)] },
      { exId: null, name: 'Overhead Press (Barbell)', kind: 'weight', muscle: 'Shoulders', note: '', sets: [set('85', '8', true), set('85', '8', false), set('85', '', false)] },
      { exId: null, name: 'Dips', kind: 'reps', muscle: 'Chest', note: '', sets: [set('', '12', false), set('', '', false, 'f')] }] } },
    birthday: { title: 'Sam’s 30th', start: '19:00', end: '22:00', data: { person: 'Sam', turning: '30', where: 'Lupa Trattoria', theme: 'Long Italian dinner', message: 'Happy 30th! Here’s to another year of terrible puns and great adventures.', notes: 'Book a table for 8. Ask about a candle for dessert.',
      gifts: [{ text: 'Film camera', price: '$85', done: true }, { text: 'Pottery class for two', price: '$120', done: false }, { text: 'Fancy olive oil', price: '$28', done: false }] } },
    class: { title: 'Intro to Biology', start: '10:00', end: '11:15', data: { code: 'BIO 110', room: 'Science Hall 204', instructor: 'Dr. Okafor', notes: 'Cell membranes: phospholipid bilayer, selective permeability.\nOsmosis vs diffusion — know the difference for the quiz.',
      tasks: [{ text: 'Read chapter 4', due: iso(addDays(new Date(), 2)), done: true }, { text: 'Lab report 2', due: iso(addDays(new Date(), 5)), done: false }, { text: 'Midterm', due: iso(addDays(new Date(), 14)), done: false }] } },
    trip: { title: 'Weekend in New York', start: '07:15', end: '', data: { from: 'LAX', fromCity: 'Los Angeles', to: 'JFK', toCity: 'New York', ref: 'K7Q2LM', seat: '14A', stay: 'The Jane Hotel\n113 Jane St', notes: 'Saturday: Met in the morning, pizza in Brooklyn at night.',
      packing: [{ text: 'Passport / ID', done: true }, { text: 'Phone charger', done: false }, { text: 'Running shoes', done: false }] } },
    notes: { title: 'Ideas for October', start: '', end: '', data: { notes: 'Try a new hike every weekend.\nSign up for the 10K.\nCall grandma on Sundays.' } },
  }[f];
  return { id: 'preview', calId: null, format: f, date, ...D, data: { ...blankData(f), ...D.data } };
}

/* ---------- modal ---------- */
function renderModal() {
  const el = $('modal');
  if (!modal) { el.hidden = true; return; }
  el.hidden = false;
  $('sheet').innerHTML = modal.type === 'new' ? renderNew() : renderPicker();
}
function renderNew() {
  if (!db.calendars.length) return `<h2>Create a calendar first</h2><p>Every event lives on one of your calendars. Make one, like “Workouts” or “Family”, and pick its color and default format.</p><div class="m-actions"><button class="btn" data-act="m-close">Cancel</button><button class="btn primary" data-act="mode" data-mode="calendars">Create a calendar</button></div>`;
  const m = modal, saved = db.saved.filter(s => s.format === m.format);
  return `<h2>New event</h2>
    <div class="field"><span>Calendar</span><div class="pick">${db.calendars.map(c => `<button data-act="nm-cal" data-id="${c.id}" aria-pressed="${c.id === m.calId}" style="--c:${okColor(c.color)}"><span class="dot"></span>${esc(c.name || 'Untitled')}</button>`).join('')}</div></div>
    <div class="field"><span>Format</span><div class="pick">${allFormats().map(([k, n]) => `<button data-act="nm-fmt" data-fmt="${k}" aria-pressed="${k === m.format}">${icon(k)}${esc(n)}</button>`).join('')}</div></div>
    <div class="field"><span>Start from</span><div class="pick"><button data-act="nm-saved" data-id="" aria-pressed="${!m.savedId}">Blank page</button>${saved.map(s => `<button data-act="nm-saved" data-id="${s.id}" aria-pressed="${s.id === m.savedId}">${esc(s.title || 'Untitled')}</button>`).join('')}</div>${saved.length ? '' : `<small class="muted">Templates you save for ${esc(fmtName(m.format))} pages appear here.</small>`}</div>
    <div class="m-row"><label class="field" style="flex:1 1 160px"><span>Date</span><input type="date" id="nm-date" value="${m.date}"></label>
    <label class="field" style="flex:1 1 160px"><span>Repeats</span><select id="nm-rep"><option value="">Doesn’t repeat</option>${Object.entries(REPEATS).map(([v, n]) => `<option value="${v}"${v === m.rep ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    ${m.rep ? `<label class="field" style="flex:1 1 160px"><span>Until (optional)</span><input type="date" id="nm-until" value="${esc(m.until || '')}" min="${m.date}"></label>` : ''}</div>
    <div class="m-actions"><button class="btn" data-act="m-close">Cancel</button><button class="btn primary" data-act="nm-create">Create</button></div>`;
}
function renderPicker() {
  return `<h2>Add exercises</h2>
    ${db.exercises.length ? `<input class="search" id="pk-q" value="${esc(modal.q)}" placeholder="Search exercises" aria-label="Search exercises"><div class="filters" style="margin:0">${['', ...MUSCLES].map(m => `<button data-act="pk-muscle" data-m="${m}" aria-pressed="${modal.muscle === m}">${m || 'All'}</button>`).join('')}</div><div id="pk-list">${pickList()}</div>`
      : `<p>Your exercise library is empty. Start with a common list, or add your own under Library → Exercises.</p><div><button class="btn primary" data-act="ex-starter">Add ${STARTER.length} common exercises</button></div>`}
    <div class="m-actions"><button class="btn" data-act="m-close">Cancel</button><button class="btn primary" data-act="pk-add" ${modal.sel.length ? '' : 'disabled'}>Add ${modal.sel.length || ''} exercise${modal.sel.length === 1 ? '' : 's'}</button></div>`;
}
function pickList() {
  const q = modal.q.trim().toLowerCase();
  const rows = db.exercises.filter(e => (!modal.muscle || e.muscle === modal.muscle) && (!q || e.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
  let h = '<div class="plist">' + rows.map(e => { const on = modal.sel.includes(e.id); return `<button data-act="pk-toggle" data-id="${e.id}" aria-pressed="${on}"><span>${esc(e.name)}<small>${esc(e.muscle)} · ${esc(e.equipment)}</small></span><span class="tick">${on ? '✓' : ''}</span></button>`; }).join('');
  if (q && !db.exercises.some(e => e.name.toLowerCase() === q)) h += `<button data-act="pk-create"><span>Create “${esc(modal.q.trim())}”<small>Adds it to your library</small></span><span class="tick">+</span></button>`;
  if (!rows.length && !q) h += `<div class="empty" style="border:0">No exercises for this muscle yet.</div>`;
  return h + '</div>';
}

/* ---------- sign in ---------- */
let auth = { email: '', sent: false, busy: false, err: '' };
function authForm() {
  const err = auth.err ? `<p class="auth-err" role="alert">${esc(auth.err)}</p>` : '';
  if (!auth.sent) return `<form class="auth" data-form="send"><label class="field"><span>Email</span><input type="email" id="au-email" autocomplete="email" required value="${esc(auth.email)}" placeholder="you@example.com"></label><button class="btn primary"${auth.busy ? ' disabled' : ''}>${auth.busy ? 'Sending…' : 'Email me a sign-in link'}</button>${err}</form>`;
  return `<form class="auth" data-form="verify"><p>We sent an email to <b>${esc(auth.email)}</b>. Tap the link in it, or type the code from the email here. On an iPhone home-screen app, use the code.</p><label class="field"><span>Code</span><input id="au-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456"></label><div class="m-row"><button class="btn primary"${auth.busy ? ' disabled' : ''}>${auth.busy ? 'Checking…' : 'Sign in'}</button><button type="button" class="btn ghost" data-act="au-back">Use a different email</button></div>${err}</form>`;
}
async function sendLink(email) {
  auth = { ...auth, email, busy: true, err: '' }; render();
  const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
  auth.busy = false;
  if (error) auth.err = /rate|seconds/i.test(error.message) ? 'Too many emails sent just now. Wait a minute and try again.' : error.message;
  else auth.sent = true;
  render(); $('au-code')?.focus();
}
async function verifyCode(code) {
  auth = { ...auth, busy: true, err: '' }; render();
  const { error } = await supa.auth.verifyOtp({ email: auth.email, token: code.replace(/\s/g, ''), type: 'email' });
  auth.busy = false;
  if (error) { auth.err = 'That code didn’t work. Check it, or request a new email.'; render(); }
  else auth = { email: '', sent: false, busy: false, err: '' };
}
const BRAND = '<i><b style="background:#e8590c"></b><b style="background:#1c7ed6"></b><b style="background:#d6336c"></b><b style="background:#2f9e44"></b></i>';
function renderWelcome() {
  return `<div class="welcome"><div class="w-card">
    <div class="brand big">${BRAND}Almanac</div>
    <h1>Your year, in one place.</h1>
    <p class="lede">Plan your calendars, track workouts, and later share the calendars you choose with friends. Sign in with your email, no password needed, and it syncs between your phone and computer.</p>
    ${authForm()}
    <button class="linkish" data-act="guest">Try it on this device without an account</button>
  </div></div>`;
}

/* ---------- settings ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (view.mode === 'settings') softRender(); });
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function applyTheme() {
  const t = db.prefs?.theme, r = document.documentElement;
  if (t === 'light' || t === 'dark') r.dataset.theme = t; else delete r.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111319' : '#f3f4f7');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
const seg = (act, cur, opts) => `<div class="seg">${opts.map(([v, n]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${n}</button>`).join('')}</div>`;
const setRow = (title, sub, ctrl) => `<div class="set-row"><div><b>${title}</b>${sub ? `<div class="muted">${sub}</div>` : ''}</div>${ctrl}</div>`;
function renderSettings() {
  const p = db.prefs, cc = p.holidays.countries?.length ? p.holidays.countries : ['US'];
  let h = `<div class="page"><h1>Settings</h1><p class="lede">These follow your account to every device you sign in on.</p><div class="stack">`;
  h += `<section class="panel"><h2 class="sec" style="margin-top:0">Account</h2>${user
    ? setRow(esc(user.email || 'Signed in'), `Synced between your devices. Status: <span class="sync inline" data-s="${$('sync-status')?.dataset.s || ''}">${esc($('sync-status')?.textContent || '')}</span>`, '<button class="btn" data-act="signout">Sign out</button>')
    : `<p class="muted" style="margin:0 0 12px">You’re using Almanac on this device only. Sign in to sync with your phone and computer; what you’ve made here comes with you.</p>${authForm()}`}</section>`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">Appearance</h2>${setRow('Theme', 'Auto follows your phone or computer.', seg('theme', p.theme || 'auto', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]))}</section>`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">Holidays</h2>${setRow('Show holidays', 'A built-in calendar you can hide from the legend too.', seg('hol-on', holidaysOn() ? 'on' : 'off', [['on', 'Show'], ['off', 'Hide']]))}
    <div class="field"><span>Countries</span><div class="pick">${Object.entries(COUNTRIES).map(([c, n]) => `<button data-act="hol-cc" data-v="${c}" aria-pressed="${cc.includes(c)}">${esc(n)}</button>`).join('')}</div></div></section>`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">Daily news brief</h2>${setRow('Show the brief on the Day view', 'A few short, sourced stories written each morning. The newest one loads every time you open the app.', seg('news-on', p.news !== false ? 'on' : 'off', [['on', 'On'], ['off', 'Off']]))}</section>`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">Workouts</h2>${setRow('Weight unit', 'Used on Workout pages.', seg('unit', db.unit, [['lb', 'lb'], ['kg', 'kg']]))}</section>`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">Bring over your Year Planner</h2><p class="muted" style="margin:0">In the old Year Planner, choose <b>Export my data</b> to download a file, then choose it here. Calendars, events, templates, formats and exercises are added; nothing here is replaced.</p><label class="btn" style="align-self:flex-start">Choose file<input type="file" id="imp-file" accept="application/json,.json" hidden></label></section>`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">Put Almanac on your phone</h2>${standalone() ? '<p class="muted" style="margin:0">You’re using the installed app.</p>' : `${installEvt ? '<button class="btn primary" data-act="install" style="align-self:flex-start">Install Almanac</button>' : ''}<p class="muted" style="margin:0"><b>iPhone:</b> open this site in Safari, tap the Share button, then <b>Add to Home Screen</b>.<br><b>Android:</b> open the browser menu and tap <b>Install app</b> or <b>Add to Home screen</b>.</p>`}</section>`;
  return h + '</div></div>';
}
async function importFile(file) {
  try {
    const raw = JSON.parse(await file.text()), src = raw && raw.db ? raw.db : raw;
    if (!src || typeof src !== 'object' || !Array.isArray(src.events) || !Array.isArray(src.calendars)) throw new Error('shape');
    const before = db.events.length, beforeCals = db.calendars.length;
    src.events = src.events.filter(e => e && typeof e.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date || ''));
    mergeInto(db, src); db = normalize(db); save(); render();
    toast(`Brought over ${db.calendars.length - beforeCals} calendars and ${db.events.length - before} events`);
  } catch (e) { toast('That file isn’t a Year Planner export'); }
}

/* ---------- render / navigation ---------- */
function render() {
  renderSub();
  document.body.classList.toggle('welcoming', view.mode === 'welcome');
  $('main').innerHTML = ({ year: renderYear, week: renderWeek, day: renderDay, doc: renderDoc, library: renderLibrary, calendars: renderCalendars, builder: renderBuilder, settings: renderSettings, welcome: renderWelcome }[view.mode] || renderWeek)();
  renderModal();
  autosize();
}
function autosize() { document.querySelectorAll('.doc textarea.notes, .doc .c-notes').forEach(t => { t.style.height = 'auto'; t.style.height = Math.max(t.classList.contains('c-notes') ? 256 : 160, t.scrollHeight + 2) + 'px'; }); }
function isEmpty(o) {
  if (o.title.trim()) return false;
  const d = o.data;
  for (const k in d) { const v = d[k]; if (Array.isArray(v) ? v.length : String(v || '').trim()) return false; }
  return true;
}
function leaveDoc() {
  if (view.mode !== 'doc') return;
  if (view.kind === 'event') { const o = curObj(); if (o && isEmpty(o)) { db.events = db.events.filter(x => x !== o); save(); } }
  if (view.kind === 'saved') { const o = curObj(); if (o && isEmpty(o)) { db.saved = db.saved.filter(x => x !== o); save(); } }
  confirmDel = false;
}
function go(mode, date) { leaveDoc(); modal = null; view = { mode, date: date || view.date }; render(); window.scrollTo(0, 0); }
function openDoc(kind, id) {
  const back = view.mode === 'doc' ? view.back : { mode: view.mode };
  leaveDoc(); modal = null;
  const date = kind === 'event' ? db.events.find(e => e.id === id)?.date : view.date;
  view = { mode: 'doc', kind, id, date: date || view.date, back };
  render(); window.scrollTo(0, 0);
}
function openNew(o = {}) {
  const saved = o.savedId ? db.saved.find(s => s.id === o.savedId) : null;
  let cal = db.calendars.find(c => c.id === o.calId) || db.calendars.find(c => !c.hidden) || db.calendars[0];
  const format = saved?.format || o.format || cal?.format || 'notes';
  if (o.format && !o.calId) cal = db.calendars.find(c => c.format === o.format) || cal;
  const base = view.mode === 'doc' && view.kind === 'event' ? curObj()?.date : view.date;
  modal = { type: 'new', calId: cal?.id, format, savedId: saved?.id || '', date: o.date || base || todayS(), rep: '', until: '' };
  renderModal();
}
function createFromModal() {
  const m = modal, saved = db.saved.find(s => s.id === m.savedId && s.format === m.format);
  const base = saved ? clone(saved) : { title: '', start: '', end: '', data: blankData(m.format) };
  const first = { id: uid(), calId: m.calId, format: m.format, title: base.title, start: base.start || '', end: base.end || '', date: m.date, data: resetDone(clone(base.data)) };
  if (REPEATS[m.rep]) first.repeat = { freq: m.rep, days: [isoDow(parse(m.date))], until: m.until && m.until >= m.date ? m.until : '', skip: [] };
  db.events.push(first); save();
  modal = null; openDoc('event', first.id); if (!first.title) $('f-title')?.focus();
}

/* ---------- clicks ---------- */
$('modal').addEventListener('click', ev => { if (ev.target === $('modal')) { modal = null; renderModal(); } });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && modal) { modal = null; renderModal(); } });

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, o = curObj(), ds = t.dataset;
  switch (a) {
    case 'mode': go(ds.mode, view.date); break;
    case 'nav': { const d = parse(view.date), n = +ds.dir; if (view.mode === 'year') d.setFullYear(d.getFullYear() + n); if (view.mode === 'week') d.setDate(d.getDate() + 7 * n); if (view.mode === 'day') d.setDate(d.getDate() + n); go(view.mode, iso(d)); break; }
    case 'today': go(view.mode, todayS()); break;
    case 'day': go('day', ds.date); break;
    case 'week': go('week', ds.date); break;
    case 'open': { const id = ds.id.includes('@') ? materialize(ds.id) : ds.id; if (id) openDoc('event', id); break; }
    case 'open-saved': openDoc('saved', ds.id); break;
    case 'preview': preview = sample(ds.fmt); openDoc('preview', 'preview'); break;
    case 'back': go(view.kind === 'event' ? view.back.mode : 'library', o?.date || view.date); break;
    case 'new': openNew({ calId: ds.cal, date: ds.date, format: ds.fmt, savedId: ds.saved }); break;
    case 'cal-toggle': { const c = db.calendars.find(x => x.id === ds.id); c.hidden = !c.hidden; save(); render(); break; }
    case 'lib-tab': libTab = ds.tab; confirmSaved = null; render(); break;
    case 'lib-muscle': libMuscle = ds.m; render(); break;

    /* modal: new event */
    case 'm-close': modal = null; renderModal(); break;
    case 'nm-cal': { const c = db.calendars.find(x => x.id === ds.id); modal.calId = c.id; if (!modal.savedId) modal.format = c.format; renderModal(); break; }
    case 'nm-fmt': modal.format = ds.fmt; modal.savedId = ''; renderModal(); break;
    case 'nm-saved': modal.savedId = ds.id; renderModal(); break;
    case 'nm-create': createFromModal(); break;

    /* modal: exercise picker */
    case 'pick-open': modal = { type: 'picker', q: '', muscle: '', sel: [] }; renderModal(); $('pk-q')?.focus(); break;
    case 'pk-muscle': modal.muscle = ds.m; renderModal(); break;
    case 'pk-toggle': { const i = modal.sel.indexOf(ds.id); i < 0 ? modal.sel.push(ds.id) : modal.sel.splice(i, 1); renderModal(); break; }
    case 'pk-create': { const e = { id: uid(), name: modal.q.trim(), muscle: modal.muscle || 'Other', equipment: 'Other', kind: 'weight' }; db.exercises.push(e); modal.sel.push(e.id); modal.q = ''; save(); renderModal(); break; }
    case 'pk-add': {
      for (const id of modal.sel) {
        const e = db.exercises.find(x => x.id === id); if (!e) continue;
        const x = { exId: e.id, name: e.name, kind: e.kind, muscle: e.muscle, note: '', sets: [] };
        const n = Math.max(1, (view.kind === 'event' && prevSets(x, o)?.length) || 3);
        for (let i = 0; i < n; i++) x.sets.push({ t: 'n', a: '', b: '', done: false });
        o.data.exercises.push(x);
      }
      modal = null; save(); render(); break;
    }
    case 'ex-starter': {
      for (const [name, muscle, equipment, kind] of STARTER) if (!db.exercises.some(e => e.name === name)) db.exercises.push({ id: uid(), name, muscle, equipment, kind: kind || 'weight' });
      save(); render(); toast('Exercises added'); break;
    }

    /* workout page */
    case 'ex-remove': o.data.exercises.splice(+ds.ei, 1); save(); render(); break;
    case 'set-add': { const x = o.data.exercises[+ds.ei], last = x.sets[x.sets.length - 1]; x.sets.push({ t: 'n', a: last?.a || '', b: last?.b || '', done: false }); save(); render(); break; }
    case 'set-del': o.data.exercises[+ds.ei].sets.splice(+ds.si, 1); save(); render(); break;
    case 'set-type': { const s = o.data.exercises[+ds.ei].sets[+ds.si]; s.t = { n: 'w', w: 'd', d: 'f', f: 'n' }[s.t] || 'n'; save(); render(); break; }

    /* lists */
    case 'li-add': o.data[ds.key].push({ text: '', done: false }); save(); render(); $(`li-${ds.key}-${o.data[ds.key].length - 1}-t`)?.focus(); break;
    case 'li-del': o.data[ds.key].splice(+ds.i, 1); save(); render(); break;

    /* event tools */
    case 'save-tpl': { const c = clone(o); db.saved.push({ id: uid(), format: c.format, title: c.title, start: c.start, end: c.end, data: resetDone(c.data) }); save(); toast('Saved to Library → My templates'); break; }
    case 'rep-day': {
      const days = new Set(o.repeat.days?.length ? o.repeat.days : [isoDow(parse(o.date))]), d = +ds.d;
      days.has(d) ? days.size > 1 && days.delete(d) : days.add(d);
      o.repeat.days = [...days].sort(); save(); { const y = scrollY; render(); scrollTo(0, y); } break;
    }
    case 'dup': { const d = $('dup-date').value; if (!d) return; const c = { ...clone(o), id: uid(), date: d, data: resetDone(clone(o.data)) }; delete c.repeat; delete c.seriesId; db.events.push(c); save(); toast(`Copied to ${shortDate(parse(d))}`); break; }
    case 'del-one': { const back = view.back.mode; o.repeat.skip = [...new Set([...(o.repeat.skip || []), o.date])]; save(); confirmDel = false; view = { mode: back, date: o.date }; render(); toast('Removed from this day'); break; }
    case 'hol-toggle': db.prefs.holidays = { ...db.prefs.holidays, on: !holidaysOn() }; save(); render(); break;
    case 'news-refresh': loadNews(true); break;
    case 'del': confirmDel = true; render(); break;
    case 'del-cancel': confirmDel = false; render(); break;
    case 'del-confirm': {
      if (view.kind === 'saved') { db.saved = db.saved.filter(x => x !== o); save(); confirmDel = false; view = { mode: 'library', date: view.date }; libTab = 'saved'; render(); toast('Template deleted'); }
      else { const back = view.back.mode; db.events = db.events.filter(x => x !== o); save(); confirmDel = false; view = { mode: back, date: o.date }; render(); toast('Event deleted'); }
      break;
    }

    /* library: saved + exercises */
    case 'saved-del': confirmSaved = ds.id; render(); break;
    case 'saved-del-cancel': confirmSaved = null; render(); break;
    case 'saved-del-confirm': db.saved = db.saved.filter(x => x.id !== ds.id); confirmSaved = null; save(); render(); toast('Template deleted'); break;
    case 'nx-add': {
      const name = $('nx-name').value.trim(); if (!name) { $('nx-name').focus(); return; }
      db.exercises.push({ id: uid(), name, muscle: $('nx-muscle').value, equipment: $('nx-equip').value, kind: $('nx-kind').value });
      save(); render(); toast(`Added ${name}`); $('nx-name')?.focus(); break;
    }
    case 'ex-del': db.exercises = db.exercises.filter(x => x.id !== ds.id); save(); render(); break;

    /* calendars */
    case 'cal-color': { const c = db.calendars.find(x => x.id === ds.id); c.color = ds.color; save(); render(); break; }
    case 'cal-del': confirmCal = ds.id; render(); break;
    case 'cal-del-cancel': confirmCal = null; render(); break;
    case 'cal-del-confirm': db.calendars = db.calendars.filter(c => c.id !== ds.id); db.events = db.events.filter(e => e.calId !== ds.id); confirmCal = null; save(); render(); toast('Calendar deleted'); break;
    case 'nc-color': newCal.color = ds.color; newCal.format = $('nc-format').value; { const nm = $('nc-name').value; render(); $('nc-name').value = nm; } break;
    case 'nc-create': {
      const name = $('nc-name').value.trim(); if (!name) { $('nc-name').focus(); return; }
      const pickFmt = $('nc-format').value, color = newCal.color;
      const fmt = pickFmt === '__blank' ? newFormat(name, color) : null;
      db.calendars.push({ id: uid(), name, color, format: fmt ? 'c:' + fmt.id : pickFmt, hidden: false });
      newCal = { color: SWATCHES[(SWATCHES.indexOf(color) + 3) % SWATCHES.length], format: 'notes' };
      save();
      if (fmt) { openBuilder(fmt.id, 'calendars'); toast(`Created ${name}. Now design its page.`); $('bf-name')?.focus(); }
      else { render(); toast(`Created ${name}`); }
      break;
    }
    case 'unit': db.unit = ds.v; save(); render(); break;
    case 'theme': db.prefs.theme = ds.v; save(); applyTheme(); render(); break;
    case 'hol-on': db.prefs.holidays = { ...db.prefs.holidays, on: ds.v === 'on' }; save(); render(); break;
    case 'hol-cc': { const cc = new Set(db.prefs.holidays.countries?.length ? db.prefs.holidays.countries : ['US']); cc.has(ds.v) ? cc.size > 1 && cc.delete(ds.v) : cc.add(ds.v); db.prefs.holidays = { ...db.prefs.holidays, countries: [...cc] }; save(); render(); break; }
    case 'news-on': db.prefs.news = ds.v === 'on'; save(); render(); if (db.prefs.news) loadNews(); break;
    case 'guest': guestMode = true; try { localStorage.setItem('almanac-guest', '1'); } catch (e) {} setStatus('local'); go('week', todayS()); break;
    case 'au-back': auth = { email: auth.email, sent: false, busy: false, err: '' }; render(); break;
    case 'signout': supa.auth.signOut().finally(() => { endSession(); auth = { email: '', sent: false, busy: false, err: '' }; setStatus(''); go('welcome', todayS()); }); break;
    case 'install': installEvt?.prompt(); installEvt = null; break;

    /* format builder */
    case 'bf-new': { const f = newFormat('', SWATCHES[4]); openBuilder(f.id, 'library'); $('bf-name')?.focus(); break; }
    case 'bf-edit': openBuilder(ds.id, 'library'); break;
    case 'bf-back': go(view.back.mode === 'calendars' ? 'calendars' : 'library', view.date); break;
    case 'bf-style': case 'bf-color': case 'bf-add': case 'bf-up': case 'bf-down': case 'bf-del': {
      const cf = db.formats.find(x => x.id === view.id); if (!cf) return;
      const i = +ds.i;
      if (a === 'bf-style') cf.style = ds.v;
      if (a === 'bf-color') cf.color = ds.v;
      if (a === 'bf-add') cf.blocks.push({ id: uid(), type: ds.type, label: BLOCKS[ds.type].def, placeholder: '' });
      if (a === 'bf-up' && i > 0) [cf.blocks[i - 1], cf.blocks[i]] = [cf.blocks[i], cf.blocks[i - 1]];
      if (a === 'bf-down' && i < cf.blocks.length - 1) [cf.blocks[i + 1], cf.blocks[i]] = [cf.blocks[i], cf.blocks[i + 1]];
      if (a === 'bf-del') cf.blocks.splice(i, 1);
      save(); { const y = scrollY; render(); scrollTo(0, y); }
      if (a === 'bf-add') { const el = $('bb-' + cf.blocks[cf.blocks.length - 1].id); el?.focus(); el?.select(); }
      break;
    }
    case 'bf-delete': confirmFmt = true; render(); break;
    case 'bf-delete-cancel': confirmFmt = false; render(); break;
    case 'bf-delete-confirm': {
      const cf = db.formats.find(x => x.id === view.id), key = 'c:' + cf.id;
      // keep what people wrote: fold the text sections into Notes
      for (const e of [...db.events, ...db.saved]) if (e.format === key) {
        const parts = cf.blocks.filter(b => typeof e.data[b.id] === 'string' && e.data[b.id].trim()).map(b => `${b.label}: ${e.data[b.id]}`);
        e.format = 'notes'; e.data = { notes: parts.join('\n') };
      }
      for (const c of db.calendars) if (c.format === key) c.format = 'notes';
      db.formats = db.formats.filter(x => x !== cf); confirmFmt = false; save();
      libTab = 'formats'; go('library'); toast('Format deleted'); break;
    }
    case 'rate': { const cur = +o.data[ds.b] || 0, v = +ds.v; o.data[ds.b] = cur === v ? 0 : v; save(); { const y = scrollY; render(); scrollTo(0, y); } break; }
    case 'nt-create': {
      const f = $('nt-fmt').value, s = { id: uid(), format: f, title: '', start: '', end: '', data: blankData(f) };
      db.saved.push(s); save(); openDoc('saved', s.id); $('f-title')?.focus(); break;
    }
  }
});

/* ---------- typing ---------- */
document.addEventListener('input', ev => {
  const t = ev.target, ds = t.dataset;
  if (t.id === 'nm-date') { if (t.value) modal.date = t.value; return; }
  if (t.id === 'nm-rep') { modal.rep = t.value; renderModal(); return; }
  if (t.id === 'nm-until') { modal.until = t.value; return; }
  if (t.id === 'pk-q') { modal.q = t.value; $('pk-list').innerHTML = pickList(); return; }
  if (t.id === 'lib-q') { libQ = t.value; $('ex-list').innerHTML = exList(); return; }
  if (ds.xl) { const e = db.exercises.find(x => x.id === ds.xl); if (e) { e[ds.xf] = t.value; save(); } return; }
  if (ds.cal) { const c = db.calendars.find(x => x.id === ds.cal); if (c) { c[ds.cf] = t.value; save(); } return; }
  if (view.mode === 'builder' && (ds.bf || ds.bb !== undefined)) {
    const cf = db.formats.find(x => x.id === view.id); if (!cf) return;
    if (ds.bf) cf[ds.bf] = t.value; else cf.blocks[+ds.bb][ds.bbf] = t.value;
    save(); $('bf-prev').innerHTML = builderPreview(cf);
    return;
  }

  const o = curObj(); if (!o) return;
  if (ds.rep) {
    if (ds.rep === 'freq') {
      if (!t.value) delete o.repeat;
      else o.repeat = { skip: [], until: '', ...(o.repeat || {}), freq: t.value, days: o.repeat?.days?.length ? o.repeat.days : [isoDow(parse(o.date))] };
    } else if (o.repeat) o.repeat.until = t.value;
    save(); return;
  }
  if (ds.f) {
    if (ds.f === 'date' && !t.value) return;
    o[ds.f] = t.value;
    if (ds.f === 'date') view.date = t.value;
    if (ds.f === 'format') o.data = { ...blankData(t.value), ...o.data };
    save();
    return;
  }
  if (ds.d) {
    o.data[ds.d] = t.value; save();
    if (ds.d === 'person' || ds.d === 'turning') $('b-who').innerHTML = whoLine(o.data);
    if (ds.d === 'notes') autosize();
    return;
  }
  if (ds.li) {
    const [key, i] = ds.li.split('.'), it = o.data[key][+i];
    it[ds.lf] = ds.lf === 'done' ? t.checked : t.value; save();
    if (ds.lf === 'done') $(`li-${key}-${i}`).classList.toggle('done', t.checked);
    if (key === 'gifts') $('gift-total').textContent = giftTotal(o.data);
    return;
  }
  if (ds.exnote !== undefined) { o.data.exercises[+ds.exnote].note = t.value; save(); return; }
  if (ds.set) {
    const [ei, si] = ds.set.split('.').map(Number), s = o.data.exercises[ei].sets[si];
    if (ds.sf === 'done') {
      s.done = t.checked;
      if (t.checked) for (const f of ['a', 'b']) { const inp = $(`s-${ei}-${si}-${f}`); if (inp && !inp.value && inp.placeholder && inp.placeholder !== '–') { inp.value = inp.placeholder; s[f] = inp.value; } }
      $(`row-${ei}-${si}`).classList.toggle('done', t.checked);
    } else s[ds.sf] = t.value;
    save();
    const st = wStats(o); $('st-vol').textContent = st.vol; $('st-sets').textContent = view.kind === 'saved' ? st.tot : `${st.done}/${st.tot}`;
  }
});

/* fields that change the page's layout or computed bits redraw once the value is committed */
document.addEventListener('change', ev => {
  const f = ev.target.dataset.f;
  if (view.mode !== 'doc' || !(['format', 'calId', 'date', 'start', 'end'].includes(f) || ev.target.dataset.rep)) return;
  const y = scrollY; render(); scrollTo(0, y);
});

document.addEventListener('submit', ev => {
  const f = ev.target.closest('form[data-form]'); if (!f) return;
  ev.preventDefault();
  if (f.dataset.form === 'send') { const email = $('au-email').value.trim(); if (email) sendLink(email); }
  if (f.dataset.form === 'verify') { const code = $('au-code').value.trim(); if (code) verifyCode(code); }
});
document.addEventListener('change', ev => { if (ev.target.id === 'imp-file' && ev.target.files?.[0]) importFile(ev.target.files[0]); });

/* ---------- start ---------- */
try { guestMode = localStorage.getItem('almanac-guest') === '1'; } catch (e) {}
applyTheme();
{
  const q = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
  const err = q.get('error_description');
  if (err) setTimeout(() => toast(/expired|invalid/i.test(err) ? 'That sign-in link expired. Request a new one.' : err), 300);
}
supa.auth.getSession().then(({ data }) => {
  authReady = true;
  if (data.session?.user) { startSession(data.session.user); return; }
  if (guestMode || hasData(db)) { guestMode = true; setStatus('local'); }
  else view = { mode: 'welcome', date: todayS() };
  render();
});
supa.auth.onAuthStateChange((evt, session) => {
  setTimeout(() => {
    if (!authReady) return;
    if (session?.user) startSession(session.user);
    else if (evt === 'SIGNED_OUT' && user) { endSession(); setStatus(''); go('welcome', todayS()); }
  }, 0);
});
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
