# Grid Assignments — how to run the app locally

All commands below are run from the **project root** (the folder containing
`backend/`, `frontend/`, `requirements.txt`). Paths are relative on purpose so
this tutorial doesn't break if the repo is moved or renamed.

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

> If you're running off the CSV (the default), put the extracted CSV file name it grid_assignments.csv —
> from the database query that joins `grid_assignments_view` with
> `grid_kw_low_load_high_pv` on `meter_name` — at `data/grid_assignments.csv`.
> To read live from the database instead, see
> [Using the live database](#using-the-live-database-instead-of-the-csv-optional).

## Running the app (two terminals at once)

**Terminal 1 — backend:**

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --reload-dir backend
```

`--reload-dir backend` only watches backend code. Without it, reload also
watches `data/`, so saving a bus reassignment (which writes the big CSV)
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

1. Reinstall deps once to pull in the Postgres driver:

   ```bash
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. From the project root, copy the example env file and edit it:

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

### Every time you run the app

Each of these is a long-running process — use a separate terminal for steps 2–4
and leave them open.

1. **Connect to the UH VPN.** Nothing below reaches the database without it.

2. **Open the SSH tunnel** (forwards local port 6543 to Postgres on `csbcd01`).
   Replace `YOUR_UH_USERNAME` with your own UH login — the host
   (`128.171.46.101`, i.e. `csbcd01`) is the same for everyone:

   ```bash
   ssh -L 6543:localhost:5432 YOUR_UH_USERNAME@128.171.46.101
   ```


   Once you are logged in the server, open up a new **local** terminal and run:

   ```bash
   nc -z localhost 6543 && echo UP
   ```
   If you see UP, the tunnel is working and you can start the backend. The SSH terminal just needs to stay open in the background

3. **Start the backend** and confirm it's hitting the DB:

   ```bash
   source .venv/bin/activate
   uvicorn backend.main:app --reload --reload-dir backend
   ```

   Can check in the **local** terminal window to confirm the backend is hitting the database
   ```bash
    curl http://localhost:8000/api/health
   ``` 
   You should see {"status":"ok","db":"db"}

4. **Start the frontend** 
   ```bash
   cd frontend && npm run dev`
   ``` 
   and open
   <http://localhost:5173>.

To stop: `Ctrl+C` the frontend, then the backend, then the tunnel last.

### How it behaves / troubleshooting

Reads come from the `analysis.grid_assignments_view` and
`analysis.grid_kw_low_load_high_pv` views. Saving a bus reassignment writes
`substation_meter` straight back to the `analysis.grid_assignments` table, so
your DB login needs `UPDATE` permission there. To go back to the CSV, set
`DATA_BACKEND=csv` (or remove it) and restart.

- **Backend starts cleanly but every request errors with `connection to server
  at "127.0.0.1", port 6543 ... Connection refused`** → the SSH tunnel was never
  opened (or the VPN isn't connected). The backend boots fine with no database, so
  an `Application startup complete` log does **not** mean the DB is reachable.
  Connect the VPN, open the tunnel (step 2), confirm `nc -z localhost 6543 && echo
  UP`, then restart the backend. (This is the most common first-run mistake.)
- **App hangs ~30s then errors** → the SSH tunnel (or VPN) dropped mid-session.
  Reconnect the VPN if needed, then restart the tunnel.
- **`/api/health` says `"csv"`** → `.env` wasn't read; ensure `DATA_BACKEND=db`
  and that you started uvicorn from the project root.
- **Reads work but Save fails** → your DB login lacks `UPDATE` on
  `analysis.grid_assignments`.

## Notes

- If port 8000 or 5173 is already in use, an older copy of the app may still be
  running. Find it with `lsof -nP -iTCP:8000 -sTCP:LISTEN`, then stop that
  process before starting a fresh one.
- The `data/` folder (`grid_assignments.csv`) holds sensitive operational data
  and is gitignored — it's distributed separately, not committed.