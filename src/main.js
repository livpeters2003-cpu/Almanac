import './styles.css';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { holidaysFor, COUNTRIES } from './holidays.js';
import { readTable, prepare, planWorkouts, planEvents, FIELDS, SAMPLE_CSV } from './importer.js';
import * as Cycle from './cycle.js';
import * as Prog from './progress.js';

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
  bill: '<path d="M6 2.5h12v19l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5zM9 7.5h6M9 11h6M9 14.5h3.5"/>',
};
const isCustom = f => typeof f === 'string' && f.startsWith('c:');
const icon = f => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[f] || (isCustom(f) ? ICONS.custom : ICONS.notes)}</svg>`;
const BLOCKS = {
  field: { label: 'Text field', def: 'Field' }, notes: { label: 'Long notes', def: 'Notes' }, checklist: { label: 'Checklist', def: 'Checklist' },
  number: { label: 'Number', def: 'Number' }, date: { label: 'Date', def: 'Date' }, link: { label: 'Link', def: 'Link' },
  rating: { label: 'Star rating', def: 'Rating' }, heading: { label: 'Section heading', def: 'Section' },
  choice: { label: 'Choice', def: 'Status' }, yesno: { label: 'Yes / No', def: 'Done?' }, time: { label: 'Time', def: 'Time' },
};
const BLOCK_TIPS = {
  field: 'A short line of text, like a name or place', notes: 'A big box for writing', checklist: 'A list you can tick off',
  number: 'A number, like a cost or a count', date: 'A date, like a due date', link: 'A web address you can tap to open',
  rating: 'One to five stars', heading: 'A title that splits the page into parts', choice: 'Pick one option, like a mood or a status',
  yesno: 'A quick yes or no, like “Paid?”', time: 'A time of day',
};
// Starting points for the format builder: [type, label, hint or options]
const IDEAS = [
  { name: 'Doctor visit', color: '#0c8599', style: 'clean', blocks: [['field', 'Doctor', 'Name'], ['field', 'Where', 'Office or address'], ['checklist', 'Questions to ask'], ['notes', 'What they said'], ['date', 'Follow-up']] },
  { name: 'Habit check-in', color: '#2f9e44', style: 'clean', blocks: [['yesno', 'Worked out?'], ['yesno', 'Drank enough water?'], ['yesno', 'Read?'], ['choice', 'Mood', 'Great, Good, Okay, Low'], ['notes', 'Notes']] },
  { name: 'Reading log', color: '#7048e8', style: 'notebook', blocks: [['field', 'Book'], ['field', 'Author'], ['number', 'Pages read'], ['rating', 'Rating'], ['notes', 'Thoughts']] },
  { name: 'Meal or recipe', color: '#e8590c', style: 'pastel', blocks: [['field', 'Dish'], ['link', 'Recipe link'], ['checklist', 'Ingredients'], ['notes', 'Steps'], ['rating', 'How it turned out']] },
  { name: 'Meeting', color: '#4263eb', style: 'clean', blocks: [['field', 'With'], ['field', 'Where', 'Room or video link'], ['checklist', 'Agenda'], ['notes', 'Notes'], ['checklist', 'Action items']] },
  { name: 'Project or assignment', color: '#1c7ed6', style: 'notebook', blocks: [['date', 'Due'], ['choice', 'Status', 'Not started, In progress, Done'], ['checklist', 'Steps'], ['link', 'Link'], ['notes', 'Notes']] },
  { name: 'Plans with friends', color: '#d6336c', style: 'pastel', blocks: [['field', 'Who'], ['field', 'Where'], ['link', 'Reservation'], ['number', 'Budget'], ['notes', 'Plan']] },
  { name: 'Journal', color: '#ae3ec9', style: 'notebook', blocks: [['choice', 'Mood', 'Great, Good, Okay, Low'], ['rating', 'Energy'], ['checklist', 'Grateful for'], ['notes', 'Today']] },
  { name: 'Appointment', color: '#f08c00', style: 'clean', blocks: [['field', 'With', 'Hair, nails, dentist…'], ['field', 'Where'], ['number', 'Cost'], ['yesno', 'Booked?'], ['notes', 'Notes']] },
  { name: 'Bill or payment', color: '#868e96', style: 'clean', blocks: [['number', 'Amount'], ['date', 'Due'], ['yesno', 'Paid?'], ['link', 'Pay here'], ['notes', 'Notes']] },
];
const ideaBlocks = idea => idea.blocks.map(([type, label, extra]) => ({ id: uid(), type, label, placeholder: type === 'choice' ? '' : extra || '', ...(type === 'choice' ? { options: extra || '' } : {}) }));
const choiceOpts = b => String(b.options || '').split(',').map(x => x.trim()).filter(Boolean);
const STYLES = { clean: { name: 'Clean', skin: '' }, notebook: { name: 'Notebook', skin: 'fmt-class' }, dark: { name: 'Dark', skin: 'fmt-workout' }, pastel: { name: 'Pastel', skin: 'fmt-birthday' } };

const FORMATS = {
  workout: { name: 'Workout', blurb: 'A gym-tracker page: exercises from your library, sets with weight and reps, last time’s numbers, and volume.' },
  birthday: { name: 'Birthday', blurb: 'A countdown, who’s turning what, gift ideas with prices, party plans and a card message.' },
  class: { name: 'Class', blurb: 'Notebook paper with course, room, instructor, assignments with due dates and lecture notes.' },
  trip: { name: 'Trip', blurb: 'A boarding pass with your route, booking code and seat, where you’re staying and a packing list.' },
  bill: { name: 'Bill', blurb: 'A bill or payment: the amount, whether it’s paid or on autopay, where it’s paid from, a pay link, and this month’s total.' },
  notes: { name: 'Notes', blurb: 'A clean page with a title and notes, for anything that doesn’t need a special layout.' },
};
const THUMBS = {
  workout: '<b>Bench Press (Barbell)</b><i></i><i class="ok"></i><i class="ok"></i><em>+ Add set</em>',
  birthday: '<b>12</b><small>days to go</small><span>Sam turns 30</span>',
  class: '<b>BIO 110</b><i></i><i></i><i></i>',
  trip: `<div><b>LAX</b><svg class="ic" viewBox="0 0 24 24">${ICONS.trip}</svg><b>JFK</b><span></span></div>`,
  bill: '<small>Rent · due the 1st</small><b>$1,450.00</b><span>Paid</span>',
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
    bill: { amount: '', paid: '', autopay: '', account: '', link: '', notes: '' },
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
const save = () => { persistLocal(); scheduleSync(); syncRemindersSoon(); };
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
    toRow: (c, i) => ({ id: c.id, user_id: user.id, body: { name: c.name || '', color: c.color, format: c.format, hidden: !!c.hidden, ...(c.sharing === 'friends' ? { formats: sharedFormats(c) } : {}) }, sharing: c.sharing === 'friends' ? 'friends' : 'private', position: i }),
    fromRow: r => { const { formats, ...body } = r.body || {}; return { id: r.id, ...body, sharing: r.sharing }; },
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
// The custom formats a shared calendar uses, so friends see those pages laid out the same way.
function sharedFormats(c) {
  const ids = new Set([c.format, ...db.events.filter(e => e.calId === c.id).map(e => e.format)].filter(isCustom));
  return db.formats.filter(f => ids.has('c:' + f.id)).map(({ fresh, ...f }) => f);
}
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
    ready = true; persistLocal(); applyTheme(); flush(); syncRemindersSoon();
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
  for (const table of ['planner_settings', 'calendars', 'events', 'templates']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, p => {
    const owner = p.new?.user_id || p.old?.user_id;
    if (owner && owner !== user?.id) loadSocialSoon(); else if (!syncing) pullSoon();
  });
  for (const table of ['friend_requests', 'profiles']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, loadSocialSoon);
  channel.subscribe();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (user) { pullSoon(); loadSocialSoon(); pullCycle(); } loadNews(); refreshFeeds(); } });
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
  restoreSocial();
  { const mineC = loadCycleLocal(u.id), guestC = loadCycleLocal(GUEST);
    cyc = (!mineC.settings.on && !Object.keys(mineC.logs).length && (guestC.settings.on || Object.keys(guestC.logs).length)) ? guestC : mineC;
    if (cyc === guestC) { try { localStorage.removeItem(cycleKey(GUEST)); } catch (e) {} }
    cycStats = null; cycDirty = new Set(); cycProfileDirty = false; }
  feedData = loadFeedData(u.id); feedVer++;
  remSynced = null; checkPush();
  render(); pull(); listen(); loadNews(); loadSocial().then(useInvite); pullCycle();
  setTimeout(refreshFeeds, 1500);
}
function endSession() {
  if (channel) { supa.removeChannel(channel); channel = null; }
  user = null; ready = false; owner = GUEST; db = loadLocal(GUEST);
  synced = { settings: null, calendars: {}, events: {}, saved: {} };
  cyc = loadCycleLocal(GUEST); cycStats = null; cycDirty = new Set(); cycProfileDirty = false;
  feedData = loadFeedData(GUEST); feedVer++;
  news = {}; social = { me: null, requests: [], people: {}, cals: [], events: [] }; fcCache = feCache = null; applyTheme();
}

/* ---------- state ---------- */
let view = { mode: 'week', date: todayS() };
let modal = null;
let preview = null;
let confirmDel = false, confirmCal = null, confirmSaved = null;
let libTab = 'formats', libQ = '', libMuscle = '';
let newCal = { color: SWATCHES[0], format: 'notes' };

const $ = id => document.getElementById(id);
const calOf = o => o._friend ? friendCals().find(c => c.id === o.calId) : o._feed ? feedCals().find(c => c.id === o.calId) : db.calendars.find(c => c.id === o.calId);
const visibleEvents = () => [...db.events, ...friendEvents(), ...feedEvents()].filter(e => { const c = calOf(e); return c && !c.hidden; });
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
  if (ev.format === 'bill') ev.data.paid = '';
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
    for (const s of occurrences(e, from, to)) add(s, { ...e, id: occId(e.id, s), date: s, _occ: e.id, ...(e.format === 'bill' ? { data: { ...e.data, paid: '' } } : {}) });
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
/* ---------- friends (profiles, requests, and the calendars friends share) ---------- */
// Kept in memory and cached on the device; friends' calendars are read only.
let social = { me: null, requests: [], people: {}, cals: [], events: [] }, socialTimer = null, fcCache = null, feCache = null;
const socialKey = () => `almanac-social:${user?.id}`;
function setSocial(next) {
  social = next; fcCache = feCache = null;
  try { localStorage.setItem(socialKey(), JSON.stringify(social)); } catch (e) {}
}
const friendIds = () => social.requests.filter(r => r.status === 'accepted').map(r => r.from_id === user?.id ? r.to_id : r.from_id);
const personName = id => social.people[id]?.display_name || 'Friend';
const firstName = id => personName(id).split(/\s+/)[0];
const fKey = (uid_, id) => `f:${uid_}:${id}`;
function friendCals() {
  if (fcCache) return fcCache;
  const shown = db.prefs.friendCals || {};
  return (fcCache = social.cals.map(r => ({ id: fKey(r.user_id, r.id), name: r.body?.name || 'Calendar', color: r.body?.color, format: r.body?.format, formats: r.body?.formats || [], owner: r.user_id, hidden: shown[fKey(r.user_id, r.id)] === false })));
}
function friendEvents() {
  if (feCache) return feCache;
  return (feCache = social.events.filter(r => r.body && typeof r.body.date === 'string').map(r => ({ ...r.body, id: fKey(r.user_id, r.body.id), calId: fKey(r.user_id, r.cal_id), _friend: r.user_id })));
}
const friendFormat = (o, f) => isCustom(f) ? (calOf(o)?.formats || []).find(x => 'c:' + x.id === f) || null : null;
async function loadSocial() {
  if (!user) return;
  const me = user.id;
  try {
    const [prof, reqs, names] = await Promise.all([
      supa.from('profiles').select('*').eq('id', me).maybeSingle(),
      supa.from('friend_requests').select('*'),
      supa.rpc('request_people'),
    ]);
    if (prof.error || reqs.error) throw prof.error || reqs.error;
    if (!user || user.id !== me) return;
    const requests = reqs.data || [], fids = requests.filter(r => r.status === 'accepted').map(r => r.from_id === me ? r.to_id : r.from_id);
    const people = {};
    for (const p of names.data || []) people[p.id] = p;
    let cals = [], events = [];
    if (fids.length) {
      const [fp, fc] = await Promise.all([supa.from('profiles').select('*').in('id', fids), supa.from('calendars').select('*').in('user_id', fids).eq('sharing', 'friends').order('position')]);
      if (fp.error || fc.error) throw fp.error || fc.error;
      for (const p of fp.data || []) people[p.id] = p;
      cals = fc.data || [];
      for (let from = 0; cals.length; from += 1000) {
        const { data, error } = await supa.from('events').select('*').in('user_id', fids).order('date').order('id').range(from, from + 999);
        if (error) throw error;
        events.push(...data);
        if (data.length < 1000) break;
      }
    }
    setSocial({ me: prof.data, requests, people, cals, events });
    softRender();
  } catch (e) {}
}
const loadSocialSoon = () => { clearTimeout(socialTimer); socialTimer = setTimeout(loadSocial, 500); };
function restoreSocial() {
  try { const c = JSON.parse(localStorage.getItem(socialKey())); if (c && Array.isArray(c.requests)) { social = { me: null, people: {}, cals: [], events: [], ...c }; fcCache = feCache = null; return; } } catch (e) {}
  social = { me: null, requests: [], people: {}, cals: [], events: [] }; fcCache = feCache = null;
}
// Invite links look like https://…/?invite=CODE. The code waits on this device until you're signed in.
const INVITE_KEY = 'almanac-invite';
{
  const q = new URLSearchParams(location.search), code = q.get('invite');
  if (code && /^[a-z0-9]{6,20}$/i.test(code)) {
    try { localStorage.setItem(INVITE_KEY, code); } catch (e) {}
    q.delete('invite'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
  }
}
const pendingInvite = () => { try { return localStorage.getItem(INVITE_KEY); } catch (e) { return null; } };
async function useInvite() {
  const code = pendingInvite(); if (!code || !user) return;
  try { localStorage.removeItem(INVITE_KEY); } catch (e) {}
  const { data, error } = await supa.rpc('friend_by_code', { p_code: code });
  if (error) { toast('Couldn’t use that invite link. Try opening it again.'); return; }
  const n = data?.name || 'your friend';
  toast({ sent: `Friend request sent to ${n}`, friends: `You and ${n} are friends`, self: 'That’s your own invite link', not_found: 'That invite link isn’t valid anymore' }[data?.status] || 'Done');
  loadSocial();
}
async function addFriendByEmail(email) {
  const { error } = await supa.rpc('friend_by_email', { p_email: email });
  if (error) { toast('Couldn’t send that. Try again.'); return false; }
  toast('If they have Almanac, they’ll see your request. If not, send them your invite link.');
  loadSocial(); return true;
}
async function friendAction(fn) { const { error } = await fn(); if (error) toast('That didn’t go through. Try again.'); loadSocial(); }
let profileTimer = null;
function saveProfileSoon(patch) {
  if (!user || !social.me) return;
  social.me = { ...social.me, ...patch }; setSocial(social);
  clearTimeout(profileTimer);
  profileTimer = setTimeout(async () => {
    const { display_name, birthday_month, birthday_day } = social.me;
    const { error } = await supa.from('profiles').update({ display_name, birthday_month, birthday_day }).eq('id', user.id);
    if (error) toast('Couldn’t save your profile. Check your connection.');
  }, 600);
}
// Friends' birthdays for the years around the one on screen.
const birthdaysOn = () => db.prefs.birthdays !== false;
const BDAY_COLOR = '#d6336c';
function birthdayMap() {
  if (!birthdaysOn() || !user) return {};
  const y = parse(view.date).getFullYear(), m = {};
  for (const id of friendIds()) {
    const p = social.people[id]; if (!p?.birthday_month || !p?.birthday_day) continue;
    for (const yr of [y - 1, y, y + 1]) {
      const d = new Date(yr, p.birthday_month - 1, p.birthday_day);
      if (d.getMonth() !== p.birthday_month - 1) continue;   // Feb 29 in other years
      (m[iso(d)] || (m[iso(d)] = [])).push({ id, name: `${personName(id)}’s birthday` });
    }
  }
  return m;
}
const bdayChip = b => `<span class="hol bday" style="--c:${BDAY_COLOR}" title="${esc(b.name)}">🎂 ${esc(b.name)}</span>`;
// Days that have holidays or friends' birthdays, as one map of chips.
function specialDays() {
  const h = holidayMap(), b = birthdayMap(), m = {};
  for (const k in h) m[k] = h[k].map(x => ({ ...x, kind: 'hol' }));
  for (const k in b) (m[k] || (m[k] = [])).push(...b[k].map(x => ({ ...x, kind: 'bday' })));
  const c = cycleDays();
  for (const k in c) (m[k] || (m[k] = [])).unshift(...c[k]);
  return m;
}
const specialChip = x => x.kind === 'bday' ? bdayChip(x) : x.kind === 'cycle' ? cycleChip(x) : holChip(x);

/* ---------- calendars linked from Google, Apple and other apps (read only) ---------- */
// Each linked calendar is a private iCal link kept in your settings. /api/ics reads it and returns the events;
// this device keeps the last copy so they show offline, and reads it again every 15 minutes while the app is open.
const FEED_KINDS = { google: 'Google Calendar', apple: 'Apple Calendar', other: 'Calendar link' };
const FEED_STALE = 15 * 60e3;
const feedsKey = who => `almanac-feeds:${who}`;
function loadFeedData(who) { try { const x = JSON.parse(localStorage.getItem(feedsKey(who))); if (x && typeof x === 'object') return x; } catch (e) {} return {}; }
let feedData = loadFeedData(GUEST), feedBusy = new Set(), feedVer = 0, fdCache = null, feedForm = { kind: 'google', busy: false, err: '' }, confirmFeed = null;
const saveFeedData = () => { feedVer++; try { localStorage.setItem(feedsKey(owner), JSON.stringify(feedData)); } catch (e) {} };
const feeds = () => Array.isArray(db.prefs.feeds) ? db.prefs.feeds : [];
const feedCals = () => feeds().map(f => ({ id: 'g:' + f.id, name: f.name || FEED_KINDS[f.kind] || 'Calendar', color: f.color, format: 'notes', feed: f, hidden: !!f.hidden }));
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function feedEvents() {
  const key = feeds().map(f => f.id).join() + ':' + feedVer;
  if (fdCache?.key === key) return fdCache.list;
  const out = [], seen = new Set();
  for (const f of feeds()) {
    const d = feedData[f.id];
    if (!d?.events) { if (!feedBusy.has(f.id) && !d?.at) setTimeout(() => refreshFeed(f), 0); continue; }
    for (const x of d.events) {
      let id = `g:${f.id}:${hash((x.uid || x.title || '') + '|' + (x.start || x.date))}`;
      while (seen.has(id)) id += '+';
      seen.add(id);
      const base = { calId: 'g:' + f.id, title: x.title || 'Busy', format: 'notes', data: { notes: x.notes || '' }, location: x.location || '', _feed: f.id };
      if (x.allDay) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date || '')) continue;
        const n = Math.max(1, Math.min(62, daysBetween(x.date, x.endDate || x.date)));
        for (let k = 0; k < n; k++) out.push({ ...base, id: k ? `${id}~${k}` : id, date: iso(addDays(parse(x.date), k)), start: '', end: '', first: x.date, endDate: x.endDate || '' });
      } else {
        const st = new Date(x.start), en = x.end ? new Date(x.end) : null;   // "2026-10-20T08:00" (no zone) reads as this device's time
        if (isNaN(st)) continue;
        const sameDay = en && !isNaN(en) && iso(en) === iso(st);
        out.push({ ...base, id, date: iso(st), start: hm(st), end: sameDay ? hm(en) : '', until: en && !isNaN(en) && !sameDay ? en.toISOString() : '' });
      }
    }
  }
  fdCache = { key, list: out };
  return out;
}
const FEED_ERRORS = {
  link: 'That doesn’t look like a calendar link. It should start with webcal:// or https://.',
  gone: 'That link didn’t open. It may have been turned off, or only part of it was copied. Copy it again.',
  notcal: 'That link opened a web page, not a calendar. Copy the iCal or public calendar link instead.',
  big: 'That calendar is too big to load.',
  down: 'Couldn’t reach that calendar just now. Try again in a minute.',
};
async function fetchFeed(url) {
  const now = new Date(), from = new Date(now.getFullYear() - 1, 0, 1).getTime(), to = new Date(now.getFullYear() + 2, 0, 1).getTime();
  try {
    const res = await fetch('/api/ics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, from, to }) });
    const j = await res.json().catch(() => ({}));
    return res.ok && Array.isArray(j.events) ? { events: j.events, name: j.name || '' } : { error: FEED_ERRORS[j.error] ? j.error : 'down' };
  } catch (e) { return { error: 'down' }; }
}
async function refreshFeed(f, force) {
  const d = feedData[f.id];
  if (feedBusy.has(f.id) || (!force && d?.at && Date.now() - d.at < FEED_STALE)) return;
  feedBusy.add(f.id);
  if (force) softRender();
  const got = await fetchFeed(f.url);
  feedBusy.delete(f.id);
  if (!feeds().some(x => x.id === f.id)) return;
  feedData[f.id] = got.error ? { ...(d || {}), at: Date.now(), error: got.error } : { at: Date.now(), events: got.events, name: got.name };
  saveFeedData(); softRender();
}
const refreshFeeds = force => Promise.all(feeds().map(f => refreshFeed(f, force)));
setInterval(() => { if (document.visibilityState === 'visible') refreshFeeds(); }, 5 * 60e3);
async function addFeed() {
  const url = $('fd-url')?.value.trim() || '', name = $('fd-name')?.value.trim() || '';
  if (!/^(webcals?|https?):\/\/\S+$/i.test(url)) { feedForm = { ...feedForm, url, name, err: FEED_ERRORS.link }; render(); return; }
  if (feeds().some(f => f.url === url)) { feedForm = { ...feedForm, url, name, err: 'That calendar is already linked.' }; render(); return; }
  feedForm = { ...feedForm, busy: true, err: '', url, name }; render();
  const got = await fetchFeed(url);
  if (got.error) { feedForm = { ...feedForm, busy: false, err: FEED_ERRORS[got.error] }; render(); return; }
  const used = new Set([...db.calendars, ...feeds()].map(c => c.color));
  const f = { id: uid(), kind: feedForm.kind, url, name: name || got.name || FEED_KINDS[feedForm.kind], color: SWATCHES.find(c => !used.has(c)) || SWATCHES[feeds().length % SWATCHES.length] };
  db.prefs.feeds = [...feeds(), f];
  feedData[f.id] = { at: Date.now(), events: got.events, name: got.name };
  saveFeedData(); save();
  feedForm = { kind: feedForm.kind, busy: false, err: '' };
  render();
  toast(`${f.name} linked · ${got.events.length} event${got.events.length === 1 ? '' : 's'}`);
}
const ago = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const FEED_HOWTO = {
  google: `<ol><li>On a computer, open <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noopener">Google Calendar settings</a>.</li><li>Under <b>Settings for my calendars</b> on the left, click the calendar you want.</li><li>Choose <b>Integrate calendar</b> and copy <b>Secret address in iCal format</b>.</li></ol><p class="muted">Google refreshes this link on its side every few hours, so a brand-new Google event can take a while to show up here.</p>`,
  apple: `<ol><li>On iPhone, open the <b>Calendar</b> app and tap <b>Calendars</b> at the bottom.</li><li>Tap <b>ⓘ</b> next to the calendar you want and turn on <b>Public Calendar</b>.</li><li>Tap <b>Share Link…</b>, then <b>Copy</b>.</li></ol><p class="muted">On a Mac: in Calendar, Control-click the calendar, choose <b>Share Calendar…</b>, tick <b>Public Calendar</b> and copy the link.</p>`,
  other: `<p>Paste any iCal link (it often starts with <b>webcal://</b> or ends in <b>.ics</b>), for example from Outlook, a school or a sports team.</p>`,
};
function renderFeeds() {
  let h = `<h2 class="sec">From Google or Apple Calendar</h2><p class="muted">Show events from your other calendars next to your own. They’re read only here: change them in Google or Apple Calendar and Almanac picks up the change on its own.</p><div class="stack">`;
  for (const f of feeds()) {
    const d = feedData[f.id] || {}, busy = feedBusy.has(f.id), n = d.events?.length || 0;
    const status = busy ? 'Updating…' : d.error ? `<span class="warn">${esc(FEED_ERRORS[d.error] || FEED_ERRORS.down)}</span>${d.events ? ` Showing the copy from ${ago(d.at)}.` : ''}` : d.at ? `${n} event${n === 1 ? '' : 's'} · updated ${ago(d.at)}` : 'Not loaded yet';
    h += `<div class="panel calrow feedrow" style="--c:${okColor(f.color)}"><div class="fields">
      <label class="field" style="flex:1 1 180px"><span>Name</span><input data-feed="${f.id}" value="${esc(f.name)}" placeholder="${esc(FEED_KINDS[f.kind] || 'Calendar')}"></label>
      <div class="field"><span>Color</span><div class="swatches">${SWATCHES.map(s => `<button class="sw" style="--c:${s}" data-act="feed-color" data-id="${f.id}" data-color="${s}" aria-pressed="${s === f.color}" aria-label="Color ${s}"></button>`).join('')}</div></div>
    </div><p class="muted feed-st">${esc(FEED_KINDS[f.kind] || 'Calendar link')} · ${status}</p>
    <div class="grp" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button class="btn" data-act="feed-refresh" data-id="${f.id}"${busy ? ' disabled' : ''}>Refresh now</button>
      ${confirmFeed === f.id ? `<button class="btn" data-act="feed-del-cancel">Keep</button><button class="btn danger solid" data-act="feed-del-confirm" data-id="${f.id}">Unlink calendar</button>` : `<button class="btn danger" data-act="feed-del" data-id="${f.id}">Unlink</button>`}</div></div>`;
  }
  const k = feedForm.kind;
  h += `<div class="panel feed-add"><h2 class="sec" style="margin-top:0">Link a calendar</h2>${seg('feed-kind', k, [['google', 'Google'], ['apple', 'Apple'], ['other', 'Other link']])}
    <div class="feed-how">${FEED_HOWTO[k]}</div>
    <div class="m-row" style="align-items:end"><label class="field" style="flex:2 1 260px"><span>Calendar link</span><input id="fd-url" value="${esc(feedForm.url || '')}" placeholder="${k === 'apple' ? 'webcal://p…-caldav.icloud.com/published/…' : k === 'google' ? 'https://calendar.google.com/calendar/ical/…/basic.ics' : 'webcal://… or https://….ics'}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    <label class="field" style="flex:1 1 160px"><span>Name (optional)</span><input id="fd-name" value="${esc(feedForm.name || '')}" placeholder="e.g. Work"></label></div>
    ${feedForm.err ? `<p class="auth-err">${esc(feedForm.err)}</p>` : ''}
    <p class="muted">Anyone who has this link can see that calendar, so keep it to yourself. Almanac keeps it only in your private settings.</p>
    <div><button class="btn primary" data-act="feed-add"${feedForm.busy ? ' disabled' : ''}>${feedForm.busy ? 'Checking the link…' : 'Link calendar'}</button></div></div>`;
  return h + '</div>';
}
function renderFeedDoc(o) {
  const c = calOf(o), f = c?.feed, kind = FEED_KINDS[f?.kind] || 'Calendar link';
  const back = { year: 'Year', week: 'Week', day: 'Day', calendars: 'Calendars' }[view.back.mode] || 'Week';
  let when;
  if (o.first && o.endDate && daysBetween(o.first, o.endDate) > 1) when = `${longDate(parse(o.first))} – ${longDate(addDays(parse(o.endDate), -1))}`;
  else if (o.until) when = `${longDate(parse(o.date))}, ${fmtTime(o.start)} – ${longDate(new Date(o.until))}, ${fmtTime(hm(new Date(o.until)))}`;
  else when = `${longDate(parse(o.date))} · ${o.start ? fmtTime(o.start) + (o.end ? ' – ' + fmtTime(o.end) : '') : 'All day'}`;
  const linkify = s => s.replace(/https:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  return `<article class="doc fmt-notes ro-doc" style="--c:${okColor(c?.color)}">
    <div class="doc-top"><button class="back" data-act="back">‹ ${back}</button><span class="eyebrow">${icon('notes')}${esc(kind)} · ${esc(c?.name || '')}</span></div>
    <h1 class="ttl ro">${esc(o.title || 'Busy')}</h1>
    <p class="ro-when">${esc(when)}</p>
    ${o.location ? `<p class="feed-loc">${esc(o.location)}</p>` : ''}
    ${o.data.notes ? `<div class="feed-notes">${linkify(esc(o.data.notes))}</div>` : ''}
    <p class="ro-note">This event comes from your ${esc(kind)}. Change it there and Almanac picks up the change on its own.</p></article>`;
}

/* ---------- cycle tracking (opt-in, private: its own tables that only you can read) ---------- */
const CYCLE_BLANK = () => ({ settings: { on: false }, logs: {} });
const cycleKey = who => `almanac-cycle:${who}`;
function loadCycleLocal(who) { try { const c = JSON.parse(localStorage.getItem(cycleKey(who))); if (c && typeof c.logs === 'object') return { settings: { on: false, ...c.settings }, logs: c.logs || {} }; } catch (e) {} return CYCLE_BLANK(); }
let cyc = loadCycleLocal(GUEST), cycDirty = new Set(), cycProfileDirty = false, cycTimer = null, cycStats = null;
const cycleOn = () => !!cyc.settings.on && !!cyc.settings.lastStart;
function saveCycle(dates = [], profile = false) {
  cycStats = null;
  try { localStorage.setItem(cycleKey(owner), JSON.stringify(cyc)); } catch (e) {}
  dates.forEach(d => cycDirty.add(d)); if (profile) { cycProfileDirty = true; syncRemindersSoon(); }
  if (user) { clearTimeout(cycTimer); cycTimer = setTimeout(flushCycle, 800); }
}
async function flushCycle() {
  if (!user) return;
  try {
    if (cycProfileDirty) { const { error } = await supa.from('cycle_profile').upsert({ user_id: user.id, settings: cyc.settings, updated_at: new Date().toISOString() }); if (error) throw error; cycProfileDirty = false; }
    const dates = [...cycDirty], up = dates.filter(d => cyc.logs[d]), del = dates.filter(d => !cyc.logs[d]);
    if (up.length) { const { error } = await supa.from('cycle_logs').upsert(up.map(d => ({ user_id: user.id, date: d, data: cyc.logs[d], updated_at: new Date().toISOString() }))); if (error) throw error; }
    if (del.length) { const { error } = await supa.from('cycle_logs').delete().eq('user_id', user.id).in('date', del); if (error) throw error; }
    dates.forEach(d => cycDirty.delete(d));
  } catch (e) { clearTimeout(cycTimer); cycTimer = setTimeout(flushCycle, 8000); }
}
async function pullCycle() {
  if (!user) return;
  const me = user.id;
  try {
    const [pr, lg] = await Promise.all([supa.from('cycle_profile').select('settings').eq('user_id', me).maybeSingle(), supa.from('cycle_logs').select('date, data').eq('user_id', me).order('date')]);
    if (pr.error || lg.error || user?.id !== me) return;
    const logs = {}; for (const r of lg.data || []) logs[r.date] = r.data;
    for (const d of cycDirty) { if (cyc.logs[d]) logs[d] = cyc.logs[d]; else delete logs[d]; }   // edits not uploaded yet win
    const settings = cycProfileDirty || !pr.data ? cyc.settings : { on: false, ...pr.data.settings };
    if (!pr.data && (cyc.settings.on || Object.keys(cyc.logs).length)) { cycProfileDirty = true; Object.keys(cyc.logs).forEach(d => cycDirty.add(d)); Object.assign(logs, cyc.logs); }
    cyc = { settings, logs }; saveCycle();
    if (cycDirty.size || cycProfileDirty) flushCycle();
    softRender();
  } catch (e) {}
}
function cycleStats() { return cycStats || (cycStats = Cycle.stats(cyc.logs, cyc.settings)); }
const cycleInfo = d => cycleOn() ? Cycle.dayInfo(d, cyc.logs, cyc.settings, cycleStats()) : null;
const CYCLE_COLOR = '#e03131';
function cycleDays() {
  if (!cycleOn()) return {};
  const y = parse(view.date).getFullYear(), from = iso(new Date(y - 1, 11, 1)), to = iso(new Date(y + 1, 0, 31)), m = {};
  for (const [d, v] of Object.entries(cyc.logs)) if (v?.period && d >= from && d <= to) m[d] = [{ kind: 'cycle', name: v.period === 'spotting' ? 'Spotting' : 'Period' }];
  for (const d of Cycle.predictedPeriods(cyc.logs, cyc.settings, from, to, cycleStats())) if (d >= todayS()) m[d] = [{ kind: 'cycle', name: 'Period (predicted)', predicted: true }];
  return m;
}
const cycleChip = x => `<span class="hol cyc${x.predicted ? ' pred' : ''}" style="--c:${CYCLE_COLOR}" title="${esc(x.name)}">${esc(x.name)}</span>`;
function setLog(d, patch) {
  const cur = { ...(cyc.logs[d] || {}), ...patch };
  for (const k of Object.keys(cur)) if (cur[k] === '' || cur[k] === 0 || (Array.isArray(cur[k]) && !cur[k].length)) delete cur[k];
  if (Object.keys(cur).length) cyc.logs[d] = cur; else delete cyc.logs[d];
  saveCycle([d]);
}
const pick1 = (act, cur, opts, extra = '') => `<div class="pick cyc-pick">${opts.map(([v, n]) => `<button data-act="${act}" data-v="${esc(v)}" aria-pressed="${cur === v}"${extra}>${n}</button>`).join('')}</div>`;
function suggestionBox(info, d) {
  const sug = Cycle.suggestion(info, cyc.logs[d] || {}, Cycle.energyByPhase(cyc.logs, cyc.settings, cycleStats()));
  if (!sug) return '';
  return `<div class="cyc-sug"><span class="eyebrow">Suggested workout</span><b>${esc(sug.title)}</b><p>${esc(sug.text)}</p><small>Based on your ${esc(Cycle.PHASES[info.phase].name.toLowerCase())}${sug.why.length ? ' and ' + esc(sug.why.join(', ')) : ''}. General guidance, not medical advice.</small></div>`;
}
function cycleCard(d) {
  const info = cycleInfo(d); if (!info) return '';
  const log = cyc.logs[d] || {}, t = todayS(), st = cycleStats(), future = d > t;
  const until = Cycle.daysBetween(t, info.nextStart);
  const head = `<div class="cyc-h"><div><span class="eyebrow">Your cycle · only you can see this</span><h3>Day ${info.day} · ${esc(Cycle.PHASES[info.phase].name)}${info.predicted ? ' (predicted)' : ''}</h3><p>${esc(Cycle.PHASES[info.phase].blurb)} ${d <= t && until >= 0 ? `Next period ${until === 0 ? 'likely today' : until === 1 ? 'likely tomorrow' : `in about ${until} days (${shortDate(parse(info.nextStart))})`}.` : ''}</p></div></div>`;
  let h = `<section class="cyc">${head}`;
  if (!future && !cycOpen) {
    const bits = [log.period && Cycle.FLOW[log.period] + ' flow', log.energy && 'energy ' + log.energy, log.mood, ...(log.symptoms || []), log.sleep && Cycle.SLEEP[log.sleep] + ' sleep'].filter(Boolean);
    h += `<button class="btn cyc-open" data-act="cy-open">${bits.length ? `Logged: ${esc(bits.join(', '))} · Edit` : 'Log your period and how you feel'}</button>`;
  }
  if (!future && cycOpen) {
    h += `<div class="cyc-log"><div class="field"><span>Period</span>${pick1('cy-flow', log.period || '', [['', 'None'], ...Object.entries(Cycle.FLOW)])}</div>
      <div class="field"><span>Energy</span>${pick1('cy-energy', String(log.energy || ''), [['1', '1 · Drained'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5 · Great']])}</div>
      <div class="field"><span>Mood</span>${pick1('cy-mood', log.mood || '', Cycle.MOODS.map(m => [m, m]))}</div>
      <div class="field"><span>Symptoms</span><div class="pick cyc-pick">${Cycle.SYMPTOMS.map(x => `<button data-act="cy-sym" data-v="${esc(x)}" aria-pressed="${(log.symptoms || []).includes(x)}">${esc(x)}</button>`).join('')}</div></div>
      <div class="field"><span>Sleep</span>${pick1('cy-sleep', log.sleep || '', Object.entries(Cycle.SLEEP))}</div><div><button class="btn" data-act="cy-open">Done</button></div></div>`;
  }
  h += suggestionBox(info, d);
  if (st.cyclesLogged < 2) h += `<p class="muted cyc-foot">Predictions get more accurate after you log two or three periods.</p>`;
  return h + '</section>';
}
function workoutCycleBanner(o) {
  if (view.kind !== 'event' || o.date < todayS() || !cycleOn()) return '';
  const info = cycleInfo(o.date); if (!info) return '';
  return `<div class="w-cyc">${suggestionBox(info, o.date)}</div>`;
}
function renderCycleSettings() {
  const c = cyc.settings;
  let h = `<section class="panel stack"><h2 class="sec" style="margin:0">Cycle tracking</h2>${setRow('Track my cycle', 'Log your period and how you feel, see predictions, and get workout suggestions by phase. Only you can see it, even on calendars you share.', seg('cy-on', c.on ? 'on' : 'off', [['off', 'Off'], ['on', 'On']]))}`;
  if (c.on) {
    h += `<div class="m-row" style="align-items:end">
      <label class="field" style="flex:1 1 170px"><span>Last period started</span><input type="date" id="cy-last" value="${esc(c.lastStart || '')}" max="${todayS()}"></label>
      <label class="field" style="flex:1 1 130px"><span>Usual cycle length</span><select id="cy-len">${['', ...Array.from({ length: 25 }, (_, i) => String(i + 21))].map(v => `<option value="${v}"${String(c.cycleLength || '') === v ? ' selected' : ''}>${v ? v + ' days' : 'Not sure'}</option>`).join('')}</select></label>
      <label class="field" style="flex:1 1 130px"><span>Usual period length</span><select id="cy-plen">${Array.from({ length: 9 }, (_, i) => String(i + 2)).map(v => `<option value="${v}"${String(c.periodLength || 5) === v ? ' selected' : ''}>${v} days</option>`).join('')}</select></label></div>`;
    h += c.lastStart ? `<p class="muted" style="margin:0">Log each day on the Day view. Your averages so far: ${cycleStats().cycleLength}-day cycle, ${cycleStats().periodLength}-day period.</p>` : `<p class="muted" style="margin:0">Add when your last period started to see predictions.</p>`;
  }
  if (c.on || Object.keys(cyc.logs).length) h += `<div>${confirmCycleDel ? `<button class="btn" data-act="cy-del-cancel">Keep</button> <button class="btn danger solid" data-act="cy-del-confirm">Delete all cycle data</button>` : `<button class="btn danger" data-act="cy-del">Delete all cycle data</button>`}</div>`;
  return h + '</section>';
}
let confirmCycleDel = false, cycOpen = false;

/* ---------- reminders (notifications on your phone and computer) ---------- */
// The app works out your upcoming reminders here, in your own time zone, and keeps the list on the server;
// a small job sends whatever is due every few minutes.
const REMIND_TIMED = { '': 'No reminder', '0': 'At the start', '10': '10 minutes before', '30': '30 minutes before', '60': '1 hour before', '1440': '1 day before' };
const REMIND_ALLDAY = { '': 'No reminder', am0: 'That morning (9 am)', am1: 'The day before (9 am)' };
const remPrefs = () => ({ on: false, events: true, checkin: false, checkinTime: '20:00', period: true, ...(db.prefs.reminders || {}) });
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
let pushState = { checked: false, subscribed: false, busy: false }, remTimer = null, remSynced = null;
function fireTime(date, start, remind) {
  const d = parse(date);
  if (remind === 'am0' || remind === 'am1') { d.setHours(9, 0, 0, 0); if (remind === 'am1') d.setDate(d.getDate() - 1); return d; }
  if (!start || remind === '' || remind === undefined) return null;
  const [h, m] = start.split(':').map(Number); d.setHours(h, m, 0, 0);
  return new Date(d - (+remind || 0) * 60e3);
}
function desiredReminders() {
  const P = remPrefs(), now = new Date(), out = [];
  if (!P.on) return out;
  const from = todayS(), to = iso(addDays(new Date(), 35));
  if (P.events) {
    for (const e of db.events) {
      const dates = [];
      if (e.remind) {
        if (!(e.repeat?.skip || []).includes(e.date) && e.date >= iso(addDays(new Date(), -1)) && e.date <= iso(addDays(new Date(), 36))) dates.push(e.date);
        dates.push(...occurrences(e, from, to));
      }
      for (const d of dates) {
        const t = fireTime(d, e.start, e.remind); if (!t || t <= now) continue;
        const cal = db.calendars.find(c => c.id === e.calId);
        const when = e.start ? fmtTime(e.start) : 'today';
        out.push({ id: `ev:${e.id}@${d}`, fire_at: t.toISOString(), title: e.title || 'Event', body: [e.remind === 'am1' ? `Tomorrow${e.start ? ' at ' + fmtTime(e.start) : ''}` : e.start ? `${REMIND_TIMED[e.remind] === 'At the start' ? 'Starting now' : 'At ' + when}` : 'Today', cal?.name].filter(Boolean).join(' · '), url: `/?day=${d}` });
      }
    }
  }
  if (cycleOn()) {
    if (P.checkin) for (let i = 0; i <= 14; i++) {
      const d = iso(addDays(new Date(), i)), [h, m] = (P.checkinTime || '20:00').split(':').map(Number), t = parse(d); t.setHours(h, m, 0, 0);
      if (t > now) out.push({ id: `checkin:${d}`, fire_at: t.toISOString(), title: 'Daily check-in', body: 'How are you feeling today? Tap to log it.', url: `/?day=${d}` });
    }
    if (P.period) {
      const next = cycleInfo(todayS())?.nextStart;
      if (next) { const t = parse(next); t.setDate(t.getDate() - 2); t.setHours(9, 0, 0, 0); if (t > now) out.push({ id: `period:${next}`, fire_at: t.toISOString(), title: 'Cycle', body: `Your period may start in about 2 days (${shortDate(parse(next))}).`, url: `/?day=${next}` }); }
    }
  }
  return out.sort((a, b) => a.fire_at.localeCompare(b.fire_at)).slice(0, 300);
}
const syncRemindersSoon = () => { if (!user) return; clearTimeout(remTimer); remTimer = setTimeout(syncReminders, 2500); };
async function syncReminders() {
  if (!user || !ready) return;
  const want = desiredReminders(), sig = JSON.stringify(want);
  if (sig === remSynced) return;
  try {
    const { data: have, error } = await supa.from('reminders').select('id').eq('user_id', user.id).is('sent_at', null);
    if (error) throw error;
    const keep = new Set(want.map(r => r.id)), drop = (have || []).map(r => r.id).filter(id => !keep.has(id));
    for (let i = 0; i < drop.length; i += 200) { const { error: e2 } = await supa.from('reminders').delete().eq('user_id', user.id).in('id', drop.slice(i, i + 200)); if (e2) throw e2; }
    if (want.length) { const { error: e3 } = await supa.from('reminders').upsert(want.map(r => ({ ...r, user_id: user.id, sent_at: null }))); if (e3) throw e3; }
    remSynced = sig;
  } catch (e) { clearTimeout(remTimer); remTimer = setTimeout(syncReminders, 30000); }
}
async function checkPush() {
  if (!pushSupported()) { pushState.checked = true; return; }
  try { const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription(); pushState = { ...pushState, checked: true, subscribed: !!sub && Notification.permission === 'granted' }; }
  catch (e) { pushState.checked = true; }
  if (view.mode === 'settings') softRender();
}
const b64ToBytes = b => { const s = atob((b + '='.repeat((4 - b.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
async function enablePush() {
  if (!user) { toast('Sign in first so reminders can reach your devices'); return; }
  pushState.busy = true; softRender();
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notifications are blocked. Allow them for Almanac in your browser or phone settings.'); return; }
    const res = await fetch('/api/push-key'); if (!res.ok) { toast('Notifications aren’t set up on the server yet.'); return; }
    const { key } = await res.json();
    const reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    const j = sub.toJSON();
    const { error } = await supa.from('push_subscriptions').upsert({ endpoint: j.endpoint, user_id: user.id, p256dh: j.keys.p256dh, auth: j.keys.auth });
    if (error) throw error;
    db.prefs.reminders = { ...remPrefs(), on: true }; save(); remSynced = null; syncRemindersSoon();
    pushState.subscribed = true; toast('Notifications are on for this device');
  } catch (e) { toast('Couldn’t turn on notifications. Try again.'); }
  finally { pushState.busy = false; softRender(); }
}
async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration(), sub = await reg?.pushManager.getSubscription();
    if (sub) { await supa.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
  } catch (e) {}
  pushState.subscribed = false; softRender(); toast('Notifications are off for this device');
}
async function testPush() {
  if (!user) return;
  const { error } = await supa.from('reminders').upsert({ user_id: user.id, id: 'test:' + Date.now(), fire_at: new Date().toISOString(), title: 'Almanac', body: 'Notifications are working.', url: '/', sent_at: null });
  if (error) { toast('Couldn’t send a test. Try again.'); return; }
  fetch('/api/reminders', { method: 'POST' }).then(r => r.json()).then(j => toast(j.sent ? 'Test sent' : 'Test is on its way')).catch(() => toast('Test is on its way'));
}
function renderReminderSettings() {
  const P = remPrefs();
  let h = `<section class="panel stack"><h2 class="sec" style="margin:0">Reminders</h2>`;
  if (!user) return h + `<p class="muted" style="margin:0">Sign in to get reminders on your phone and computer.</p></section>`;
  if (!pushSupported()) h += `<p class="muted" style="margin:0">${isIOS() && !standalone() ? 'On iPhone, add Almanac to your Home Screen first (Share → Add to Home Screen), then open it from there to turn on notifications.' : 'This browser can’t show notifications.'}</p>`;
  else if (!pushState.subscribed) h += setRow('Notifications on this device', isIOS() && !standalone() ? 'On iPhone, open Almanac from your Home Screen to turn these on.' : 'Each phone or computer you use needs this once.', `<button class="btn primary" data-act="push-on"${pushState.busy ? ' disabled' : ''}>${pushState.busy ? 'Turning on…' : 'Turn on'}</button>`);
  else h += setRow('Notifications on this device', 'On. Reminders also go to any other device you turned on.', `<span class="m-row"><button class="btn" data-act="push-test">Send a test</button><button class="btn ghost" data-act="push-off">Turn off</button></span>`);
  if (P.on) {
    h += setRow('Event reminders', 'Choose “Remind me” on any event.', seg('rem-events', P.events ? 'on' : 'off', [['on', 'On'], ['off', 'Off']]));
    if (cycleOn()) {
      h += setRow('Daily check-in nudge', 'A reminder to log how you feel.', `<span class="m-row">${P.checkin ? `<input type="time" id="rem-ctime" value="${esc(P.checkinTime)}" aria-label="Nudge time">` : ''}${seg('rem-checkin', P.checkin ? 'on' : 'off', [['on', 'On'], ['off', 'Off']])}</span>`);
      h += setRow('Period heads-up', 'About 2 days before your predicted period.', seg('rem-period', P.period ? 'on' : 'off', [['on', 'On'], ['off', 'Off']]));
    }
  }
  return h + '</section>';
}

function curObj() {
  if (view.mode !== 'doc') return null;
  if (view.kind === 'preview') return preview;
  if (view.kind === 'friend') {
    const [fid, date] = String(view.id).split('@'), e = friendEvents().find(x => x.id === fid);
    return e && date ? { ...e, id: view.id, date, _occ: e.id, ...(e.format === 'bill' ? { data: { ...e.data, paid: '' } } : {}) } : e;
  }
  if (view.kind === 'feed') return feedEvents().find(x => x.id === view.id);
  return (view.kind === 'saved' ? db.saved : db.events).find(x => x.id === view.id);
}
let toastT;
function toast(msg, action) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  if (action) { const b = document.createElement('button'); b.className = 'toast-act'; b.dataset.act = action.act; b.textContent = action.label; t.append(b); }
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), action ? 8000 : 2400);
}

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

/* ---------- progress (workouts, opened on demand) ---------- */
const PROG_RANGES = { '3m': ['3 months', 13], '6m': ['6 months', 26], '1y': ['1 year', 52], all: ['All time', 0] };
const exKey = x => x.exId ? 'id:' + x.exId : 'n:' + String(x.name || '').trim().toLowerCase();
const progInfo = x => { const i = exInfo(x); return { key: exKey(x), name: i.name, kind: i.kind, muscle: i.muscle }; };
const PROG_METRICS = {
  weight: [['top', 'Heaviest'], ['best1rm', 'Est. 1-rep max'], ['volume', 'Volume']],
  reps: [['maxReps', 'Most reps'], ['volume', 'Total reps']],
  cardio: [['distance', 'Distance']],
  time: [],
};
const RECORD_FIELD = { top: 'top', best1rm: 'best1rm', volume: 'volume', maxReps: 'maxReps', distance: 'distance' };
let prog = { range: '6m', ex: '', metric: '', wk: 'volume' };
const fmtNum = n => (Math.round(n * 10) / 10).toLocaleString();
function recText(h, f, v) {
  if (!v) return '—';
  if (f === 'top') return `${fmtNum(v.value)} ${db.unit} × ${v.reps}`;
  if (f === 'maxReps' || (f === 'volume' && h.kind === 'reps')) return `${fmtNum(v.value)} reps`;
  if (f === 'distance') return fmtNum(v.value);
  return `${fmtNum(v.value)} ${db.unit}`;
}
const metricText = (h, f, s) => f === 'top' ? `${fmtNum(s.top)} ${db.unit} × ${s.topReps}` : recText(h, f, { value: s[f] });
// A line chart: the line is SVG, the dots and labels are HTML so they stay round and readable at any width.
function lineChart(pts, h, f) {
  const xs = pts.map(p => parse(p.date).getTime()), x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
  const padY = (y1 - y0) * 0.2 || Math.max(1, y1 * 0.1); y0 = Math.max(0, y0 - padY); y1 += padY;
  const X = t => x1 === x0 ? 50 : 3 + (t - x0) / (x1 - x0) * 94, Y = v => 4 + (1 - (v - y0) / (y1 - y0)) * 92;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(2)} ${Y(p.y).toFixed(2)}`).join(' ');
  return `<div class="lc"><div class="lc-y">${[y1, (y0 + y1) / 2, y0].map(v => `<span style="top:${Y(v)}%">${fmtNum(v)}</span>`).join('')}</div>
    <div class="lc-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${[y1, (y0 + y1) / 2, y0].map(v => `<line x1="0" x2="100" y1="${Y(v)}" y2="${Y(v)}" class="lc-g"/>`).join('')}<path d="${d}"/></svg>
    ${pts.map((p, i) => `<button class="lc-pt${p.pr ? ' pr' : ''}" style="left:${X(xs[i])}%;top:${Y(p.y)}%" data-act="open" data-id="${p.id}" title="${esc(shortDate(parse(p.date)))}: ${esc(p.label)}${p.pr ? ' (record)' : ''}" aria-label="${esc(shortDate(parse(p.date)))}: ${esc(p.label)}"></button>`).join('')}</div>
    <div class="lc-x"><span>${shortDate(parse(pts[0].date))}</span>${pts.length > 1 ? `<span>${shortDate(parse(pts[pts.length - 1].date))}</span>` : ''}</div></div>`;
}
function weekBars(list) {
  const k = prog.wk, val = w => w[k], max = Math.max(1, ...list.map(val)), every = Math.ceil(list.length / 6), now = Prog.weekOf(todayS());
  const unit = k === 'volume' ? db.unit : k === 'sets' ? 'sets' : 'workouts';
  return `<div class="wb" style="--n:${list.length}">${list.map(w => `<div class="wb-c${w.week === now ? ' now' : ''}" title="Week of ${shortDate(parse(w.week))}: ${val(w).toLocaleString()} ${unit}"><i style="height:${Math.max(val(w) ? 2 : 0, val(w) / max * 100)}%"></i></div>`).join('')}</div>
    <div class="wb wb-x" style="--n:${list.length}">${list.map((w, i) => `<span>${i % every === 0 ? shortDate(parse(w.week)) : ''}</span>`).join('')}</div>`;
}
function renderProgress() {
  const today = todayS(), hist = Prog.history(db.events, progInfo);
  let h = `<div class="page prog"><h1>Progress</h1><p class="lede">Built from the sets you tick off in your workouts. Warm-up sets count toward volume but not toward records.</p>`;
  if (!hist.length) return h + `<div class="empty">No finished sets yet. Open a workout and tick ✓ next to each set as you finish it. Your weights, records and weekly volume will show up here.</div></div>`;
  const firstDate = hist.reduce((m, x) => x.sessions[0].date < m ? x.sessions[0].date : m, today);
  const weeksN = PROG_RANGES[prog.range][1] || Math.min(156, Math.max(4, Math.ceil(daysBetween(Prog.weekOf(firstDate), today) / 7) + 1));
  const wk = Prog.weekly(db.events, progInfo, weeksN, today), from = wk[0].week;
  const tot = wk.reduce((t, w) => ({ workouts: t.workouts + w.workouts, sets: t.sets + w.sets, volume: t.volume + w.volume }), { workouts: 0, sets: 0, volume: 0 });
  h += `<div class="prog-top">${seg('prog-range', prog.range, Object.entries(PROG_RANGES).map(([k, [n]]) => [k, n]))}</div>
    <div class="tiles"><div><span>Workouts</span><b>${tot.workouts}</b></div><div><span>Sets</span><b>${tot.sets.toLocaleString()}</b></div><div><span>Volume</span><b>${tot.volume.toLocaleString()} ${db.unit}</b></div></div>`;
  h += `<section class="panel prog-sec"><div class="prog-h"><h2>Weekly ${{ volume: 'volume', sets: 'sets', workouts: 'workouts' }[prog.wk]}</h2>${seg('prog-wk', prog.wk, [['volume', 'Volume'], ['sets', 'Sets'], ['workouts', 'Workouts']])}</div>
    ${weekBars(wk)}<p class="muted">This week: ${wk[wk.length - 1][prog.wk].toLocaleString()} ${prog.wk === 'volume' ? db.unit : prog.wk}. Weekly average: ${Math.round(wk.reduce((t, w) => t + w[prog.wk], 0) / wk.length).toLocaleString()}.</p></section>`;

  const sorted = [...hist].sort((a, b) => b.sessions.length - a.sessions.length || a.name.localeCompare(b.name));
  const cur = hist.find(x => x.key === prog.ex) || sorted[0];
  const metrics = PROG_METRICS[cur.kind] || [], metric = metrics.some(([k]) => k === prog.metric) ? prog.metric : metrics[0]?.[0];
  const rec = Prog.records(cur), prDates = new Set(rec.broken.filter(b => b.field === RECORD_FIELD[metric]).map(b => b.eventId));
  const inRange = cur.sessions.filter(s => s.date >= from);
  h += `<section class="panel prog-sec"><div class="prog-h"><h2>By exercise</h2><label class="field prog-pick"><span class="sr">Exercise</span><select id="prog-ex">${sorted.map(x => `<option value="${esc(x.key)}"${x === cur ? ' selected' : ''}>${esc(x.name)} (${x.sessions.length})</option>`).join('')}</select></label></div>`;
  if (metrics.length > 1) h += seg('prog-metric', metric, metrics);
  const pts = metric ? inRange.filter(s => s[metric] > 0).map(s => ({ date: s.date, y: s[metric], id: s.eventId, label: metricText(cur, metric, s), pr: prDates.has(s.eventId) })) : [];
  if (!metric) h += `<p class="muted">Charts for timed exercises are coming later. Your sessions are listed below.</p>`;
  else if (pts.length) h += lineChart(pts, cur, metric) + (prDates.size ? `<p class="muted lc-key"><i class="lc-dot pr"></i> New record</p>` : '');
  else h += `<p class="muted">No ${esc(cur.name)} sessions in this time range.</p>`;
  const tiles = cur.kind === 'weight' ? [['Heaviest set', 'top'], ['Est. 1-rep max', 'best1rm'], ['Best session volume', 'volume']] : cur.kind === 'reps' ? [['Most reps in a set', 'maxReps'], ['Most reps in a session', 'volume']] : cur.kind === 'cardio' ? [['Longest distance', 'distance']] : [];
  h += `<div class="tiles recs">${tiles.map(([n, f]) => `<div><span>${n}</span><b>${esc(recText(cur, f, rec[f]))}</b>${rec[f] ? `<em>${shortDate(parse(rec[f].date))}</em>` : ''}</div>`).join('')}<div><span>Sessions</span><b>${cur.sessions.length}</b><em>since ${shortDate(parse(cur.sessions[0].date))}</em></div></div>`;
  const recent = cur.sessions.slice(-6).reverse();
  h += `<h3 class="prog-sub">Recent sessions</h3><div class="prog-list">${recent.map(s => `<button data-act="open" data-id="${s.eventId}"><span>${shortDate(parse(s.date))}</span><b>${esc(cur.kind === 'weight' && s.top ? `${fmtNum(s.top)} ${db.unit} × ${s.topReps}` : cur.kind === 'reps' ? `${s.maxReps} reps` : cur.kind === 'cardio' && s.distance ? fmtNum(s.distance) : '')}</b><em>${s.sets} set${s.sets === 1 ? '' : 's'}${cur.kind === 'weight' && s.volume ? ` · ${Math.round(s.volume).toLocaleString()} ${db.unit}` : ''}</em></button>`).join('')}</div></section>`;

  const broken = hist.flatMap(x => Prog.records(x).broken.filter(b => b.field !== 'volume').map(b => ({ ...b, x }))).filter(b => b.date >= iso(addDays(new Date(), -30))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const label = { top: 'Heaviest', best1rm: 'Est. 1-rep max', maxReps: 'Most reps', distance: 'Distance' };
  h += `<section class="panel prog-sec"><h2>Personal records</h2>`;
  if (broken.length) h += `<h3 class="prog-sub">New in the last 30 days</h3><div class="prog-list prs">${broken.map(b => `<button data-act="open" data-id="${b.eventId}"><span>${shortDate(parse(b.date))}</span><b>${esc(b.x.name)}</b><em>${label[b.field]} ${esc(recText(b.x, b.field, b))}, up from ${esc(recText(b.x, b.field, { value: b.before, reps: b.beforeReps }))}</em></button>`).join('')}</div>`;
  h += `<div class="prog-tbl" role="table"><div class="pt-r h" role="row"><span role="columnheader">Exercise</span><span role="columnheader">Best</span><span role="columnheader">Est. 1RM</span><span role="columnheader">Set on</span></div>${sorted.map(x => {
    const r = Prog.records(x), main = x.kind === 'weight' ? 'top' : x.kind === 'reps' ? 'maxReps' : x.kind === 'cardio' ? 'distance' : null, best = main && r[main];
    return `<button class="pt-r${x === cur ? ' on' : ''}" role="row" data-act="prog-ex" data-key="${esc(x.key)}"><span role="cell">${esc(x.name)}</span><span role="cell">${best ? esc(recText(x, main, best)) : '—'}</span><span role="cell">${r.best1rm ? esc(recText(x, 'best1rm', r.best1rm)) : '—'}</span><span role="cell">${best ? shortDate(parse(best.date)) : ''}</span></button>`;
  }).join('')}</div></section>`;
  return h + '</div>';
}

/* ---------- bills ---------- */
const amountOf = v => parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')) || 0;
const money = v => { const n = typeof v === 'number' ? v : amountOf(v); return n || String(v ?? '').trim() ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : ''; };
// Every bill in a month (repeating bills included), from calendars that are showing.
function monthBills(y, mo, map = byDate()) {
  const out = [], last = new Date(y, mo + 1, 0).getDate();
  for (let d = 1; d <= last; d++) for (const e of map[iso(new Date(y, mo, d))] || []) if (e.format === 'bill' && !e._friend) out.push(e);
  const total = out.reduce((t, e) => t + amountOf(e.data.amount), 0), paid = out.filter(e => e.data.paid === 'yes'), left = out.filter(e => e.data.paid !== 'yes');
  return { list: out, total, paid: paid.reduce((t, e) => t + amountOf(e.data.amount), 0), left };
}
let billsOpen = false;
function billsBar(y, mo, map) {
  const b = monthBills(y, mo, map); if (!b.list.length) return '';
  const next = b.left.find(e => e.date >= todayS()) || b.left[0];
  return `<section class="bills"><button class="bills-h" data-act="bills-toggle" aria-expanded="${billsOpen}"><span class="bills-t">${icon('bill')}${MONTHS[mo]} bills</span><span class="bills-n"><b>${money(b.total)}</b> · ${money(b.paid)} paid · ${b.left.length ? `${b.left.length} left${next ? `, next ${esc(next.title || 'bill')} ${shortDate(parse(next.date))}` : ''}` : 'all paid'}</span><span class="bills-c">${billsOpen ? 'Hide' : 'Show all'}</span></button>
    ${billsOpen ? `<div class="bills-l">${b.list.map(e => `<button data-act="open" data-id="${e.id}" class="${e.data.paid === 'yes' ? 'paid' : ''}" style="--c:${okColor(calOf(e).color)}"><span>${shortDate(parse(e.date))}</span><b>${esc(e.title || 'Bill')}</b><em>${e.data.paid === 'yes' ? 'Paid' : e.data.autopay === 'yes' ? 'Autopay' : ''}</em><span>${money(e.data.amount)}</span></button>`).join('')}</div>` : ''}</section>`;
}

/* ---------- summaries ---------- */
function summary(e) {
  const d = e.data || {};
  if (e._feed) return [e.location, (d.notes || '').split('\n')[0]].filter(Boolean).join(' · ');
  switch (e.format) {
    case 'workout': { const s = wStats(e); const n = d.exercises.length; return n ? `${n} exercise${n > 1 ? 's' : ''} · ${s.tot} sets${s.done ? ` · ${s.done} done` : ''}` : ''; }
    case 'birthday': return [d.person && (d.person + (d.turning ? ` turns ${d.turning}` : '')), d.gifts.length && `${d.gifts.length} gift idea${d.gifts.length > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
    case 'class': { const open = d.tasks.filter(t => !t.done).length; return [d.code, d.room, open && `${open} assignment${open > 1 ? 's' : ''} open`].filter(Boolean).join(' · '); }
    case 'bill': return [money(d.amount), d.paid === 'yes' ? 'Paid' : d.autopay === 'yes' ? 'Autopay' : 'Not paid yet'].filter(Boolean).join(' · ');
    case 'trip': return [d.from && d.to && `${d.from.toUpperCase()} → ${d.to.toUpperCase()}`, d.stay].filter(Boolean).join(' · ');
    default: {
      const cf = customOf(e.format);
      if (cf) { for (const b of cf.blocks) { if (b.type === 'yesno') continue; const v = d[b.id]; if (typeof v === 'string' && v.trim()) return v.split('\n')[0]; } return ''; }
      return (d.notes || '').split('\n')[0];
    }
  }
}

