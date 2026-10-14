// The public half of the notification key, which browsers need to subscribe this device.
import { vapidKeys } from './_push.js';

export default function handler(req, res) {
  const k = vapidKeys();
  if (!k) return res.status(503).json({ error: 'Notifications are not set up yet: add PUSH_SECRET in Vercel.' });
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ key: k.publicKey });
}
