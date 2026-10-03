const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MAX_JOBS = 5;
const LOOKBACK_HOURS = 24;
const FEEDS = [
  "https://weworkremotely.com/remote-jobs.rss",
  "https://remoteok.com/remote-jobs.rss",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  return decode(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
}

async function readFeed(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = xml.match(/<item[\s\S]*?<\/item>/g) || [];
    return items.map((block) => ({
      title: pick(block, "title"),
      link: pick(block, "link"),
      date: new Date(pick(block, "pubDate")),
    }));
  } catch (err) {
    console.log(`Feed failed: ${url} -> ${err.message}`);
    return [];
  }
}

async function send(text) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
  if (!res.ok) throw new Error(`Telegram error: ${await res.text()}`);
}

async function main() {
  if (!TOKEN || !CHAT_ID) throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");

  const all = (await Promise.all(FEEDS.map(readFeed))).flat();
  const cutoff = Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000;

  const fresh = all
    .filter((j) => j.title && j.link && !isNaN(j.date) && j.date.getTime() >= cutoff)
    .sort((a, b) => b.date - a.date)
    .slice(0, MAX_JOBS);

  if (fresh.length === 0) {
    console.log("No new jobs in the last 24 hours.");
    return;
  }

  for (const job of fresh) {
    await send(`💼 ${job.title}\n\n🔗 ${job.link}`);
    await sleep(2000);
  }
  console.log(`Posted ${fresh.length} jobs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