/* ---------- header ---------- */
function renderSub() {
  for (const m of ['year', 'week', 'day', 'library', 'progress', 'calendars', 'friends', 'settings']) $('m-' + m).setAttribute('aria-pressed', view.mode === m || (m === 'library' && view.mode === 'builder'));
  if (!['year', 'week', 'day'].includes(view.mode)) { $('sub').hidden = true; return; }
  $('sub').hidden = false;
  const d = parse(view.date);
  let title = '';
  if (view.mode === 'year') title = `<small>Year</small>${d.getFullYear()}`;
  if (view.mode === 'week') { const ws = startOfWeek(d), we = addDays(ws, 6); title = `<small>Week ${isoWeek(ws)}</small>${shortDate(ws)} – ${shortDate(we)}, ${we.getFullYear()}`; }
  if (view.mode === 'day') title = `<small>Week ${isoWeek(d)}</small>${longDate(d)}`;
  let h = `<h1>${title}</h1><div class="navs"><button class="btn icon" data-act="nav" data-dir="-1" aria-label="Previous">‹</button><button class="btn" data-act="today">Today</button><button class="btn icon" data-act="nav" data-dir="1" aria-label="Next">›</button></div>`;
  h += `<div class="legend" aria-label="Show calendars">` + db.calendars.map(c => `<button data-act="cal-toggle" data-id="${c.id}" aria-pressed="${!c.hidden}" style="--c:${okColor(c.color)}"><span class="dot"></span>${esc(c.name || 'Untitled')}</button>`).join('') + friendCals().map(c => `<button data-act="fcal-toggle" data-id="${c.id}" aria-pressed="${!c.hidden}" style="--c:${okColor(c.color)}"><span class="dot"></span>${esc(firstName(c.owner))} · ${esc(c.name)}</button>`).join('') + feedCals().map(c => `<button data-act="feed-toggle" data-id="${c.feed.id}" aria-pressed="${!c.hidden}" style="--c:${okColor(c.color)}"><span class="dot"></span>${esc(c.name)}</button>`).join('') + `<button data-act="hol-toggle" aria-pressed="${holidaysOn()}" style="--c:${HOLIDAY_COLOR}"><span class="dot"></span>Holidays</button>${user && friendIds().length ? `<button data-act="bday-toggle" aria-pressed="${birthdaysOn()}" style="--c:${BDAY_COLOR}"><span class="dot"></span>Birthdays</button>` : ''}</div>`;
  $('sub').innerHTML = h;
}
const onboarding = () => db.calendars.length ? '' : `<div class="banner"><div><h2>Make your first calendar</h2><p>Calendars hold your events, like Workouts, School or Family. You choose the name, the color and which Library format its events use.</p></div><button class="btn primary" data-act="mode" data-mode="calendars">Create a calendar</button></div>`;

