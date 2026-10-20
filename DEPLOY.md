# Deploying to Vercel

The app deploys as one Vercel project: the **React frontend** is served as a
static build and the **FastAPI backend** runs as a Python serverless function
under `/api`. The grid CSV lives in **this GitHub repository**: every
reassignment made on the site is committed to `data/grid_assignments.csv`
(`backend/github_store.py`). A Vercel function can't write to its own files, so
it goes through the GitHub API.

```
Browser ──► Vercel (static frontend  ──/api──►  Python function = FastAPI)
                                                      │ read / commit
                                                      ▼
                                   GitHub repo (data/grid_assignments.csv)
```

The repo is `uhm-campus-energy/grid-assignments`; the Vercel project is
`grid-assignments` in the **UH Energy** account (Hobby plan).

## One-time setup

1. **Keep the repo public.** A Vercel Hobby account can't deploy private repos
   owned by a GitHub organization.

2. **Create a fine-grained personal access token** from the account that should
   appear as the author of saves (GitHub → Settings → Developer settings →
   Fine-grained tokens):
   - Resource owner: `uhm-campus-energy`
   - Repository access: only `grid-assignments`
   - Permissions: **Contents: Read and write**

3. **Import the repo in Vercel** (Add New → Project). Set Application Preset to
   **Other** and leave Root Directory as `./`. Build and output settings come
   from `vercel.json`, so leave the overrides off.

4. **Set Environment Variables** (Production and Preview):

   | Variable | Value |
   |---|---|
   | `DATA_BACKEND` | `github` |
   | `GITHUB_TOKEN` | the token (sensitive) |
   | `GITHUB_REPO` | `uhm-campus-energy/grid-assignments` |
   | `GITHUB_BRANCH` | optional, defaults to `main` |
   | `GOOGLE_CLIENT_ID` | see Login below |
   | `AUTH_SECRET` | see Login below (sensitive) |
   | `HOST_EMAILS` | see Login below |

   Changing a variable requires a redeploy.

## Login

Users sign in with their hawaii.edu Google account. Hosts can save; everyone
else can only view. The user list lives in a Neon Postgres added through
Vercel (`backend/auth.py`), separate from the UH `uhm2023` database.

1. **Database:** Vercel → project → **Storage → Create Database → Neon**
   (free plan), and connect it to Production and Preview. Vercel adds
   `POSTGRES_URL` itself. The `users` table is created on the first sign-in.
2. **Google sign-in client:** Google Cloud Console (a hawaii.edu account can
   switch Google Cloud on at hawaii.edu/google/extra) → APIs & Services →
   **OAuth consent screen** (Internal if offered, else External) → then
   **Credentials → Create credentials → OAuth client ID → Web application**.
   Under **Authorized JavaScript origins** add
   `https://grid-assignments.vercel.app` and `http://localhost:5173`. No
   redirect URI is needed. Copy the client ID into `GOOGLE_CLIENT_ID`.
   Google does not accept wildcards, so sign-in does not work on preview links.
3. **`AUTH_SECRET`:** a long random string,
   `python3 -c "import secrets; print(secrets.token_hex(32))"`.
4. **`HOST_EMAILS`:** comma-separated emails that are always hosts.

**Managing users:** Neon console (or Vercel → Storage → the database) → Tables
→ `users`. Set `blocked` to true to block someone (takes effect on their next
request), or `role` to `host` to let them save.

## Deploy

Push to `main`. Vercel rebuilds automatically; pull requests get a preview link.

Commits that only touch `data/` do **not** rebuild (`ignoreCommand` in
`vercel.json`), so saves on the site don't redeploy it. This also means a new
project's first deploy is skipped if the latest commit on `main` is a save:
push any code change to trigger it.

## Verify the live deployment

- `GET https://<app>.vercel.app/api/health` → `{"status":"ok","db":"github"}`
- Open the site → the Google sign-in shows; sign in with a hawaii.edu account.
- Both tabs load, scenarios populate, charts render.
- Reassign a meter → a `Reassign <meter> to <bus> (<scenario>) [skip ci]`
  commit appears on `main`, authored by the token's owner.

## Notes

- **Local dev is unchanged:** `DATA_BACKEND=csv` reads/writes the on-disk CSV.
- Run `git pull` before working locally — `main` moves whenever someone saves.
- If two people save at the same moment, the second save is re-applied on top
  of the first rather than overwriting it.
- A branch protection rule that requires pull requests on `main` will reject
  the save commits.
- Saves on **preview** links also commit to `main`.
- The CSV is **not** bundled into the deploy (`.vercelignore` excludes `data/`).
- **Access:** only signed-in hawaii.edu accounts can use the app, and only
  hosts can save. The CSV itself is still public in the repo.
- `DEV_LOGIN_EMAIL` skips sign-in for local dev and tests. It is ignored on
  Vercel; never set it there anyway.
