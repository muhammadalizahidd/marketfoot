# MARKETFOOT: Google Play Privacy Policy Generation Prompt

> **How to use this file.** Give this whole file to Claude 5.5 (or paste Parts 1–8 as the prompt) together with the filled-in placeholders from Part 7.
> Part 9 is for **you** (the team), not for Claude: it lists app, Play Console and website work that the policy text alone cannot cover. Several of those items are hard approval blockers.
>
> **Honest limit:** no policy text can guarantee instant approval. Google approves apps when the *policy, the Data safety form, the app's real behaviour and the store listing all agree*. This file is built to make those four things match. It is not legal advice; have the final text reviewed by a lawyer or the client's DPO.
>
> Audit date: 2026-10-02. Audited codebase: `League1` (Next.js 15 + Supabase). Google sources are listed in Part 10.

---

## PART 1: Role and task (the prompt itself)

You are a senior privacy counsel and technical writer. Write the **complete privacy policy for the MARKETFOOT mobile app and website**, to be published on the developer's website and linked from Google Play.

Produce, in this order:

1. **The privacy policy**, in **French** (primary language of the app and users), followed by a full **English** version with identical content. Both must be on the same public web page (see Part 5) with a language switch or two clearly anchored sections.
2. **A dedicated "Account and data deletion" section** (anchor `#suppression-du-compte` / `#account-deletion`) that works as the standalone web resource Google requires (Part 4).
3. **A "Google Play Data safety form: answer sheet"** that maps each answer to the policy (Part 6). This is a separate document for the team, not published.
4. **A short list of any placeholder you could not fill and any factual statement you were unsure about.** Do not invent facts.

### Hard rules for you (the writer)

- **Use only the facts in Part 2.** If a fact is missing (marked `[TO CONFIRM]` or a `{{PLACEHOLDER}}`), keep the placeholder visible and list it at the end. Never guess a company name, address, retention period, hosting region or processor.
- **Do not claim what the app does not do.** The app has no analytics, no ads, no push notifications, no location, no camera or microphone, no contacts, no payments and no tracking. Say so plainly, because Google compares the policy with the Data safety form. Do not add generic boilerplate about advertising IDs, cookies for ads, children's data, payment processors and similar if the app does not have them.
- **Do not under-declare.** When unsure whether something counts as "collected", disclose it. Over-disclosure never causes rejection; mismatch does.
- Plain language, short sentences, active voice. No legal fog. Use tables for the data inventory.
- **Do not use the words "bet", "gambling" or "casino".** MARKETFOOT is a free fantasy-football and virtual-trading game with virtual money and 1/N/2 match predictions. State clearly that the money is virtual, has no cash value and cannot be bought, sold or withdrawn.
- Name the app **MARKETFOOT** and the publisher **exactly as it will appear in the Google Play listing** (Google requires the listing entity or the app name to appear in the policy).
- The page title and first heading must be **"Politique de confidentialité / Privacy Policy"**. Google requires clear labelling.
- Output the policy as **clean, semantic HTML** (or Markdown that converts to HTML), with anchor IDs on every section. It must be a normal web page, **not a PDF**, not behind a login, not geo-blocked, not editable by visitors.

---

## PART 2: Facts about the app (ground truth from the code audit)

### 2.1 What the app is
MARKETFOOT is a French-language fantasy-football and virtual-trading game for Ligue 1. A gamer creates an account, builds a 19-player squad with a virtual budget, makes transfers (direct and "Mercado" window), sets a lineup and captain, makes 1/N/2 match predictions, and appears in public rankings. Administrators enter real match results; the server then calculates virtual earnings.
It is a **Next.js web application** (server-rendered, French `lang="fr"`) backed by **Supabase** (PostgreSQL database + Supabase Auth). The Android app is expected to be a wrapper around this web app `[TO CONFIRM: TWA / Capacitor / WebView]`.

### 2.2 Data the app collects, and why

