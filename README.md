# repo-rewards
RepoRewards helps developers find paid, high‑quality GitHub issues fast. It curates and ranks new bounty opportunities that match your skills, so you can discover, save, and start the most valuable work quickly. The goal: connect you to paid, high-signal work the moment it appears.


---

## MVP Web App Specification

**Goal:** Build a free-tier MVP web app that surfaces the best GitHub issues with bounties.

**Tech Stack:**

* **Frontend:** Next.js (App Router), Tailwind CSS
* **Backend:** Prisma + Postgres
* **Auth:** Better Auth (GitHub OAuth)
* **Payments:** DodoPayments (stubbed for future monetization)

---

### 1. Auth & Onboarding

* **Login:** GitHub login via Better Auth.
* **Profile Fetch:** On first login, fetch public GitHub profile to infer top languages.
* **User Setup:**

  * Select up to 5 primary languages.
  * Choose default labels: `bounty`, `reward`, `help wanted`, `good first issue`, `bug`.
  * Optional: enter topics (text).
  * Optional: add followed repos/orgs (`owner/repo`, `org`).

---

### 2. Data Model (Prisma)

* **User**

  * `id`, `email`, `githubId`, `name`, `avatarUrl`, `createdAt`
* **Profile**

  * `userId`, `primaryLanguages[]`, `topics[]`, `followedRepos[]`, `followedOrgs[]`
* **Issue**

  * `id`, `githubId`, `repoFullName`, `number`, `title`, `bodyExcerpt`, `htmlUrl`, `labels[]`, `language`, `stars`, `org`
  * `isBounty`, `bountyType` (`repo-label` | `link` | `platform`), `bountyUrl`
  * `bountyAmountMin`/`Max` (nullable int), `currency`
  * `openedAt`, `updatedAt`, `score` (float)
* **UserIssue**

  * `id`, `userId`, `issueId`, `status` (`saved` | `started` | `done`), `timestamps`
* **Subscription**

  * `id`, `userId`, `filters` (JSON: `labels[]`, `languages[]`, `minStars`, `orgs[]`, `repos[]`)
  * `frequency` (`daily`), `lastSentAt`
* **EventLog**

  * `id`, `source`, `payload` (JSON), `createdAt`

---

### 3. Ingestion (Scheduled Cron)

* Runs every **10–15 minutes** (serverless/job runner).
* **GitHub REST search** for open issues updated in the last 48h and likely to have bounties.

  * Query example: `is:issue is:open updated:>=ISO` with (`label:bounty` OR `"bounty"` OR `"reward"` OR platform names in `title`, `body`).
* For followed repos/orgs: fetch recent open issues.
* **Processing:**

  * Deduplicate by `repoFullName + number`.
  * Store minimal required fields.
  * Respect rate limits (`ETag`, backoff).
  * Log failures.

---

### 4. Bounty Detection Heuristics

* Mark `isBounty = true` if:

  * Labels include `bounty` / `reward` / `paid`.
  * Title/body contains keywords (`bounty`, `reward`, `paid`).
  * Links to known platforms: IssueHunt, BountySource, Gitcoin, Polar, Open Collective, sponsor/bounty pages.
* **Payout Extraction:**

  * Regex for currency + range (e.g., `$50–$500`, `USD 200`).
  * Set `bountyType` accordingly.
  * Store `bountyUrl` if found.

---

### 5. Scoring

* Compute score on **upsert** using weighted formula:

  * Recency decay.
  * Bounty signal strength (`label` > `link` > `keyword`).
  * Star buckets of repo.
  * Language match to user profile.
  * Label match to user filters.
  * Boosts for followed repos/orgs.
* Persist score on `Issue`.

---

### 6. UI Features

* **Protected Home Feed:**

  * Lists top-ranked issues (paginated).
  * Filters:

    * Languages (multi-select)
    * Labels (multi-select)
    * Min stars (slider)
    * Followed-only toggle
    * Bounty-only (default: on)
  * Issue cards: title, repo, labels, stars, language, bounty badge/type/amount, opened/updated time, actions (`Save`, `Start`).
  * Expandable drawer/modal: body excerpt, links to GitHub and bounty page.

* **My List Page:** Tabs for `Saved` / `Started` / `Done`.

* **Settings Page:** Edit languages, labels, topics, followed repos/orgs, digest toggle.

---

### 7. Daily Email Digest

* On signup, create a daily subscription.
* Scheduled job:

  * Select top 10 new issues since `lastSentAt` matching user filters.
  * Send email (Resend/SMTP) with deep links.
  * Update `lastSentAt`.

---

### 8. Security & Privacy

* Read-only public GitHub scope.
* Store minimal PII.
* Allow account deletion.
* Handle rate limits & idempotent upserts.
* Basic observability (logs, error tracking).

---

### 9. Infrastructure

* Deploy on Vercel.
* Managed Postgres.
* Environment variables for:

  * GitHub OAuth
  * DB URL
  * Email service
* Minimal admin route: view last ingestion run, counts, trigger re-crawl for repo.

---

### Deliverables

* Working app with:

  1. Onboarding → Feed → Save/Start → Daily Digest
  2. Prisma schema & migrations
  3. Cron scripts
  4. Scoring & bounty detection modules with unit tests
  5. Feature-flagged DodoPayments integration (hidden)

---


working app with onboarding → feed → save/start → daily digest; Prisma schema and migrations; cron scripts; scoring and bounty detection modules with unit tests; feature-flagged DodoPayments integration hidden for now.
