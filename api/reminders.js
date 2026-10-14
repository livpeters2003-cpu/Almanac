// Sends reminders that are due. Supabase calls this every 5 minutes (see migration 003);
// calling it more often is harmless, because each reminder is claimed before it's sent.
import webpush from 'web-push';
import { vapidKeys, SUPABASE_URL } from './_push.js';

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rest = (path, init = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', ...(init.headers || {}) } });

export default async function handler(req, res) {
  const keys = vapidKeys();
  if (!keys || !KEY) return res.status(503).json({ error: 'Add PUSH_SECRET and SUPABASE_SERVICE_ROLE_KEY in Vercel.' });
  webpush.setVapidDetails(process.env.PUSH_CONTACT || 'mailto:almanac@example.com', keys.publicKey, keys.privateKey);
  const now = new Date(), since = new Date(now - 2 * 3600e3).toISOString();
  const due = await rest(`reminders?select=*&sent_at=is.null&fire_at=lte.${now.toISOString()}&fire_at=gte.${since}&order=fire_at&limit=200`).then(r => r.ok ? r.json() : []);
  let sent = 0, gone = 0;
  const subsFor = {};
  for (const r of due) {
    // claim it first so two runs never send the same reminder
    const claim = await rest(`reminders?user_id=eq.${r.user_id}&id=eq.${encodeURIComponent(r.id)}&sent_at=is.null`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ sent_at: now.toISOString() }) }).then(x => x.ok ? x.json() : []);
    if (!claim.length) continue;
    subsFor[r.user_id] ??= await rest(`push_subscriptions?select=*&user_id=eq.${r.user_id}`).then(x => x.ok ? x.json() : []);
    const payload = JSON.stringify({ title: r.title, body: r.body, url: r.url, tag: r.id });
    for (const s of subsFor[r.user_id]) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 }); sent++; }
      catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { gone++; await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' }); }
      }
    }
  }
  // tidy up old rows
  await rest(`reminders?fire_at=lt.${new Date(now - 3 * 864e5).toISOString()}`, { method: 'DELETE' });
  res.status(200).json({ due: due.length, sent, removedDevices: gone });
}
