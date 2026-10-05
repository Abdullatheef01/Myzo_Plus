<div align="center">

# MYZO PLUS

**job alerts on autopilot**

[![Telegram](https://img.shields.io/badge/Telegram-@myzopluse__io-26A5E4?logo=telegram&logoColor=white)](https://t.me/myzopluse_io)
[![Runs on](https://img.shields.io/badge/Runs_on-GitHub_Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/jobs.yml)
[![Node](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)](jobs.js)
[![Trigger](https://img.shields.io/badge/Triggered_by-cron--job.org-orange.svg)](https://cron-job.org)

*Fresh developer jobs from four sources, formatted and posted to a public Telegram
channel every hour. No server, no laptop left running: **GitHub Actions** does the
work and **cron-job.org** pulls the trigger.*

*Built by [Abdul Latheef J](https://github.com/Abdullatheef01).*

[Join the channel](#links) · [Run it](#run-it) · [How a job gets posted](#how-a-job-gets-posted) · [Limitations](#limitations-honestly)

</div>

---

## How a job gets posted

| # | Step | What happens |
|---|------|--------------|
| 1 | Trigger | cron-job.org calls the GitHub API every hour and starts the workflow. |
| 2 | Fetch | `jobs.js` pulls from four sources in parallel. If one source fails, the others still run. |
| 3 | Filter | Keeps jobs posted in the last `LOOKBACK_HOURS`, removes duplicates by link, sorts newest first, caps at `MAX_JOBS`. |
| 4 | Post | Each job is sent to the Telegram channel as one formatted message. |

> No server. No database. No npm dependencies. Just Node 20's built-in `fetch`.

---

## What the channel looks like

```
💼 Senior Frontend Developer

🏢 Company: Example Corp
📍 Location: Remote
💰 Salary: USD 80,000 - 120,000
🛠 Skills / Category: React, TypeScript
🔗 Apply: https://example.com/jobs/123
```

The title is bold in Telegram. Any field a source does not provide shows as
`Not mentioned`.

---

## Sources

| Source | Type | Focus |
|--------|------|-------|
| [We Work Remotely](https://weworkremotely.com) | RSS | Remote jobs |
| [RemoteOK](https://remoteok.com) | JSON API | Remote tech jobs |
| [Jobicy](https://jobicy.com) | JSON API | Remote jobs |
| [Adzuna](https://developer.adzuna.com) | JSON API (free key) | India jobs (developer, fresher, React, Node, JavaScript) |

Adding a source means writing one function that returns jobs in the same shape and
adding it to the `SOURCES` list in `jobs.js`.

---

## Repo layout

| Path | Contents |
|------|----------|
| `jobs.js` | Fetches, filters, formats and posts. Single file, nothing to install. |
| `.github/workflows/jobs.yml` | GitHub Actions workflow that runs `jobs.js`. Started through `workflow_dispatch` by cron-job.org. |

---

## Run it

### 1. Telegram

1. Open **@BotFather** in Telegram, send `/newbot`, and copy the bot **token**.
2. Create a **public channel** and note its username (for example `@myzopluse_io`).
3. Add the bot to the channel as an **admin** with **Post Messages** enabled.

### 2. Adzuna

Register at [developer.adzuna.com](https://developer.adzuna.com) to get an
**Application ID** and **Application Key**.

### 3. Repository secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Value |
|--------|-------|
| `TELEGRAM_BOT_TOKEN` | Token from BotFather |
| `TELEGRAM_CHAT_ID` | Channel username, for example `@myzopluse_io` |
| `ADZUNA_APP_ID` | Adzuna Application ID |
| `ADZUNA_APP_KEY` | Adzuna Application Key |

Never commit tokens to the repo. They live only in Secrets.

### 4. Run it once by hand

**Actions → Job Alerts → Run workflow.** Open the run and check the `post` step log.
You should see one `jobs fetched` line per source.

> For a first test, temporarily set `LOOKBACK_HOURS` to `24` so there is something to
> post, then set it back to `1`.

### 5. Automate it with cron-job.org

GitHub's own scheduler can run late or skip runs, so an external cron triggers the
workflow instead.

1. Create a **fine-grained GitHub token**: only this repository, permission
   **Actions: Read and write**.
2. In [cron-job.org](https://cron-job.org), create a cronjob:

| Field | Value |
|-------|-------|
| URL | `https://api.github.com/repos/<your-username>/<your-repo>/actions/workflows/jobs.yml/dispatches` |
| Schedule | Every hour |
| Method | `POST` |
| Body | `{"ref":"main"}` |
| Header | `Authorization: Bearer <your GitHub token>` |
| Header | `Accept: application/vnd.github+json` |
| Header | `Content-Type: application/json` |

3. Use **Test run**. A `204 No Content` response means GitHub accepted the trigger and
   a new run appears under **Actions**.

### Run locally

Needs Node 18 or newer.

```bash
export TELEGRAM_BOT_TOKEN=your_token
export TELEGRAM_CHAT_ID=@your_channel
export ADZUNA_APP_ID=your_app_id
export ADZUNA_APP_KEY=your_app_key
node jobs.js
```

On Windows PowerShell, set each one with `$env:NAME="value"` instead of `export`.

---

## Configuration

Set at the top of `jobs.js`:

| Setting | Default | Meaning |
|---------|---------|---------|
| `MAX_JOBS` | `10` | Most jobs posted in one run. |
| `LOOKBACK_HOURS` | `1` | Only jobs published within this window are posted. Match it to how often the cron runs. |
| `SOURCES` | 4 sources | List of sources to fetch from. |

---

## Limitations, honestly

- **Time window, not a ledger.** The script does not remember what it posted. If a run is
  delayed past the window, a job can be missed; widening the window causes repeats.
- **Missing fields.** Not every job lists location, salary or skills. Adzuna may return
  estimated salaries, which are labelled `(estimated)`.
- **No Naukri, LinkedIn or Indeed.** They have no free official API, and scraping them
  goes against their rules.
- **Adzuna free tier is limited** (roughly 1,000 calls a month at the time of writing).
  One call per hourly run stays under that. Check Adzuna's terms.
- **Telegram only.** WhatsApp Channels have no official API for automated posting.

---

## Roadmap

- [ ] Remember posted jobs (a seen list) instead of relying on a time window
- [ ] Cap jobs per source so one source cannot fill a whole run
- [ ] More India-focused sources
- [ ] Optional filters (fresher roles, location)

---

## Links

| | |
|---|---|
| Telegram channel | https://t.me/myzopluse_io |
| Repository | https://github.com/Abdullatheef01/Myzo_Plus |
| Author | [Abdul Latheef J](https://github.com/Abdullatheef01) |

---

## Credits

Job data from We Work Remotely, RemoteOK, Jobicy and Adzuna. **Jobs by Adzuna.**
