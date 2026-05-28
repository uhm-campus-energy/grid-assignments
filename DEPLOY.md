# Deploying to Vercel

The app deploys as one Vercel project: the **React frontend** is served as a
static build and the **FastAPI backend** runs as a Python serverless function
under `/api`. The grid CSV lives in **Vercel Blob** so reassignments are durable
and shared — a change one viewer makes is seen by the next. A shared
username/password gates both the UI and the data API.

```
Browser ──► Vercel (static frontend  ──/api──►  Python function = FastAPI)
                                                      │ read / write
                                                      ▼
                                              Vercel Blob (grid_assignments.csv)
```

## One-time setup

1. **Install the CLI and log in**
   ```bash
   npm i -g vercel
   vercel login
   vercel link          # link this folder to a Vercel project
   ```

2. **Create a Blob store** — Vercel dashboard → your project → **Storage** →
   **Create** → **Blob**. Copy its `BLOB_READ_WRITE_TOKEN` (Storage → `.env.local`
   tab), or pull it locally with `vercel env pull`.

3. **Seed the CSV into Blob** (uploads `data/grid_assignments.csv`):
   ```bash
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx .venv/bin/python scripts/seed_blob.py
   ```
   Note the **Blob URL** it prints — that's your `BLOB_CSV_URL`.

4. **Set Environment Variables** (dashboard → Settings → Environment Variables,
   or `vercel env add NAME`):

   | Variable | Value |
   |---|---|
   | `DATA_BACKEND` | `blob` |
   | `BLOB_READ_WRITE_TOKEN` | the token from step 2 (auto-added if Blob store is linked) |
   | `BLOB_CSV_URL` | the URL printed in step 3 |
   | `APP_USERNAME` | your chosen login username |
   | `APP_PASSWORD` | your chosen login password |
   | `AUTH_SECRET` | a long random string: `python -c "import secrets; print(secrets.token_hex(32))"` |

## Deploy

```bash
vercel          # preview deployment
vercel --prod   # production deployment
```
(Or connect the Git repo in the dashboard for automatic deploys on push.)

## Verify the live deployment

- `GET https://<app>.vercel.app/api/health` → `{"status":"ok","db":"blob"}`
- `GET .../api/grid-assignments?scenario=2026_04_11` **without** a token → `401`
- Open the site → log in with `APP_USERNAME` / `APP_PASSWORD` → both tabs load.
- Reassign a meter, reload in a **different** browser/session → the change is
  still there (durable + shared via Blob).

## Notes

- **Local dev is unchanged:** `DATA_BACKEND=csv` reads/writes the on-disk CSV.
  Only Vercel uses `blob`.
- **Consistency:** each function instance caches the parsed CSV and re-downloads
  only when the blob's etag changes, so writes propagate to other viewers.
  Concurrent writes are **last-write-wins** (fine for a demo).
- **Data exposure:** the Blob is public-readable by URL (the data is OK to
  share). The login protects the app and API; it does not lock the raw Blob URL.
- The 6.4 MB CSV is **not** bundled into the deploy (`.vercelignore` excludes
  `data/`); the function reads it from Blob.
