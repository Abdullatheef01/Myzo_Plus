const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
const MAX_JOBS = 10;
const LOOKBACK_HOURS = 1;
const UA = { "User-Agent": "Mozilla/5.0" };
const NA = "Not mentioned";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  return decode(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
}

function list(x) {
  if (Array.isArray(x)) return x.slice(0, 5).join(", ");
  return x ? String(x) : "";
}

function money(min, max, cur = "USD") {
  const a = Number(min);
  const b = Number(max);
  const f = (n) => Math.round(n).toLocaleString("en-US");
  if (a > 0 && b > 0 && Math.round(a) !== Math.round(b)) return `${cur} ${f(a)} - ${f(b)}`;
  if (a > 0 && b > 0) return `${cur} ${f(a)}`;
  if (a > 0) return `${cur} ${f(a)}+`;
  if (b > 0) return `${cur} up to ${f(b)}`;
  return "";
}

// ---------- Sources (each returns a list of jobs in the same shape) ----------

async function weWorkRemotely() {
  const res = await fetch("https://weworkremotely.com/remote-jobs.rss", { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item[\s\S]*?<\/item>/g) || [];
  return items.map((b) => {
    const full = pick(b, "title");
    const i = full.indexOf(": ");
    return {
      title: i > -1 ? full.slice(i + 2) : full,
      company: i > -1 ? full.slice(0, i) : "",
      location: pick(b, "region") || pick(b, "country"),
      salary: "",
      skills: pick(b, "skills") || pick(b, "category"),
      link: pick(b, "link"),
      date: new Date(pick(b, "pubDate")),
    };
  });
}

async function remoteOK() {
  const res = await fetch("https://remoteok.com/api", { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data
    .filter((j) => j.position)
    .map((j) => ({
      title: j.position,
      company: j.company,
      location: j.location,
      salary: money(j.salary_min, j.salary_max),
      skills: list(j.tags),
      link: j.url,
      date: new Date(j.date || (j.epoch ? j.epoch * 1000 : NaN)),
    }));
}

async function jobicy() {
  const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50", { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map((j) => ({
    title: j.jobTitle,
    company: j.companyName,
    location: list(j.jobGeo),
    salary: money(j.annualSalaryMin, j.annualSalaryMax, j.salaryCurrency || "USD"),
    skills: list(j.jobIndustry),
    link: j.url,
    date: new Date(j.pubDate),
  }));
}

async function adzunaIndia() {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) throw new Error("Missing ADZUNA_APP_ID or ADZUNA_APP_KEY");
  const params = new URLSearchParams({
    app_id: ADZUNA_APP_ID,
    app_key: ADZUNA_APP_KEY,
    results_per_page: "30",
    what_or: "developer fresher react node javascript",
    sort_by: "date",
  });
  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/in/search/1?${params}`, {
    headers: { ...UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.results || []).map((j) => {
    const salary = money(j.salary_min, j.salary_max, "INR");
    return {
      title: j.title,
      company: j.company && j.company.display_name,
      location: j.location && j.location.display_name,
      salary: salary && String(j.salary_is_predicted) === "1" ? `${salary} (estimated)` : salary,
      skills: j.category && j.category.label,
      link: j.redirect_url,
      date: new Date(j.created),
    };
  });
}

const SOURCES = [
  { name: "We Work Remotely", run: weWorkRemotely },
  { name: "RemoteOK", run: remoteOK },
  { name: "Jobicy", run: jobicy },
  { name: "Adzuna", run: adzunaIndia },
];

// ---------- Telegram ----------

function formatJob(j) {
  const v = (x) => esc(x && String(x).trim() ? String(x).trim() : NA);
  const lines = [
    `💼 <b><u>${v(j.title)}</u></b>`,

    `🏢 Company: ${v(j.company)}`,

    `📍 Location: ${v(j.location)}`,

    `💰 Salary: ${v(j.salary)}`,

    `🛠 Skills / Category: ${v(j.skills)}`,

    `🔗 Apply: ${esc(j.link)}`,
  ];
  if (j.source === "Adzuna") lines.push("Jobs by Adzuna");
  return lines.join("\n");
}

async function send(text) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
  });
  if (!res.ok) throw new Error(`Telegram error: ${await res.text()}`);
}

// ---------- Main ----------

async function main() {
  if (!TOKEN || !CHAT_ID) throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");

  const results = await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const jobs = await s.run();
        console.log(`${s.name}: ${jobs.length} jobs fetched`);
        return jobs.map((j) => ({ ...j, source: s.name }));
      } catch (err) {
        console.log(`Source failed: ${s.name} -> ${err.message}`);
        return [];
      }
    })
  );

  const cutoff = Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000;
  const seen = new Set();

  const fresh = results
    .flat()
    .filter((j) => j.title && j.link && !isNaN(j.date) && j.date.getTime() >= cutoff)
    .filter((j) => {
      const key = j.link.split("?")[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.date - a.date)
    .slice(0, MAX_JOBS);

  if (fresh.length === 0) {
    console.log("No new jobs in the last hour.");
    return;
  }

  for (const job of fresh) {
    await send(formatJob(job));
    await sleep(2000);
  }
  console.log(`Posted ${fresh.length} jobs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