/* ---------- year / week / day ---------- */
function renderYear() {
  const y = parse(view.date).getFullYear(), map = byDate(), hol = specialDays(), t = todayS(), now = new Date();
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
        const dots = (hs.length ? `<i class="${hs[0].predicted ? 'pred' : ''}" style="--c:${hs[0].kind === 'cycle' ? CYCLE_COLOR : hs.some(x => x.kind === 'hol') ? HOLIDAY_COLOR : BDAY_COLOR}"></i>` : '') + evs.slice(0, hs.length ? 2 : 3).map(e => `<i style="--c:${okColor(calOf(e).color)}"></i>`).join('');
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
const chip = e => `<button class="chip" data-act="open" data-id="${e.id}" style="--c:${okColor(calOf(e).color)}"><span class="t">${icon(e.format)}${e.start ? fmtTime(e.start) : 'Any time'}${isRep(e) ? REP_IC : ''}</span><span class="n">${e._friend ? `<em class="who">${esc(firstName(e._friend))}</em> ` : ''}${esc(e.title || 'Untitled')}</span></button>`;
function renderWeek() {
  const ws = startOfWeek(parse(view.date)), map = byDate(), hol = specialDays(), t = todayS(), vd = parse(view.date);
  let h = onboarding() + billsBar(vd.getFullYear(), vd.getMonth(), map) + '<div class="week">';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), s = iso(d);
    h += `<div class="wday${s === t ? ' today' : ''}"><button class="wday-h" data-act="day" data-date="${s}" aria-label="Open ${esc(longDate(d))}"><b>${d.getDate()}</b><span>${WD[i]}${d.getDate() === 1 || i === 0 ? ' · ' + MONTHS[d.getMonth()].slice(0, 3) : ''}</span></button><div class="wday-l">${(hol[s] || []).map(specialChip).join('')}${(map[s] || []).map(chip).join('')}<button class="add-mini" data-act="new" data-date="${s}">+ Add</button></div></div>`;
  }
  return h + '</div>';
}
function renderDay() {
  const s = view.date, evs = byDate()[s] || [], hs = specialDays()[s] || [];
  let h = onboarding() + '<div class="day">';
  if (hs.length) h += `<div class="hol-day">${hs.map(specialChip).join('')}</div>`;
  h += cycleCard(s);
  if (db.calendars.length) h += '<div class="quick">' + db.calendars.map(c => `<button class="btn" data-act="new" data-cal="${c.id}" data-date="${s}" style="--c:${okColor(c.color)}"><span class="dot"></span>+ ${esc(c.name || 'Untitled')}</button>`).join('') + '</div>';
  if (!evs.length) h += `<div class="empty">Nothing planned for this day.${db.calendars.length ? ' Add something with the buttons above.' : ''}</div>`;
  for (const e of evs) {
    const c = calOf(e), sm = summary(e);
    h += `<button class="card" data-act="open" data-id="${e.id}" style="--c:${okColor(c.color)}"><div class="time">${e.start ? `<b>${fmtTime(e.start)}</b>${e.end ? fmtTime(e.end) : ''}` : '<b>Any time</b>'}</div><div style="min-width:0"><h4>${esc(e.title || 'Untitled')}</h4>${sm ? `<p>${esc(sm)}</p>` : ''}${isRep(e) ? `<p class="rep-line">${REP_IC}${esc(repeatText(e._occ ? db.events.find(x => x.id === e._occ) || e : e))}</p>` : ''}</div><span class="tag">${icon(e.format)}${e._friend ? esc(firstName(e._friend)) + ' · ' : ''}${esc(c.name)}</span></button>`;
  }
  return h + renderNews(s) + '</div>';
}