| Data | Source | Purpose | Visible to other users? | Where stored |
|---|---|---|---|---|
| **Email address** | Entered at sign-up, or provided by Google sign-in | Account creation, login, account-confirmation e-mail, account recovery | **No** | Supabase Auth |
| **Password** | Entered at sign-up (min. 8 chars) | Login. Stored only as a salted hash by Supabase Auth; the app never sees or stores the plain text after submission | No | Supabase Auth |
| **Google account identifiers**: Google user ID, email, and (by Supabase's Google provider default) display name and profile-picture URL | Only if the user chooses "Continuer avec Google" | Login without a password. The app does **not** display or use the name or picture `[TO CONFIRM in the Supabase Google provider settings]` | No | Supabase Auth (`auth.users` metadata) |
| **Username (pseudo)**, 3–32 characters | Entered by the user | Public identity in the game | **Yes**, to every signed-in user (rankings, public profile page) | Database `profiles` |
| **Squad (team) name** | Entered by the user | Team identity | **Yes**, to every signed-in user | Database `squads` |
| **Squad composition, lineup, captain choices** | User actions | Core gameplay | **Yes**, the squad and its players are visible on the public profile and rankings | `squads`, `squad_members`, `captain_assignments`, `matchday_squad_snapshots` |
| **Transfers and Mercado orders** | User actions | Core gameplay | Aggregates only (rankings: speculation, transfer count); individual orders are private | `direct_transfers`, `mercado_orders` |
| **1/N/2 match predictions** | User actions | Core gameplay, prediction earnings, prediction ranking | Predictions are **private** (readable only by the gamer and admins). The resulting *prediction earnings total* appears in the Predictions ranking | `predictions`, `prediction_results` |
| **Virtual finances**: budget, blocked account, financial ledger | Generated by the game | Gameplay (virtual currency only, no real money) | Own history is private; wealth totals appear in public rankings | `gamer_finances`, `financial_ledger`, `ranking_snapshots` |
| **Account role and timestamps** (created/updated) | Generated | Access control (gamer or admin) | No | `profiles` |
| **Session cookies**: Supabase auth cookies (`sb-…-auth-token`), strictly necessary | Set by the server on login | Keep the user signed in, secure the session | No | User's browser/WebView |
| **Administrator audit logs** (admins only): actor ID, action, before/after state | Generated when an admin acts | Security, integrity, traceability of corrections | No | `admin_audit_log`, `settlement_reversals`, `mercado_runs` |
| **Technical server logs** (IP address, user agent, timestamps, error details) | Automatically created by the hosting provider and Supabase `[TO CONFIRM provider and retention]` | Security, abuse and fraud prevention, debugging | No | Hosting provider / Supabase |

### 2.3 What the app does NOT do (verified: no code, SDK or permission found)
- **No analytics or crash-reporting SDK** (no Google Analytics, Firebase, Sentry, PostHog, etc.).
- **No advertising**, no ad SDK, **no advertising ID** use, no tracking across apps or sites, no profiling for marketing.
- **No sale of personal data**, no data brokers.
- **No location**, camera, microphone, contacts, calendar, SMS, call logs, files/photos, Bluetooth or health data.
- **No push notifications**, no service worker, no device identifiers collected by the app.
- **No in-app purchases or payment data.** Virtual money cannot be bought with real money.
- **No third-party web fonts, CDNs or embedded external content** in the pages (fonts and images are served from the app itself; club shirt images are local).
- **No user-to-user messaging, chat, comments or friends/follow features** in the current version (these appear in the product roadmap; the policy must be updated before they ship).
- **Browser/WebView storage:** only the Supabase session cookies. No `localStorage`/`sessionStorage`/IndexedDB use found in the app code.

### 2.4 Android device access
The app needs, in practice, **only internet access** (`android.permission.INTERNET`). It should request **no dangerous permissions**. If a wrapper adds other permissions, the policy and the Data safety form must be updated. State in the policy that the app uses the network connection to communicate with its servers and requests no other device permission.

### 2.5 Third parties (all are "service providers" acting on the developer's instructions)

| Party | Role | Data involved | Location |
|---|---|---|---|
| **Supabase, Inc.** | Database, authentication, e-mail delivery for confirmation/recovery (default) | All account and game data in 2.2 | `{{SUPABASE_REGION}}` `[TO CONFIRM: ideally an EU region]` |
| **Google LLC** (Google Identity / OAuth) | Optional sign-in with Google, initiated by the user | Google account identifiers (2.2) | Google's infrastructure |
| **Hosting provider of the Next.js site** `{{HOSTING_PROVIDER}}` `[TO CONFIRM, e.g. Vercel]` | Serves the web app, processes requests | IP address, request logs, session cookies in transit | `{{HOSTING_REGION}}` |
| **E-mail sender** `{{SMTP_PROVIDER}}` `[TO CONFIRM: Supabase default or custom SMTP]` | Sends confirmation/recovery e-mails | Email address | `{{SMTP_REGION}}` |

State that none of them may use the data for their own purposes, and that international transfers (e.g. to the United States) rely on the legal mechanisms in Part 3.4.

### 2.6 Security measures that actually exist (cite only these)
- All traffic over HTTPS (TLS).
- Passwords hashed by Supabase Auth; the app never stores plain-text passwords.
- PostgreSQL **row-level security** on all tables: gamers can read only their own finances, ledger and predictions.
- The Supabase service-role key is server-side only and is never sent to browsers.
- Administrative actions require an admin role check and are audit-logged.
- Server-side validation of all inputs.
Do **not** claim encryption at rest unless confirmed with the providers `[TO CONFIRM]`; Supabase does encrypt at rest by default, so this may be stated once the plan is verified.

### 2.7 Audience
Game for football fans. The developer decides the minimum age `{{MIN_AGE}}`; **recommended default: 18+** (Part 9, item 4). The policy must say the service is not directed at children and that accounts of persons below `{{MIN_AGE}}` will be deleted when discovered.

---

## PART 3: What the privacy policy MUST contain

### 3.1 Google Play mandatory content (checked line by line by reviewers)

1. **Clear labelling** as a privacy policy, with the **app name MARKETFOOT** and the **publisher name exactly as in the Play listing**.
2. **Developer identity and contact:** legal entity, postal address, and a **working privacy contact e-mail** (or contact form). Use `{{PUBLISHER_LEGAL_NAME}}`, `{{PUBLISHER_ADDRESS}}`, `{{PRIVACY_EMAIL}}`.
3. **Every type of personal data accessed, collected, used and shared**: the full inventory in 2.2, nothing left out. Include "technical logs" and "session cookies".
4. **Every party the data is shared with** (2.5), with the purpose of each.
5. **Purposes of use**: each data item mapped to a purpose (the table in 2.2).
6. **Secure handling** (2.6), written in specific, verifiable terms (HTTPS, hashing, row-level security), not vague claims like "bank-grade security".
7. **Retention and deletion policy**: how long each category is kept, and how a user deletes the account and data (Part 4). Use the retention table in 3.3.
8. **No sale of personal data** and **no use for advertising**; state explicitly that data is not shared except with the service providers listed.
9. **Consistency with the Data safety form**: every "collected" and "shared" data type in the form must appear in the policy, and vice versa (Part 6).

### 3.2 GDPR / French-law content (the users are in France; the French DPA is the CNIL)

Include, in plain language:
- **Data controller** identity and contact; **DPO** contact if one is appointed `{{DPO_CONTACT or "none appointed"}}`.
- **Legal basis** per purpose: contract (account and gameplay), legitimate interest (security, fraud and abuse prevention, rankings visible to other players), legal obligation (where applicable), consent (only for optional Google sign-in data flows, and withdrawable).
- **User rights** (access, rectification, erasure, restriction, portability, objection, withdrawal of consent, post-mortem directives under French law) and **how to exercise them** (the privacy e-mail; reply within **one month**).
- **Right to complain** to the CNIL (cnil.fr) or the user's local supervisory authority.
- **Minors:** the digital age of consent in France is **15**. State the minimum age (2.7) and that data of under-age users is deleted when discovered.
- **Automated decision-making:** none. Rankings and earnings are game calculations with no legal or similarly significant effect. Say so in one sentence.
- **Public information notice:** because username, squad name and squad are visible to every signed-in player and appear in rankings, say this **prominently** and tell users not to use their real name or personal details as username. Do not call it "anonymous".
- **Cookies:** only strictly necessary session cookies, which do not require consent under French rules (CNIL guidance on strictly necessary trackers). State that no advertising, analytics or tracking cookies are used.
- **International transfers:** name Supabase, Google and the hosting provider; state the safeguard (EU region if applicable, and Standard Contractual Clauses / EU-US Data Privacy Framework certification where the provider has it `[TO CONFIRM]`).

### 3.3 Retention table (decisions needed from the client; propose these defaults, mark them `[TO CONFIRM]`)

| Data | Proposed retention |
|---|---|
| Account, profile, squad, predictions, transfers, virtual finances | Kept while the account is active; **deleted or irreversibly anonymised within 30 days of a deletion request** |
| Public ranking history | Username replaced by "Joueur supprimé" / "Deleted player"; aggregated game history may remain without any link to the person |
| Inactive accounts | Deleted after `{{INACTIVITY_PERIOD}}` of inactivity (proposed: 24 months) after a prior e-mail notice |
| Administrator audit logs | `{{AUDIT_RETENTION}}` (proposed: 12 months), then deleted or anonymised; **admins only** |
| Server/technical logs | `{{LOG_RETENTION}}` (proposed: 30 to 90 days) |
| Backups | Deleted data disappears from backups within `{{BACKUP_PERIOD}}` (proposed: ≤ 35 days) |
| Retained for security/fraud/legal reasons | Only where strictly necessary and **disclosed here**; Google allows this only if stated in the policy |

### 3.4 Other required clauses
- **Changes to the policy:** how users are told (in-app notice and e-mail for material changes), plus a visible **"Last updated: {{DATE}}"** date and version.
- **Children / minimum age** (2.7) and **no real-money gaming**: one clear sentence that the game uses virtual money only and that no money can be won, deposited or withdrawn `[TO CONFIRM: no real prizes; if prizes exist the plan changes, see Part 9, item 5]`.
- **Third-party links:** Google Sign-In and legal links only.
- **Independence disclaimer:** MARKETFOOT is not affiliated with, endorsed by or sponsored by the Ligue de Football Professionnel, Ligue 1 or any club. Club names/shirts are used for informational purposes `[TO CONFIRM licensing, see Part 9, item 8]`.

---

## PART 4: The Account and Data Deletion section (separate Google requirement)

Google requires that an app which lets users **create an account in the app** must provide **deletion in the app AND on the web**, and the **web URL is entered in the Data safety form**. It must:

- Load with no errors or broken links, and **prominently feature the deletion path** at the top of the section.
- **Name the app and developer exactly as in the Play listing.**
- Offer a clear request path: a **link/button, a form or a customer-service e-mail**, and state **any prerequisite steps**.
- Say **what is deleted** (everything in 2.2 that is tied to the account), **what is retained, why and for how long** (only security/fraud/legal-compliance data, disclosed), and the **timeline**.
- State that **deactivating or freezing is not deletion**. Deletion is permanent and irreversible.
- Be directly reachable by an **anchor** (`#suppression-du-compte`) so the Play Console link opens on that section.

Write the section with this structure:
1. How to delete **inside the app**: `Mon profil → Supprimer mon compte` `{{CONFIRM_PATH_AFTER_IMPLEMENTATION}}`.
2. How to request deletion **without access to the app** (lost password, uninstalled app): e-mail `{{PRIVACY_EMAIL}}` from the registered address, or the web form `{{DELETION_FORM_URL}}`. Explain how identity is verified (reply from the account's e-mail).
3. What gets deleted, what is anonymised, what is retained and for how long.
4. Timeline (acknowledgement in 72 hours, completion within 30 days).
5. Consequences (loss of squad, rankings and virtual funds; irreversible).

---

## PART 5: Publishing and format requirements (all checked by Google)

- URL must be **active, public, non-geofenced, HTML, no PDF, no login, not editable**: e.g. `https://{{WEBSITE}}/privacy`, with the deletion anchor `https://{{WEBSITE}}/privacy#suppression-du-compte`.
- The **same URL** goes in (a) Play Console → App content → Privacy policy, (b) Data safety form → Account deletion URL (anchor), (c) a link **inside the app** (login/sign-up screen **and** Profile) and the store listing.
- Responsive, readable on mobile, with a table of contents and anchor links.
- Contains the visible last-updated date and version number.
- Served over HTTPS.

---

## PART 6: Google Play Data safety form: answer sheet (generate this as a separate table)

Google considers data "collected" when it **leaves the device**, including through the web app the wrapper loads. Required/optional and purposes must match the policy. Proposed answers (verify at publish time against the real build):

| Play data type | Collected? | Shared? | Required / optional | Purpose |
|---|---|---|---|---|
| Personal info → **Email address** | Yes | No (service providers are exempt) | Required (Google sign-in is an optional alternative) | App functionality, Account management |
| Personal info → **Name** | Only if Google provider stores it `[TO CONFIRM]` (declare Yes to be safe) | No | Optional | Account management |
| Personal info → **User IDs** (username, account ID) | Yes | No | Required | App functionality, Account management |
| App activity → **In-app interactions / Other actions** (lineups, transfers, predictions) | Yes | No | Required | App functionality |
| **Other user-generated content** (squad name) | Yes | No (visible to other users inside the app, which is a user-initiated, expected disclosure) | Required | App functionality |
| App info and performance → **Diagnostics / Crash logs** | Only if the hosting/server logs are retained `[TO CONFIRM]` | No | Required | Fraud prevention, security, compliance |
| Financial info | **No** (virtual currency only; real payments do not exist) | n/a | n/a | n/a |
| Location, Contacts, Photos/Videos, Audio, Files, Calendar, Health, Messages, Web browsing | **No** | n/a | n/a | n/a |
| Device or other IDs / Advertising ID | **No** | n/a | n/a | n/a |

Other declarations:
- **Is all data encrypted in transit?** Yes (HTTPS).
- **Can users request deletion?** Yes (in-app path plus the web URL from Part 4).
- **Data shared with third parties?** No, except service providers acting on our behalf (exempt from "sharing").
- **Advertising ID declaration** (App content): **No**, the app does not use it.
- **Ads:** the app contains no ads.
- **Families Policy badge:** do not claim it (the app is not directed at children).

Also output a **consistency matrix** mapping each row above to the exact policy section ID that discloses it.

---

## PART 7: Placeholders to fill before generation (or leave and list)

`{{PUBLISHER_LEGAL_NAME}}`, `{{PUBLISHER_ADDRESS}}`, `{{PRIVACY_EMAIL}}`, `{{DPO_CONTACT}}`, `{{WEBSITE}}`, `{{DELETION_FORM_URL}}`, `{{SUPABASE_REGION}}`, `{{HOSTING_PROVIDER}}`, `{{HOSTING_REGION}}`, `{{SMTP_PROVIDER}}`, `{{SMTP_REGION}}`, `{{MIN_AGE}}`, `{{INACTIVITY_PERIOD}}`, `{{AUDIT_RETENTION}}`, `{{LOG_RETENTION}}`, `{{BACKUP_PERIOD}}`, `{{DATE}}`, `{{CONFIRM_PATH_AFTER_IMPLEMENTATION}}`.

---

## PART 8: Self-check before you answer (you must run this checklist and print the result)

- [ ] Title says "Privacy Policy" and names MARKETFOOT and the exact publisher.
- [ ] Contact e-mail and postal address present; one-month response time stated.
- [ ] Every row of 2.2 appears, with purpose and retention; nothing from 2.3 is wrongly claimed.
- [ ] Every third party in 2.5 is named with its role and country/region.
- [ ] Security statements are limited to 2.6.
- [ ] Retention and deletion explained; deletion section reachable by anchor and meets Part 4.
- [ ] Public visibility of username, squad name and squad is stated prominently.
- [ ] "No real money, virtual currency only" stated; the words bet/gambling/casino are absent.
- [ ] Minimum age and CNIL complaint right stated.
- [ ] No advertising, no analytics, no sale of data, stated explicitly.
- [ ] French and English versions are equivalent.
- [ ] Data safety answer sheet and consistency matrix produced.
- [ ] Unresolved `[TO CONFIRM]` items listed at the end.

---

## PART 9: For the team: blockers the policy cannot fix (do these before submitting)

Google rejects on behaviour, not only on text. The audit found these gaps in the current app:

1. **BLOCKER: no account deletion exists.** The app lets users create accounts, so Google **requires** an in-app deletion option and a web deletion URL; "freezing" doesn't count. Today there is no deletion UI, and deleting an `auth.users` row would **fail** because tables such as `squads`, `gamer_finances`, `financial_ledger`, `predictions`, `prediction_results`, `matchday_squad_snapshots`, `ranking_snapshots`, `settlement_*` and `admin_audit_log` reference `profiles(id)` without cascade. Needed: a `delete_my_account` RPC (delete or anonymise per the retention table, then delete the auth user), a "Supprimer mon compte" button with confirmation in `Mon profil`, and the web path. **I can implement this on request.**
2. **BLOCKER: no privacy-policy or terms pages, and no link in the app.** Add `/privacy` and `/terms` routes (public, no login), link them from the sign-in/sign-up screen, the profile page and the footer, and the Play listing.
3. **User-generated content policy.** Usernames and squad names are visible to other users. Google's UGC policy expects terms of use accepted **before** UGC is created, plus reporting/moderation for apps with public UGC. Add: a mandatory "J'accepte les CGU et la politique de confidentialité" checkbox on sign-up; an in-app **"Signaler"** action on public profiles (at least by e-mail); a username-moderation process (the admin can rename or ban). Write short **Terms of Use** defining prohibited names/behaviour (can be generated from the same data).
4. **Target audience and age.** Declare **18+** (recommended) in Play Console → Target audience; this avoids the Families policy and its restricted ad/data rules. Do not use child-appealing imagery in the listing. If the client wants younger users, the policy and the sign-up flow need an age screen and a different declaration.
5. **Simulated-gambling risk.** Google's gambling policy bans simulated gambling content (social casino, virtual slots) and treats real-money fantasy sports as gambling. MARKETFOOT is fantasy football with virtual money, which is allowed **only if no real money or real-value prize is involved**. Confirm with the client that there is **no cash, prize or reward of monetary value**. Answer the IARC content-rating questionnaire accurately (virtual currency, predictions); avoid betting vocabulary in the listing and screenshots.
6. **Reviewer access.** Google needs working **test credentials in English** under App content → App access. Sign-up requires **e-mail confirmation**, which blocks reviewers: create a **pre-confirmed test account with a ready squad**, valid at all times, not a real user's account, and note that Google sign-in cannot be used for review. Include the admin area only if reviewers need it (not required).
7. **Webview/minimum functionality.** The app is a web app. Google forbids wrappers that are only a webview of a site **without the owner's permission** (you own the site, so this is satisfied) and apps with minimal functionality. Make sure the wrapper is stable, handles offline/errors gracefully, and the listing shows real gameplay.
8. **Club names, logos and shirts.** The app uses real Ligue 1 club names and shirt images. Confirm you have rights or a legal basis, and add the independence disclaimer. Google's intellectual-property and impersonation policies can lead to rejection.
9. **Google sign-in review.** The app uses only basic sign-in (email/profile), so no sensitive-scope verification is needed. Keep the OAuth consent screen's privacy-policy URL equal to the same page.
10. **Android build.** Target the API level required at submission, request **INTERNET only**, no AD_ID, and match the Data safety form to the final build. New **personal** developer accounts (created after 13 Nov 2023) must run a closed test with **12+ testers for 14 continuous days** before production access; organisation accounts are handled separately.
11. **Policy changes when features ship.** Friends/follow, trophies, moderation tools, push notifications or analytics all change the inventory, so update the policy **and** the Data safety form **before** release.
12. **Housekeeping.** `.env.local` contains real Supabase credentials and `scripts/live-system-test.ts` contains a personal e-mail address: keep both out of any shared archive and out of the repository.

---

## PART 10: Sources used (Google Play Console Help, read 2026-10-02)

- User Data policy (privacy policy content, prominent disclosure, no sale, account deletion): https://support.google.com/googleplay/android-developer/answer/10144311
- Data safety section (collected vs shared, exemptions, required/optional, consistency, consequences): https://support.google.com/googleplay/android-developer/answer/10787469
- Account deletion requirements (in-app path, web link, what to delete/retain): https://support.google.com/googleplay/android-developer/answer/13327111
- User Generated Content policy (terms acceptance, reporting, blocking): https://support.google.com/googleplay/android-developer/answer/9876937
- Real-Money Gambling, Games and Contests (simulated gambling, fantasy sports): https://support.google.com/googleplay/android-developer/answer/9877032
- Target audience and content settings: https://support.google.com/googleplay/android-developer/answer/9867159
- Sign-in details for review: https://support.google.com/googleplay/android-developer/answer/15748846
- Testing requirements for new personal developer accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Spam, webview and minimum functionality: https://support.google.com/googleplay/android-developer/answer/9899034
- French/EU side: CNIL guidance (cnil.fr) on strictly necessary cookies, minors (age of digital consent 15) and the one-month response period under GDPR Art. 12.

*Re-check these pages before submission; Google changes policy often.*
