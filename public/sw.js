// Almanac service worker: keeps the app itself available offline.
// Pages and app files load from the network first and fall back to the last copy saved here.
// Data (Supabase) and other sites are never cached here; the app keeps its own copy of your data.
const CACHE = 'almanac-shell-v2';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (req.method !== 'GET' || (url.origin !== location.origin && !font) || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? '/' : req, copy)); }
      return res;
    }).catch(() => caches.match(req.mode === 'navigate' ? '/' : req).then(r => r || Response.error()))
  );
});

// Reminders: show the notification, and open Almanac on that day when it's tapped.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Almanac', body: e.data?.text() || '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Almanac', { body: d.body || '', tag: d.tag, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('navigate' in c) return c.navigate(url).then(w => (w || c).focus());
    return self.clients.openWindow(url);
  }));
});
