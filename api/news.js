// Live news for the Day view: the latest top stories from a few major outlets' public RSS feeds.
// Runs on Vercel for free; each open of the app asks for it, and Vercel keeps a copy for a few minutes.
const FEEDS = [
  { name: 'NPR', topic: 'U.S.', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'BBC News', topic: 'World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'The Guardian', topic: 'U.S.', url: 'https://www.theguardian.com/us-news/rss' },
  { name: 'BBC News', topic: 'Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'BBC News', topic: 'Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { name: 'BBC News', topic: 'Tech', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
];
const PER_FEED = 2;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, c) => c[0] === '#' ? String.fromCodePoint(c[1].toLowerCase() === 'x' ? parseInt(c.slice(2), 16) : +c.slice(1)) : ENT[c.toLowerCase()] ?? m);
const text = s => decode(String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (xml, t) => (xml.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i')) || [])[1] || '';
const clip = (s, n) => s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s;

export function parseFeed(xml, feed) {
  const out = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const it = m[0], headline = text(tag(it, 'title')), link = text(tag(it, 'link')) || text(tag(it, 'guid'));
    if (!headline || !/^https:\/\//i.test(link)) continue;
    const when = Date.parse(text(tag(it, 'pubDate'))) || 0;
    out.push({ topic: feed.topic, headline, summary: clip(text(tag(it, 'description')), 260), sources: [{ name: feed.name, url: link }], when });
  }
  return out;
}

async function load(feed) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(feed.url, { signal: ctl.signal, headers: { 'user-agent': 'Almanac news (+https://vercel.app)' } });
    return res.ok ? parseFeed(await res.text(), feed) : [];
  } catch (e) { return []; } finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  const lists = await Promise.all(FEEDS.map(load)), seen = new Set(), items = [];
  lists.forEach(list => {
    let n = 0;
    for (const it of list) {
      const k = it.headline.toLowerCase();
      if (n >= PER_FEED || seen.has(k)) continue;
      seen.add(k); items.push(it); n++;
    }
  });
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
  res.status(items.length ? 200 : 502).json({ generated_at: new Date().toISOString(), items: items.map(({ when, ...it }) => it) });
}
