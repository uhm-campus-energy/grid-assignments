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

   Changing a variable requires a redeploy.

## Deploy

Push to `main`. Vercel rebuilds automatically; pull requests get a preview link.

Commits that only touch `data/` do **not** rebuild (`ignoreCommand` in
`vercel.json`), so saves on the site don't redeploy it. This also means a new
project's first deploy is skipped if the latest commit on `main` is a save:
push any code change to trigger it.

## Verify the live deployment

- `GET https://<app>.vercel.app/api/health` → `{"status":"ok","db":"github"}`
- Open the site → both tabs load, scenarios populate, charts render.
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
- **Access:** the app has no login. To restrict who can open it, enable
  Vercel's **Deployment Protection** (Settings → Deployment Protection).