/* ---------- news (live top stories, loaded every time the app opens) ---------- */
let news = {}, newsLoading = false, newsCheckedAt = 0;
const safeUrl = u => /^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? u : null;
const newsOn = () => db.prefs.news !== false;
async function loadNews(force) {
  if (!newsOn() || newsLoading) return;
  newsLoading = true; if (force && view.mode === 'day') softRender();
  try {
    const res = await fetch('/api/news' + (force ? '?t=' + Date.now() : ''), { cache: force ? 'no-store' : 'default' });
    const v = res.ok ? await res.json() : null;
    if (v && Array.isArray(v.items) && v.items.length) { news = { ...news, [todayS()]: { date: todayS(), items: v.items, generated_at: v.generated_at } }; newsCheckedAt = Date.now(); }
  } catch (e) {}
  newsLoading = false;
  if (view.mode === 'day') softRender();
}
function renderNews(s) {
  if (!newsOn()) return '';
  const n = news[s], t = todayS();
  const when = n?.generated_at ? `Updated ${esc(new Date(n.generated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}` : '';
  const head = `<header><div><span class="eyebrow">News</span><h3>${s === t ? 'Today’s news' : 'News for ' + shortDate(parse(s))}</h3></div><div class="news-act"><span class="muted">${newsLoading ? 'Checking for news…' : when}</span><button class="btn" data-act="news-refresh"${newsLoading ? ' disabled' : ''}>Refresh</button></div></header>`;
  if (!n || !Array.isArray(n.items) || !n.items.length) {
    const msg = s > t ? 'News for this day shows up that day.' : s === t ? (newsLoading ? 'Loading the latest news…' : 'Couldn’t load the news just now. Tap Refresh to try again.') : 'News is only kept for today.';
    return `<section class="news">${head}<p class="muted" style="margin:0">${msg}</p></section>`;
  }
  return `<section class="news">${head}<div class="news-grid">` + n.items.map(it => `<article class="news-i"><span class="topic">${esc(it.topic)}</span><h4>${esc(it.headline)}</h4><p>${esc(it.summary)}</p>${Array.isArray(it.sources) && it.sources.length ? `<div class="src">${it.sources.map(x => safeUrl(x.url) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.name || 'Source')}</a>` : `<span>${esc(x.name)}</span>`).join('')}</div>` : ''}</article>`).join('') + `</div><p class="muted news-foot">The latest top stories from the outlets linked. Updated every time you open Almanac.</p></section>`;
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
  let h = `<div class="page"><h1>Calendars</h1><p class="lede">Each calendar has its own color and a default format from the Library. New events in that calendar open in that format, and you can switch any single event to another one.</p>
  ${db.calendars.length ? `<p class="muted im-hint">To fill a calendar from a spreadsheet, choose <b>Import from Excel</b> or drag an .xlsx or .csv file onto it. Workouts use the columns Date, Exercise, Sets, Reps, Weight; other calendars use Date, Title, Time, Notes. Sample sheets: <button class="linkish" data-act="sample" data-kind="workout">workouts</button>, <button class="linkish" data-act="sample" data-kind="events">other calendars</button>.</p>` : ''}<div class="stack">`;
  for (const c of db.calendars) {
    const n = db.events.filter(e => e.calId === c.id).length;
    h += `<div class="panel calrow" style="--c:${okColor(c.color)}" data-drop-cal="${c.id}"><div class="fields">
      <label class="field" style="flex:1 1 180px"><span>Name</span><input data-cal="${c.id}" data-cf="name" value="${esc(c.name)}" placeholder="Calendar name"></label>
      <label class="field" style="flex:1 1 140px"><span>Default format</span><select data-cal="${c.id}" data-cf="format">${fmtOpts(c.format)}</select></label>
      <div class="field"><span>Color</span><div class="swatches">${SWATCHES.map(s => `<button class="sw" style="--c:${s}" data-act="cal-color" data-id="${c.id}" data-color="${s}" aria-pressed="${s === c.color}" aria-label="Color ${s}"></button>`).join('')}</div></div>
    </div><div class="grp" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="muted">${n} event${n === 1 ? '' : 's'}</span>
      <label class="btn">Import from Excel<input type="file" data-imp-cal="${c.id}" accept="${IMPORT_ACCEPT}" hidden></label>
      <span class="share-ctl" title="Who can see this calendar">${seg('share', c.sharing === 'friends' ? 'friends' : 'private', [['private', 'Private'], ['friends', 'Friends']]).replaceAll('data-act="share"', `data-act="share" data-id="${c.id}"`)}</span>
      ${confirmCal === c.id ? `<button class="btn" data-act="cal-del-cancel">Keep</button><button class="btn danger solid" data-act="cal-del-confirm" data-id="${c.id}">Delete calendar${n ? ` and ${n} event${n > 1 ? 's' : ''}` : ''}</button>` : `<button class="btn danger" data-act="cal-del" data-id="${c.id}">Delete</button>`}
    </div></div>`;
  }
  h += `<div class="panel" style="--c:${newCal.color}"><h2 class="sec" style="margin-top:0">New calendar</h2><div class="stack">
    <div class="m-row" style="align-items:end"><label class="field" style="flex:1 1 220px"><span>Name</span><input id="nc-name" placeholder="e.g. Workouts, School, Family"></label>
    <label class="field" style="flex:1 1 160px"><span>Default format</span><select id="nc-format"><option value="__blank"${newCal.format === '__blank' ? ' selected' : ''}>Blank – design my own</option>${fmtOpts(newCal.format)}</select></label></div>
    <div class="field"><span>Color</span><div class="swatches">${SWATCHES.map(s => `<button class="sw" style="--c:${s}" data-act="nc-color" data-color="${s}" aria-pressed="${s === newCal.color}" aria-label="Color ${s}"></button>`).join('')}</div></div>
    <div><button class="btn primary" data-act="nc-create">Create calendar</button></div></div></div>`;
  return h + '</div>' + renderFeeds() + '</div>';
}

/* ---------- event page ---------- */
function list(o, key, ph, extra = []) {
  return `<div class="list">` + o.data[key].map((it, i) => `<div class="li${it.done ? ' done' : ''}" id="li-${key}-${i}"><input type="checkbox" data-li="${key}.${i}" data-lf="done" ${it.done ? 'checked' : ''} aria-label="Done"><input type="text" class="li-t" id="li-${key}-${i}-t" data-li="${key}.${i}" data-lf="text" value="${esc(it.text)}" placeholder="${ph}">${extra.map(e => `<input type="${e.type || 'text'}" class="li-x" style="width:${e.w}" data-li="${key}.${i}" data-lf="${e.f}" value="${esc(it[e.f] || '')}" placeholder="${e.ph || ''}" aria-label="${e.label}">`).join('')}<button class="li-del" data-act="li-del" data-key="${key}" data-i="${i}" aria-label="Remove">×</button></div>`).join('') + `<button class="li-add" data-act="li-add" data-key="${key}">+ Add</button></div>`;
}
const dfield = (o, f, label, ph = '', extra = '') => `<label class="field"><span>${label}</span><input id="d-${f}" data-d="${f}" value="${esc(o.data[f])}" placeholder="${ph}" ${extra}></label>`;
const notesBlock = (o, label, ph) => `<h2>${label}</h2><textarea class="notes" id="d-notes" data-d="notes" placeholder="${ph}">${esc(o.data.notes)}</textarea>`;

function bodyWorkout(o) {
  const st = wStats(o), isT = view.kind === 'saved';
  let h = workoutCycleBanner(o) + `<div class="w-stats"><div><span>Duration</span><b>${duration(o)}</b></div><div><span>Volume</span><b id="st-vol">${st.vol}</b></div><div><span>Sets</span><b id="st-sets">${isT ? st.tot : `${st.done}/${st.tot}`}</b></div></div>`;
  if (!o.data.exercises.length) h += `<div class="w-empty"><b>No exercises yet</b>Add exercises from your library to plan this workout.</div>`;
  o.data.exercises.forEach((x, ei) => {
    const inf = exInfo(x), [la, lb] = cols(inf.kind), prev = prevSets(x, o);
    const tmpl = ['44px', isT ? null : 'minmax(60px,1fr)', la ? (isT ? '1fr' : '74px') : null, lb ? (isT ? '1fr' : '64px') : null, isT ? null : '44px', '22px'].filter(Boolean).join(' ');
    let n = 0;
    h += `<section class="w-ex"><header><div><h3>${esc(inf.name)}</h3><span>${esc([inf.muscle, inf.equipment].filter(Boolean).join(' · '))}</span></div><span class="w-acts">${view.kind === 'event' ? `<button class="w-x" data-act="prog-ex" data-key="${esc(exKey(x))}">Progress</button>` : ''}<button class="w-x" data-act="ex-remove" data-ei="${ei}">Remove</button></span></header>
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
function bodyBill(o) {
  const d = o.data, yn = (k, label) => `<div class="field"><span>${label}</span><div class="yn" role="group" aria-label="${label}"><button data-act="yn" data-b="${k}" data-v="yes" aria-pressed="${d[k] === 'yes'}">Yes</button><button data-act="yn" data-b="${k}" data-v="no" aria-pressed="${d[k] === 'no'}">No</button></div></div>`;
  const dt = parse(o.date), b = view.kind === 'event' ? monthBills(dt.getFullYear(), dt.getMonth()) : null;
  return `<label class="bill-amt"><span>Amount</span><span class="inrow"><b>$</b><input id="d-amount" data-d="amount" value="${esc(String(d.amount ?? '').replace(/^\s*\$\s*/, ''))}" placeholder="0.00" inputmode="decimal"></span></label>
    <div class="grid2" style="margin-top:14px">${yn('paid', 'Paid?')}${yn('autopay', 'Autopay?')}${dfield(o, 'account', 'Paid from', 'Card or account')}
    <label class="field"><span>Pay online</span><span class="inrow"><input type="url" id="d-link" data-d="link" value="${esc(d.link)}" placeholder="https://">${safeUrl(d.link) ? `<a href="${esc(d.link)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}</span></label></div>
    ${b && b.list.length ? `<div class="bill-month"><span>${MONTHS[dt.getMonth()]} bills</span><b>${money(b.total)}</b><small>${money(b.paid)} paid · ${money(b.total - b.paid)} left</small></div>` : ''}
    ${notesBlock(o, 'Notes', 'Account number, due-date rules, anything to remember…')}`;
}
const bodyNotes = o => `<textarea class="notes" id="d-notes" data-d="notes" style="min-height:320px;margin-top:16px" placeholder="Write anything…">${esc(o.data.notes)}</textarea>`;
const BODIES = { workout: bodyWorkout, birthday: bodyBirthday, class: bodyClass, trip: bodyTrip, bill: bodyBill, notes: bodyNotes };
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
      case 'field': case 'number': case 'date': case 'link': case 'time': {
        const type = b.type === 'date' ? 'date' : b.type === 'link' ? 'url' : b.type === 'time' ? 'time' : 'text';
        group.push(`<label class="field"><span>${lab}</span><span class="inrow"><input type="${type}" id="d-${b.id}" data-d="${b.id}" value="${esc(v)}" placeholder="${ph}" ${b.type === 'number' ? 'inputmode="decimal"' : ''}>${b.type === 'link' && safeUrl(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}</span></label>`);
        break;
      }
      case 'heading': flushGroup(); h += `<h2>${lab}</h2>`; break;
      case 'yesno': group.push(`<div class="field"><span>${lab}</span><div class="yn" role="group" aria-label="${lab}"><button data-act="yn" data-b="${b.id}" data-v="yes" aria-pressed="${v === 'yes'}">Yes</button><button data-act="yn" data-b="${b.id}" data-v="no" aria-pressed="${v === 'no'}">No</button></div></div>`); break;
      case 'choice': { flushGroup(); const opts = choiceOpts(b); h += `<h2>${lab}</h2>${opts.length ? `<div class="pick choice">${opts.map(x => `<button data-act="choose" data-b="${b.id}" data-v="${esc(x)}" aria-pressed="${v === x}">${esc(x)}</button>`).join('')}</div>` : `<p style="color:var(--d-muted)">Add options for this in the format builder.</p>`}`; break; }
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
  const f = { id: uid(), name: name || '', style: 'clean', color: color || SWATCHES[4], blocks: [{ id: uid(), type: 'notes', label: 'Notes', placeholder: '' }], fresh: true };
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
      ${['field', 'notes', 'checklist', 'number', 'link'].includes(b.type) ? `<input id="bbp-${b.id}" data-bb="${i}" data-bbf="placeholder" value="${esc(b.placeholder || '')}" placeholder="Hint text (optional)" aria-label="Hint text">` : ''}
      ${b.type === 'choice' ? `<input id="bbo-${b.id}" data-bb="${i}" data-bbf="options" value="${esc(b.options || '')}" placeholder="Options, separated by commas: Great, Okay, Rough" aria-label="Options">` : ''}</div>`).join('');
  const ideas = cf.fresh ? `<div class="panel ideas"><h2 class="sec" style="margin-top:0">Start from an idea</h2><p class="muted" style="margin:0 0 10px">Pick one to fill in the sections for you, then change anything you like.</p>
      <div class="pick">${IDEAS.map((d, n) => `<button data-act="bf-idea" data-i="${n}" style="--c:${d.color}"><span class="dot"></span>${esc(d.name)}</button>`).join('')}<button data-act="bf-blank">Start blank</button></div></div>` : '';
  return `<div class="page builder"><button class="back-plain" data-act="bf-back">‹ ${view.back.mode === 'calendars' ? 'Calendars' : 'Library'}</button>
    <span class="eyebrow">Format builder</span>
    <input class="bf-name" id="bf-name" data-bf="name" value="${esc(cf.name)}" placeholder="Name this format, e.g. Doctor visit" aria-label="Format name">
    <div class="bf-grid"><div class="bf-side">${ideas}
      <div class="panel stack">
        <div class="field"><span>Style</span><div class="pick">${Object.entries(STYLES).map(([k, s]) => `<button data-act="bf-style" data-v="${k}" aria-pressed="${cf.style === k}">${s.name}</button>`).join('')}</div></div>
        <div class="field"><span>Accent color</span><div class="swatches">${SWATCHES.map(s => `<button class="sw" style="--c:${s}" data-act="bf-color" data-v="${s}" aria-pressed="${s === cf.color}" aria-label="Color ${s}"></button>`).join('')}</div></div>
      </div>
      <div class="panel"><h2 class="sec" style="margin-top:0">Sections</h2>
        <div class="blocks">${blocks || '<p class="muted" style="margin:0">No sections yet. Add some below.</p>'}</div>
        <span class="eyebrow" style="margin:16px 0 8px">Add a section</span>
        <div class="pick">${Object.entries(BLOCKS).map(([k, v]) => `<button data-act="bf-add" data-type="${k}" title="${esc(BLOCK_TIPS[k])}">+ ${v.label}</button>`).join('')}</div>
      </div>
      <div class="m-row"><button class="btn primary" data-act="new" data-fmt="c:${cf.id}">Use for an event</button>
        ${confirmFmt ? `<button class="btn" data-act="bf-delete-cancel">Keep</button><button class="btn danger solid" data-act="bf-delete-confirm">Delete format${used ? ` (${used} event${used > 1 ? 's' : ''} switch to Notes)` : ''}</button>` : `<button class="btn danger" data-act="bf-delete">Delete format</button>`}</div>
      <p class="muted" style="margin:0">Changes save automatically. Events already using this format update to match.</p>
    </div>
    <div class="bf-prev-wrap"><span class="eyebrow" style="margin-bottom:8px">Live preview</span><div id="bf-prev" inert>${builderPreview(cf)}</div></div></div></div>`;
}

function renderFriendDoc(o) {
  const c = calOf(o), f = o.format, cf = friendFormat(o, f), master = o._occ ? friendEvents().find(x => x.id === o._occ) : o;
  const skin = cf ? `custom ${STYLES[cf.style]?.skin || ''}` : `fmt-${FORMATS[f] ? f : 'notes'}`;
  const back = { year: 'Year', week: 'Week', day: 'Day', friends: 'Friends' }[view.back.mode] || 'Week';
  const when = [longDate(parse(o.date)), o.start ? fmtTime(o.start) + (o.end ? ' – ' + fmtTime(o.end) : '') : ''].filter(Boolean).join(' · ');
  let body;
  if (cf) body = bodyCustom(o, cf);
  else if (BODIES[f]) body = BODIES[f](o);
  else body = bodyNotes({ ...o, data: { notes: o.data?.notes || '' } });
  return `<article class="doc ${skin} ro-doc" style="--c:${okColor(c?.color || '#4263eb')}${cf ? `;--d-accent:${okColor(cf.color)}` : ''}">
    <div class="doc-top"><button class="back" data-act="back">‹ ${back}</button><span class="eyebrow">${icon(f)}${esc(personName(o._friend))}’s ${esc(c?.name || 'calendar')}</span></div>
    <h1 class="ttl ro">${esc(o.title || 'Untitled')}</h1>
    <p class="ro-when">${esc(when)}${master?.repeat ? ` · ${esc(repeatText(master))}` : ''}</p>
    <fieldset class="ro" disabled>${body}</fieldset>
    <p class="ro-note">You’re viewing ${esc(firstName(o._friend))}’s calendar. Only they can change it.</p></article>`;
}
function renderDoc() {
  const o = curObj();
  if (!o) { view = { mode: 'week', date: view.date }; return renderWeek(); }
  if (view.kind === 'friend') return renderFriendDoc(o);
  if (view.kind === 'feed') return renderFeedDoc(o);
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
      ${k === 'event' ? `<label class="field"><span>Remind me</span><select id="f-remind" data-f="remind">${Object.entries(o.start ? REMIND_TIMED : REMIND_ALLDAY).map(([v, n]) => `<option value="${v}"${String(o.remind || '') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
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
    bill: { title: 'Rent', start: '', end: '', data: { amount: '1450', paid: 'yes', autopay: 'no', account: 'Checking', link: '', notes: 'Due on the 1st. Late after the 5th.' } },
    notes: { title: 'Ideas for October', start: '', end: '', data: { notes: 'Try a new hike every weekend.\nSign up for the 10K.\nCall grandma on Sundays.' } },
  }[f];
  return { id: 'preview', calId: null, format: f, date, ...D, data: { ...blankData(f), ...D.data } };
}

/* ---------- modal ---------- */
function renderModal() {
  const el = $('modal');
  if (!modal) { el.hidden = true; return; }
  el.hidden = false;
  $('sheet').innerHTML = modal.type === 'new' ? renderNew() : modal.type === 'import' ? renderImport() : renderPicker();
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

/* ---------- import from Excel or CSV ---------- */
const IMPORT_ACCEPT = '.xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';
const importKind = cal => cal?.format === 'workout' ? 'workout' : 'events';
let lastImport = null;
async function startImport(file, calId) {
  if (!file) return;
  if (!db.calendars.length) { modal = { type: 'import', none: true }; renderModal(); return; }
  modal = { type: 'import', busy: true, fileName: file.name }; renderModal();
  try {
    const { sheets } = await readTable(file);
    const usable = sheets.filter(sh => sh.rows.length);
    if (!usable.length) throw Object.assign(new Error('empty'), { code: 'empty' });
    let cal = db.calendars.find(c => c.id === calId);
    if (!cal) {   // dropped anywhere: pick a calendar from what the sheet looks like
      const looksWorkout = prepare(usable[0].rows, 'workout').map.exercise !== undefined;
      const fits = c => (importKind(c) === 'workout') === looksWorkout;
      cal = db.calendars.find(c => !c.hidden && fits(c)) || db.calendars.find(fits) || db.calendars[0];
    }
    modal = { type: 'import', fileName: file.name, sheets: usable, sheet: 0, calId: cal.id, skipDupes: true };
    prepImport();
  } catch (e) {
    modal = null;
    toast(e?.code === 'old-xls' ? 'That’s an old .xls file. In Excel, choose Save As → .xlsx, then try again.' : e?.code === 'empty' ? 'That sheet looks empty' : 'Couldn’t read that file. Use an .xlsx or .csv file.');
  }
  renderModal();
}
function prepImport() {
  const cal = db.calendars.find(c => c.id === modal.calId), kind = importKind(cal);
  Object.assign(modal, { kind }, prepare(modal.sheets[modal.sheet].rows, kind));
}
function importPlan() {
  const m = modal, cal = db.calendars.find(c => c.id === m.calId);
  if (FIELDS[m.kind].some(([f, , req]) => req && m.map[f] === undefined)) return null;
  return m.kind === 'workout'
    ? planWorkouts(m, { cal, db, today: todayS(), uid, skipDupes: m.skipDupes, starter: STARTER.map(([name, muscle, equipment, kind]) => ({ name, muscle, equipment, kind: kind || 'weight' })) })
    : planEvents(m, { cal, db, uid, blankData, skipDupes: m.skipDupes, notesKey: (f, d) => 'notes' in d ? 'notes' : customOf(f)?.blocks.find(b => b.type === 'notes')?.id || null });
}
const rangeText = r => r ? (r[0] === r[1] ? shortDate(parse(r[0])) : `${shortDate(parse(r[0]))} – ${shortDate(parse(r[1]))}${r[0].slice(0, 4) !== r[1].slice(0, 4) ? ' ' + r[1].slice(0, 4) : ''}`) : '';
function importPreviewLine(e) {
  const when = `${parse(e.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${e.start ? ' · ' + fmtTime(e.start) : ''}`;
  const what = e.format === 'workout' ? e.data.exercises.map(x => { const s = x.sets[0]; return `${x.name} ${x.sets.length}×${s?.b || '?'}${s?.a ? ` @ ${s.a}` : ''}`; }).join(', ') : (e.data.notes || '');
  return `<li><b>${esc(when)}</b><span>${esc(e.title || 'Untitled')}</span>${what ? `<small>${esc(what)}</small>` : ''}</li>`;
}
function renderImport() {
  const m = modal;
  if (m.none) return `<h2>Create a calendar first</h2><p>Imported events go onto one of your calendars. Make one, like “Workouts” or “Family”, then import again.</p><div class="m-actions"><button class="btn" data-act="m-close">Cancel</button><button class="btn primary" data-act="mode" data-mode="calendars">Create a calendar</button></div>`;
  if (m.busy) return `<h2>Reading ${esc(m.fileName || 'your file')}…</h2>`;
  const cal = db.calendars.find(c => c.id === m.calId), plan = importPlan(), workout = m.kind === 'workout';
  const opts = cur => `<option value="">Not in this sheet</option>` + m.headers.map((h, i) => `<option value="${i}"${i === cur ? ' selected' : ''}>${esc(h)}</option>`).join('');
  let h = `<h2>Import ${esc(m.fileName)}</h2>
    <div class="field"><span>Add to calendar</span><div class="pick">${db.calendars.map(c => `<button data-act="im-cal" data-id="${c.id}" aria-pressed="${c.id === m.calId}" style="--c:${okColor(c.color)}"><span class="dot"></span>${esc(c.name || 'Untitled')}</button>`).join('')}</div></div>
    ${m.sheets.length > 1 ? `<label class="field"><span>Sheet</span><select id="im-sheet">${m.sheets.map((sh, i) => `<option value="${i}"${i === m.sheet ? ' selected' : ''}>${esc(sh.name)}</option>`).join('')}</select></label>` : ''}
    <div class="field"><span>Columns</span><p class="muted" style="margin:0 0 6px">${workout ? `${esc(cal.name)} uses Workout pages, so each date becomes one workout. Rows can be one per exercise (with a Sets count) or one per set.` : 'Each row becomes one event.'} Check these match your sheet.</p>
    <div class="im-map">${FIELDS[m.kind].map(([f, label, req]) => `<label><span>${label}${req ? ' <em>required</em>' : ''}</span><select data-im="${f}">${opts(m.map[f])}</select></label>`).join('')}</div></div>`;
  if (!plan) {
    const miss = FIELDS[m.kind].filter(([f, , req]) => req && m.map[f] === undefined).map(([, l]) => l);
    h += `<p class="im-warn">Choose which column has the ${miss.join(' and ').toLowerCase()}.</p>`;
  } else {
    const n = plan.events.length, sets = workout ? plan.events.reduce((t, e) => t + e.data.exercises.reduce((u, x) => u + x.sets.length, 0), 0) : 0;
    h += `<div class="im-sum"><b>${n ? `Adds ${n} ${workout ? `workout${n === 1 ? '' : 's'} with ${sets} set${sets === 1 ? '' : 's'}` : `event${n === 1 ? '' : 's'}`} to ${esc(cal.name)}, ${rangeText(plan.range)}` : 'Nothing new to add'}</b>`;
    if (plan.newExercises.length) h += `<p>Adds ${plan.newExercises.length} new exercise${plan.newExercises.length === 1 ? '' : 's'} to your library: ${esc(plan.newExercises.slice(0, 6).map(e => e.name).join(', '))}${plan.newExercises.length > 6 ? ', …' : ''}. You can set ${plan.newExercises.length === 1 ? 'its' : 'their'} muscle group later under Library → Exercises.</p>`;
    if (plan.skipped.length) h += `<p>${plan.skipped.length} row${plan.skipped.length === 1 ? ' is' : 's are'} skipped because ${plan.skipped.length === 1 ? 'it has' : 'they have'} ${[...new Set(plan.skipped.map(x => x.why))].join(' or ')}.</p>`;
    if (plan.dupes) h += `<label class="im-dup"><input type="checkbox" id="im-dupes" ${m.skipDupes ? 'checked' : ''}> Skip ${plan.dupes} ${workout ? `day${plan.dupes === 1 ? '' : 's'} that already ${plan.dupes === 1 ? 'has' : 'have'} a workout` : `event${plan.dupes === 1 ? '' : 's'} already on this calendar`}</label>`;
    if (n) h += `<ul class="im-prev">${plan.events.slice(0, 4).map(importPreviewLine).join('')}${n > 4 ? `<li class="muted">and ${n - 4} more</li>` : ''}</ul>`;
    h += '</div>';
  }
  return h + `<div class="m-actions"><button class="btn" data-act="m-close">Cancel</button><button class="btn primary" data-act="im-go" ${plan?.events.length ? '' : 'disabled'}>Import${plan?.events.length ? ' ' + plan.events.length : ''}</button></div>`;
}
function doImport() {
  const plan = importPlan(); if (!plan?.events.length) return;
  const cal = db.calendars.find(c => c.id === modal.calId), kind = modal.kind;
  db.exercises.push(...plan.newExercises);
  db.events.push(...plan.events);
  lastImport = { ids: plan.events.map(e => e.id), exIds: plan.newExercises.map(e => e.id) };
  save(); modal = null;
  view = { ...view, date: plan.events[0].date };
  render();
  const n = plan.events.length;
  toast(`Imported ${n} ${kind === 'workout' ? 'workout' : 'event'}${n === 1 ? '' : 's'} into ${cal.name || 'your calendar'}`, { label: 'Undo', act: 'im-undo' });
}
function undoImport() {
  if (!lastImport) return;
  const ids = new Set(lastImport.ids), exIds = new Set(lastImport.exIds);
  db.events = db.events.filter(e => !ids.has(e.id));
  const used = new Set(db.events.flatMap(e => e.format === 'workout' ? (e.data?.exercises || []).map(x => x.exId) : []));
  db.exercises = db.exercises.filter(e => !exIds.has(e.id) || used.has(e.id));
  lastImport = null; save(); render(); $('toast').hidden = true; toast('Import undone');
}
function downloadSample(kind) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([SAMPLE_CSV[kind]], { type: 'text/csv' }));
  a.download = kind === 'workout' ? 'almanac-workouts-sample.csv' : 'almanac-events-sample.csv';
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// Drag a spreadsheet anywhere onto the page to import it.
const hasFiles = ev => [...(ev.dataTransfer?.types || [])].includes('Files');
let dragDepth = 0;
window.addEventListener('dragenter', ev => { if (!hasFiles(ev) || view.mode === 'welcome') return; ev.preventDefault(); dragDepth++; document.body.classList.add('dropping'); });
window.addEventListener('dragover', ev => { if (hasFiles(ev)) ev.preventDefault(); });
window.addEventListener('dragleave', ev => { if (!hasFiles(ev)) return; if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dropping'); } });
window.addEventListener('drop', ev => {
  if (!hasFiles(ev)) return;
  ev.preventDefault(); dragDepth = 0; document.body.classList.remove('dropping');
  if (view.mode === 'welcome') return;
  const f = ev.dataTransfer.files[0], target = ev.target.closest?.('[data-drop-cal]');
  startImport(f, target?.dataset.dropCal || (view.mode === 'doc' && view.kind === 'event' ? curObj()?.calId : ''));
});

/* ---------- friends page ---------- */
let confirmUnfriend = null, emailSent = false;
const inviteUrl = () => social.me?.invite_code ? `${location.origin}/?invite=${social.me.invite_code}` : '';
const MONTH_OPTS = cur => `<option value="">Month</option>` + MONTHS.map((m, i) => `<option value="${i + 1}"${cur === i + 1 ? ' selected' : ''}>${m}</option>`).join('');
const DAY_OPTS = cur => `<option value="">Day</option>` + Array.from({ length: 31 }, (_, i) => `<option${cur === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join('');
const bdayText = p => p?.birthday_month && p?.birthday_day ? `Birthday ${MONTHS[p.birthday_month - 1]} ${p.birthday_day}` : '';
function renderFriends() {
  let h = `<div class="page"><h1>Friends</h1>`;
  if (!user) return h + `<p class="lede">Friends can see the calendars you choose to share, and you can see theirs. Sign in first so they can find you.</p><section class="panel">${authForm()}</section></div>`;
  const me = social.me, mine = user.id;
  const incoming = social.requests.filter(r => r.status === 'pending' && r.to_id === mine), outgoing = social.requests.filter(r => r.status === 'pending' && r.from_id === mine), fids = friendIds();
  h += `<p class="lede">Friends see your name, your birthday and the calendars you share, view only. You see theirs the same way.</p><div class="stack">`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">You</h2>${me ? `<div class="m-row" style="align-items:end">
      <label class="field" style="flex:2 1 200px"><span>Your name</span><input id="pf-name" value="${esc(me.display_name)}" placeholder="What friends call you" autocomplete="name"></label>
      <div class="field" style="flex:1 1 220px"><span>Birthday</span><div class="m-row"><select id="pf-month" aria-label="Birthday month">${MONTH_OPTS(me.birthday_month)}</select><select id="pf-day" aria-label="Birthday day">${DAY_OPTS(me.birthday_day)}</select></div></div></div>` : '<p class="muted" style="margin:0">Loading your profile…</p>'}</section>`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">Add a friend</h2>
    <p class="muted" style="margin:0">Send your invite link. When they open it and sign in, you’ll get their request here.</p>
    ${inviteUrl() ? `<div class="inrow"><input id="inv-link" value="${esc(inviteUrl())}" readonly aria-label="Your invite link"><button class="btn primary" data-act="inv-share">${navigator.share ? 'Share' : 'Copy'}</button></div>` : ''}
    <form class="inrow" data-form="add-friend"><input type="email" id="af-email" placeholder="Or their email address" aria-label="Friend’s email" required><button class="btn">Send request</button></form></section>`;
  if (incoming.length) h += `<section class="panel stack"><h2 class="sec" style="margin:0">Requests for you</h2>${incoming.map(r => `<div class="frow"><b>${esc(personName(r.from_id))}</b><span class="m-row"><button class="btn primary" data-act="fr-accept" data-id="${r.from_id}">Accept</button><button class="btn" data-act="fr-remove" data-id="${r.from_id}">Decline</button></span></div>`).join('')}</section>`;
  if (outgoing.length) h += `<section class="panel stack"><h2 class="sec" style="margin:0">Waiting for them to accept</h2>${outgoing.map(r => `<div class="frow"><b>${esc(personName(r.to_id))}</b><button class="btn" data-act="fr-remove" data-id="${r.to_id}">Cancel</button></div>`).join('')}</section>`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">Your friends</h2>`;
  if (!fids.length) h += `<p class="muted" style="margin:0">No friends yet. Send someone your invite link.</p>`;
  for (const id of fids) {
    const p = social.people[id], cals = friendCals().filter(c => c.owner === id);
    h += `<div class="friend"><div class="frow"><div><b>${esc(personName(id))}</b>${bdayText(p) ? `<div class="muted">${esc(bdayText(p))}</div>` : ''}</div>${confirmUnfriend === id ? `<span class="m-row"><button class="btn" data-act="fr-keep">Keep</button><button class="btn danger solid" data-act="fr-remove" data-id="${id}">Remove friend</button></span>` : `<button class="btn ghost" data-act="fr-unfriend" data-id="${id}">Remove</button>`}</div>
      ${cals.length ? `<div class="pick">${cals.map(c => `<button data-act="fcal-toggle" data-id="${c.id}" aria-pressed="${!c.hidden}" style="--c:${okColor(c.color)}"><span class="dot"></span>${esc(c.name)}</button>`).join('')}</div><small class="muted">Tap a calendar to show or hide it on yours.</small>` : `<small class="muted">${esc(firstName(id))} hasn’t shared any calendars yet.</small>`}</div>`;
  }
  h += `</section>`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">What you share</h2><p class="muted" style="margin:0">Friends can see everything on a shared calendar, view only. Nothing is shared until you choose it here.</p>
    ${db.calendars.length ? db.calendars.map(c => setRow(`<span class="dot" style="--c:${okColor(c.color)};display:inline-block;margin-right:8px"></span>${esc(c.name || 'Untitled')}`, '', seg('share', c.sharing === 'friends' ? 'friends' : 'private', [['private', 'Private'], ['friends', 'Friends']]).replaceAll('data-act="share"', `data-act="share" data-id="${c.id}"`))).join('') : '<p class="muted" style="margin:0">Make a calendar first.</p>'}</section>`;
  return h + '</div></div>';
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
    ${pendingInvite() ? '<p class="invite-note">A friend invited you. Sign in and you’ll be connected.</p>' : ''}${authForm()}
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
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">News</h2>${setRow('Show news on the Day view', 'The latest top stories from NPR, BBC News and The Guardian, updated every time you open the app.', seg('news-on', p.news !== false ? 'on' : 'off', [['on', 'On'], ['off', 'Off']]))}</section>`;
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">Workouts</h2>${setRow('Weight unit', 'Used on Workout pages.', seg('unit', db.unit, [['lb', 'lb'], ['kg', 'kg']]))}</section>`;
  h += renderCycleSettings();
  h += renderReminderSettings();
  h += `<section class="panel stack"><h2 class="sec" style="margin:0">Import from Excel</h2><p class="muted" style="margin:0">Add events from an .xlsx or .csv file. Workouts use Date, Exercise, Sets, Reps, Weight; other calendars use Date, Title, Time, Notes. You can check the columns before anything is added. On a computer you can also drag the file onto Almanac. Sample sheets: <button class="linkish" data-act="sample" data-kind="workout">workouts</button>, <button class="linkish" data-act="sample" data-kind="events">other calendars</button>.</p><label class="btn" style="align-self:flex-start">Choose a spreadsheet<input type="file" data-imp-cal="" accept="${IMPORT_ACCEPT}" hidden></label></section>`;
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
  $('main').innerHTML = ({ year: renderYear, week: renderWeek, day: renderDay, doc: renderDoc, library: renderLibrary, calendars: renderCalendars, builder: renderBuilder, settings: renderSettings, welcome: renderWelcome, friends: renderFriends, progress: renderProgress }[view.mode] || renderWeek)();
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
function go(mode, date) { leaveDoc(); modal = null; cycOpen = false; view = { mode, date: date || view.date }; render(); window.scrollTo(0, 0); }
function openDoc(kind, id) {
  const back = view.mode === 'doc' ? view.back : { mode: ['builder', 'settings', 'welcome'].includes(view.mode) ? 'week' : view.mode };
  leaveDoc(); modal = null;
  const date = kind === 'event' ? db.events.find(e => e.id === id)?.date : kind === 'feed' ? feedEvents().find(e => e.id === id)?.date : kind === 'friend' ? (String(id).split('@')[1] || friendEvents().find(e => e.id === id)?.date) : view.date;
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
    case 'prog-range': prog.range = ds.v; render(); break;
    case 'prog-wk': prog.wk = ds.v; render(); break;
    case 'prog-metric': prog.metric = ds.v; render(); break;
    case 'prog-ex': { const wasDoc = view.mode === 'doc'; prog.ex = ds.key; prog.metric = ''; if (wasDoc) go('progress'); else { const y = scrollY; render(); scrollTo(0, y); } break; }
    case 'feed-kind': feedForm = { ...feedForm, kind: ds.v, err: '', url: $('fd-url')?.value || '', name: $('fd-name')?.value || '' }; render(); break;
    case 'feed-add': addFeed(); break;
    case 'feed-refresh': { const f = feeds().find(x => x.id === ds.id); if (f) refreshFeed(f, true); break; }
    case 'feed-color': { const f = feeds().find(x => x.id === ds.id); if (f) { f.color = ds.color; save(); render(); } break; }
    case 'feed-toggle': { const f = feeds().find(x => x.id === ds.id); if (f) { f.hidden = !f.hidden; save(); render(); } break; }
    case 'feed-del': confirmFeed = ds.id; render(); break;
    case 'feed-del-cancel': confirmFeed = null; render(); break;
    case 'feed-del-confirm': { const f = feeds().find(x => x.id === ds.id); confirmFeed = null; if (!f) break; db.prefs.feeds = feeds().filter(x => x !== f); delete feedData[f.id]; saveFeedData(); save(); render(); toast(`${f.name} unlinked`); break; }
    case 'bills-toggle': billsOpen = !billsOpen; softRender(); break;
    case 'cy-on': cyc.settings = { ...cyc.settings, on: ds.v === 'on' }; saveCycle([], true); render(); if (ds.v === 'on' && !cyc.settings.lastStart) $('cy-last')?.focus(); break;
    case 'cy-flow': case 'cy-energy': case 'cy-mood': case 'cy-sleep': {
      const k = { 'cy-flow': 'period', 'cy-energy': 'energy', 'cy-mood': 'mood', 'cy-sleep': 'sleep' }[a], d = view.date, cur = cyc.logs[d]?.[k];
      const v = a === 'cy-energy' ? +ds.v : ds.v;
      setLog(d, { [k]: String(cur ?? '') === String(v) ? '' : v });
      if (k === 'period' && v && !cyc.settings.lastStart) { cyc.settings.lastStart = d; saveCycle([], true); }
      softRender(); break;
    }
    case 'cy-sym': { const d = view.date, cur = new Set(cyc.logs[d]?.symptoms || []); cur.has(ds.v) ? cur.delete(ds.v) : cur.add(ds.v); setLog(d, { symptoms: [...cur] }); softRender(); break; }
    case 'push-on': enablePush(); break;
    case 'push-off': disablePush(); break;
    case 'push-test': testPush(); break;
    case 'rem-events': case 'rem-checkin': case 'rem-period': db.prefs.reminders = { ...remPrefs(), [a.slice(4)]: ds.v === 'on' }; save(); render(); break;
    case 'cy-open': cycOpen = !cycOpen; softRender(); break;
    case 'cy-del': confirmCycleDel = true; render(); break;
    case 'cy-del-cancel': confirmCycleDel = false; render(); break;
    case 'cy-del-confirm': { confirmCycleDel = false; const dates = Object.keys(cyc.logs); cyc = CYCLE_BLANK(); saveCycle(dates, true); render(); toast('Cycle data deleted'); break; }
    case 'fcal-toggle': { const cur = db.prefs.friendCals || {}; db.prefs.friendCals = { ...cur, [ds.id]: cur[ds.id] === false }; fcCache = null; save(); render(); break; }
    case 'bday-toggle': db.prefs.birthdays = !birthdaysOn(); save(); render(); break;
    case 'share': { const c = db.calendars.find(x => x.id === ds.id); if (!c) break; c.sharing = ds.v === 'friends' ? 'friends' : 'private'; save(); render(); toast(c.sharing === 'friends' ? `Friends can now see ${c.name || 'this calendar'}` : `${c.name || 'This calendar'} is private`); break; }
    case 'fr-accept': friendAction(() => supa.rpc('accept_friend', { p_from: ds.id })); break;
    case 'fr-unfriend': confirmUnfriend = ds.id; render(); break;
    case 'fr-keep': confirmUnfriend = null; render(); break;
    case 'fr-remove': confirmUnfriend = null; friendAction(() => supa.from('friend_requests').delete().or(`and(from_id.eq.${user.id},to_id.eq.${ds.id}),and(from_id.eq.${ds.id},to_id.eq.${user.id})`)); break;
    case 'inv-share': {
      const url = inviteUrl(); if (!url) break;
      if (navigator.share) navigator.share({ title: 'Almanac', text: `Add me as a friend on Almanac`, url }).catch(() => {});
      else navigator.clipboard?.writeText(url).then(() => toast('Invite link copied'), () => { $('inv-link')?.select(); toast('Copy the link above'); });
      break;
    }
    case 'nav': { const d = parse(view.date), n = +ds.dir; if (view.mode === 'year') d.setFullYear(d.getFullYear() + n); if (view.mode === 'week') d.setDate(d.getDate() + 7 * n); if (view.mode === 'day') d.setDate(d.getDate() + n); go(view.mode, iso(d)); break; }
    case 'today': go(view.mode, todayS()); break;
    case 'day': go('day', ds.date); break;
    case 'week': go('week', ds.date); break;
    case 'open': { if (ds.id.startsWith('f:')) { openDoc('friend', ds.id); break; } if (ds.id.startsWith('g:')) { openDoc('feed', ds.id); break; } const id = ds.id.includes('@') ? materialize(ds.id) : ds.id; if (id) openDoc('event', id); break; }
    case 'open-saved': openDoc('saved', ds.id); break;
    case 'preview': preview = sample(ds.fmt); openDoc('preview', 'preview'); break;
    case 'back': go(['event', 'friend', 'feed'].includes(view.kind) ? view.back.mode : 'library', o?.date || view.date); break;
    case 'new': openNew({ calId: ds.cal, date: ds.date, format: ds.fmt, savedId: ds.saved }); break;
    case 'cal-toggle': { const c = db.calendars.find(x => x.id === ds.id); c.hidden = !c.hidden; save(); render(); break; }
    case 'lib-tab': libTab = ds.tab; confirmSaved = null; render(); break;
    case 'lib-muscle': libMuscle = ds.m; render(); break;

    /* modal: new event */
    case 'm-close': modal = null; renderModal(); break;
    case 'im-cal': modal.calId = ds.id; prepImport(); renderModal(); break;
    case 'im-go': doImport(); break;
    case 'im-undo': undoImport(); break;
    case 'sample': downloadSample(ds.kind); break;
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
    case 'guest': loadNews(); guestMode = true; try { localStorage.setItem('almanac-guest', '1'); } catch (e) {} setStatus('local'); go('week', todayS()); break;
    case 'au-back': auth = { email: auth.email, sent: false, busy: false, err: '' }; render(); break;
    case 'signout': supa.auth.signOut().finally(() => { endSession(); auth = { email: '', sent: false, busy: false, err: '' }; setStatus(''); go('welcome', todayS()); }); break;
    case 'install': installEvt?.prompt(); installEvt = null; break;

    /* format builder */
    case 'bf-new': { const f = newFormat('', SWATCHES[4]); openBuilder(f.id, 'library'); $('bf-name')?.focus(); break; }
    case 'bf-edit': openBuilder(ds.id, 'library'); break;
    case 'bf-back': go(view.back.mode === 'calendars' ? 'calendars' : 'library', view.date); break;
    case 'bf-idea': case 'bf-blank': {
      const cf = db.formats.find(x => x.id === view.id); if (!cf) return;
      delete cf.fresh;
      if (a === 'bf-idea') {
        const idea = IDEAS[+ds.i], fromCal = view.back.mode === 'calendars';
        cf.blocks = ideaBlocks(idea); cf.style = idea.style;
        if (!cf.name.trim()) cf.name = idea.name;
        if (!fromCal) cf.color = idea.color;   // a calendar's own color stays
      }
      save(); { const y = scrollY; render(); scrollTo(0, y); }
      break;
    }
    case 'yn': case 'choose': { o.data[ds.b] = o.data[ds.b] === ds.v ? '' : ds.v; save(); { const y = scrollY; render(); scrollTo(0, y); } break; }
    case 'bf-style': case 'bf-color': case 'bf-add': case 'bf-up': case 'bf-down': case 'bf-del': {
      const cf = db.formats.find(x => x.id === view.id); if (!cf) return;
      const i = +ds.i; delete cf.fresh;
      if (a === 'bf-style') cf.style = ds.v;
      if (a === 'bf-color') cf.color = ds.v;
      if (a === 'bf-add') cf.blocks.push({ id: uid(), type: ds.type, label: BLOCKS[ds.type].def, placeholder: '', ...(ds.type === 'choice' ? { options: '' } : {}) });
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
  if (t.id === 'rem-ctime' && t.value) { db.prefs.reminders = { ...remPrefs(), checkinTime: t.value }; save(); return; }
  if (t.id === 'cy-last' && t.value) { cyc.settings = { ...cyc.settings, lastStart: t.value }; saveCycle([], true); return; }
  if (t.id === 'cy-len' || t.id === 'cy-plen') { cyc.settings = { ...cyc.settings, [t.id === 'cy-len' ? 'cycleLength' : 'periodLength']: t.value ? +t.value : null }; saveCycle([], true); return; }
  if (t.id === 'pf-name') { saveProfileSoon({ display_name: t.value }); return; }
  if (t.id === 'pf-month' || t.id === 'pf-day') { saveProfileSoon({ [t.id === 'pf-month' ? 'birthday_month' : 'birthday_day']: t.value ? +t.value : null }); return; }
  if (modal?.type === 'import') {
    if (t.id === 'im-sheet') { modal.sheet = +t.value; prepImport(); renderModal(); return; }
    if (ds.im) { if (t.value === '') delete modal.map[ds.im]; else { for (const k in modal.map) if (modal.map[k] === +t.value) delete modal.map[k]; modal.map[ds.im] = +t.value; } renderModal(); return; }
    if (t.id === 'im-dupes') { modal.skipDupes = t.checked; renderModal(); return; }
  }
  if (t.id === 'nm-date') { if (t.value) modal.date = t.value; return; }
  if (t.id === 'nm-rep') { modal.rep = t.value; renderModal(); return; }
  if (t.id === 'nm-until') { modal.until = t.value; return; }
  if (t.id === 'pk-q') { modal.q = t.value; $('pk-list').innerHTML = pickList(); return; }
  if (t.id === 'lib-q') { libQ = t.value; $('ex-list').innerHTML = exList(); return; }
  if (ds.feed) { const f = feeds().find(x => x.id === ds.feed); if (f) { f.name = t.value; save(); } return; }
  if (ds.xl) { const e = db.exercises.find(x => x.id === ds.xl); if (e) { e[ds.xf] = t.value; save(); } return; }
  if (ds.cal) { const c = db.calendars.find(x => x.id === ds.cal); if (c) { c[ds.cf] = t.value; save(); } return; }
  if (view.mode === 'builder' && (ds.bf || ds.bb !== undefined)) {
    const cf = db.formats.find(x => x.id === view.id); if (!cf) return;
    if (ds.bf) cf[ds.bf] = t.value; else { cf.blocks[+ds.bb][ds.bbf] = t.value; delete cf.fresh; }
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
    if (ds.f === 'start' && o.remind) { if (t.value && String(o.remind).startsWith('am')) o.remind = '0'; if (!t.value && !String(o.remind).startsWith('am')) o.remind = 'am0'; }
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
// Date and time pickers (the iPhone wheels especially) fire change on every turn of the wheel,
// so redrawing then would close the picker; those wait until the field loses focus.
document.addEventListener('change', ev => {
  const t = ev.target, f = t.dataset.f;
  if (view.mode !== 'doc' || f === 'end' || !(['format', 'calId', 'date', 'start'].includes(f) || t.dataset.rep)) return;
  const redraw = () => { if (view.mode !== 'doc') return; const y = scrollY; render(); scrollTo(0, y); };
  if ((t.type === 'date' || t.type === 'time') && document.activeElement === t) { if (!t.dataset.waiting) { t.dataset.waiting = '1'; t.addEventListener('blur', redraw, { once: true }); } return; }
  redraw();
});

document.addEventListener('submit', ev => {
  const f = ev.target.closest('form[data-form]'); if (!f) return;
  ev.preventDefault();
  if (f.dataset.form === 'send') { const email = $('au-email').value.trim(); if (email) sendLink(email); }
  if (f.dataset.form === 'add-friend') { const e = $('af-email').value.trim(); if (e) addFriendByEmail(e).then(ok => { if (ok && $('af-email')) $('af-email').value = ''; }); }
  if (f.dataset.form === 'verify') { const code = $('au-code').value.trim(); if (code) verifyCode(code); }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'cy-last' && view.mode === 'settings') setTimeout(() => softRender(), 0);   // waits for the date picker to close
  if ((t.id === 'cy-len' || t.id === 'cy-plen') && view.mode === 'settings') { const y = scrollY; render(); scrollTo(0, y); }
  if (t.id === 'prog-ex') { prog.ex = t.value; prog.metric = ''; const y = scrollY; render(); scrollTo(0, y); }
  if (t.dataset.feed && view.mode === 'calendars') softRender();
  if (t.id === 'imp-file' && t.files?.[0]) importFile(t.files[0]);
  if (t.dataset.impCal !== undefined && t.files?.[0]) { startImport(t.files[0], t.dataset.impCal); t.value = ''; }
});

/* ---------- start ---------- */
try { guestMode = localStorage.getItem('almanac-guest') === '1'; } catch (e) {}
applyTheme();
{
  const q = new URLSearchParams(location.hash.slice(1) + '&' + location.search.slice(1));
  const err = q.get('error_description');
  const dayLink = new URLSearchParams(location.search).get('day');
  if (dayLink && /^\d{4}-\d{2}-\d{2}$/.test(dayLink)) { view = { mode: 'day', date: dayLink }; history.replaceState(null, '', location.pathname); }
  if (err) setTimeout(() => toast(/expired|invalid/i.test(err) ? 'That sign-in link expired. Request a new one.' : err), 300);
}
supa.auth.getSession().then(({ data }) => {
  authReady = true;
  if (data.session?.user) { startSession(data.session.user); return; }
  if (guestMode || hasData(db)) { guestMode = true; setStatus('local'); loadNews(); refreshFeeds(); }
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
