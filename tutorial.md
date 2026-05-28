# Grid Assignments — how to run the app locally

All commands below are run from the **project root** (the folder containing
`backend/`, `frontend/`, `requirements.txt`). Paths are relative on purpose so
this tutorial doesn't break if the repo is moved or renamed.

> **No Vercel access needed.**
> Vercel is only used for the shared production deployment. To run the app
> yourself you only need Python 3, Node, and either the CSV data file or UH
> network access for the live database. Everything below runs entirely on your
> own machine.

## One-time setup

**Backend** (Python virtual environment):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Frontend** (Node dependencies):

```bash
cd frontend
npm install
cd ..
```

**Get the data file.**
The CSV is not in the repository (it contains operational data). Ask a team
member for `grid_assignments.csv` and place it at `data/grid_assignments.csv`
relative to the project root. This is the default data source — no additional
configuration required.

If you want to read from the live database instead, see
[Using the live database](#using-the-live-database-instead-of-the-csv-optional).

## Running the app (two terminals at once)

**Terminal 1 — backend:**

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --reload-dir backend
```

`--reload-dir backend` only watches backend code. Without it, reload also
watches `data/`, so saving a bus reassignment (which rewrites the CSV)
restarts the server mid-request and the change never reaches the UI.

Backend runs at <http://localhost:8000>.

**Terminal 2 — frontend:**

```bash
cd frontend
npm run dev
```

Frontend runs at <http://localhost:5173>.

Then open <http://localhost:5173> in your browser.

Both must be running at the same time — the frontend calls the backend API.
Vite proxies all `/api` requests to the backend on port 8000 (see
`frontend/vite.config.ts`), so the two ports must match that config.

## Using the live database instead of the CSV (optional)

By default the backend reads the local `data/grid_assignments.csv`. To read live
data from the shared Postgres database (`uhm2023`, schema `analysis`, on
`csbcd01.colo.hawaii.edu`) instead, you need three things reachable at once: the
VPN, an SSH tunnel, then the app.

The database's Postgres port (5432) is **not** exposed directly — even on the
VPN it's firewalled. Access goes through an **SSH tunnel** into `csbcd01`, so a
plain `DATABASE_URL` pointing at port 5432 will never connect.

### One-time configuration

1. From the project root, copy the example env file and edit it:

   ```bash
   cp .env.example .env
   ```

   Set the backend to `db` and point `DATABASE_URL` at the **local tunnel port**
   (6543 below), not the remote host:

   ```
   DATA_BACKEND=db
   DATABASE_URL=postgresql://username:PASSWORD@localhost:6543/uhm2023
   ```

   Notes: the schema does **not** go in the URL (queries already reference
   `analysis.*` explicitly); URL-encode any special characters in the password
   (e.g. `@` → `%40`).

### Every time you run the app with the live database

Each of these is a long-running process — use a separate terminal for steps 2–4
and leave them open.

1. **Connect to the UH VPN.** Nothing below reaches the database without it.

2. **Open the SSH tunnel** (forwards local port 6543 to Postgres on `csbcd01`).
   Replace `YOUR_UH_USERNAME` with your own UH login — the host
   (`128.171.46.101`, i.e. `csbcd01`) is the same for everyone:

   ```bash
   ssh -L 6543:localhost:5432 YOUR_UH_USERNAME@128.171.46.101
   ```

   Once you are logged in to the server, open a new **local** terminal and run:

   ```bash
   nc -z localhost 6543 && echo UP
   ```

   If you see `UP`, the tunnel is working. The SSH terminal just needs to stay
   open in the background.

3. **Start the backend** and confirm it's hitting the DB:

   ```bash
   source .venv/bin/activate
   uvicorn backend.main:app --reload --reload-dir backend
   ```

   In another local terminal, verify:

   ```bash
   curl http://localhost:8000/api/health
   ```

   You should see `{"status":"ok","db":"db"}`.

4. **Start the frontend:**

   ```bash
   cd frontend && npm run dev
   ```

   Then open <http://localhost:5173>.

To stop: `Ctrl+C` the frontend, then the backend, then close the SSH tunnel last.

### Troubleshooting

- **`Connection refused` on port 6543** → the SSH tunnel was never opened (or
  the VPN isn't connected). The backend boots fine with no database, so
  `Application startup complete` does **not** mean the DB is reachable.
  Connect the VPN, open the tunnel (step 2), confirm `nc -z localhost 6543 &&
  echo UP`, then restart the backend. This is the most common first-run mistake.
- **App hangs ~30 s then errors** → the tunnel or VPN dropped mid-session.
  Reconnect the VPN if needed, then restart the tunnel.
- **`/api/health` says `"csv"`** → `.env` wasn't read; ensure `DATA_BACKEND=db`
  and that you started uvicorn from the project root.
- **Reads work but Save fails** → your DB login lacks `UPDATE` on
  `analysis.grid_assignments`.

## Deploying changes to production

You do **not** need a Vercel account to ship changes. The Vercel project is
connected to this GitHub repository, so the deploy happens automatically:

1. Push your changes to `main` (or merge a pull request into `main`).
2. Vercel detects the push and rebuilds the app automatically.
3. The new version is live at the production URL within a few minutes.

Pull requests also get a **preview deployment** — a unique URL Vercel posts as a
PR comment — so changes can be reviewed in a real environment before merging.

The only person who needs a Vercel account is whoever manages the project
settings (env vars, Blob store, domain). For everyone else, GitHub access is
sufficient - Right now it is hosted on my Vercel account, so I have the access to this.

> **If auto-deploy isn't triggering:** the GitHub integration may not be
> configured yet. Ask the project owner to go to the Vercel dashboard →
> project → Settings → Git and connect this repository. After that, pushes to
> `main` deploy automatically.

## Notes

- If port 8000 or 5173 is already in use, an older copy of the app may still be
  running. Find it with `lsof -nP -iTCP:8000 -sTCP:LISTEN`, then stop that
  process before starting a fresh one.
- The `data/` folder (`grid_assignments.csv`) holds sensitive operational data
  and is gitignored — it's distributed separately, not committed.
- Any changes you save while running locally write back to your local CSV only.
  They are not visible to other users and do not affect the shared production
  deployment on Vercel.
