# Pi Todo

A small, mobile-friendly personal todo app built with React, FastAPI, and SQLite.

## First local run

Backend terminal:

```powershell
cd pi-todo\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend terminal:

```powershell
cd pi-todo\frontend
npm install
npm run dev
```

## Later local runs

Backend terminal:

```powershell
cd pi-todo\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend terminal:

```powershell
cd pi-todo\frontend
npm run dev
```

Open <http://localhost:5173/todo/> on the computer. On a phone connected to the
same Wi-Fi, open `http://<computer-ip>:5173/todo/`. Find the computer IP with
`ipconfig` and allow Node/Python through Windows Firewall on private networks
if prompted.

API documentation is at <http://127.0.0.1:8000/docs>.

The SQLite database is created at `backend/data/tasks.db`. That directory is
ignored by Git so deployments cannot overwrite your tasks.

## Deploy to the Raspberry Pi

Push changes to `main`, then check [GitHub Actions](https://github.com/Evyats/pi-todo/actions).
Wait for **Build deploy branch** to turn green, then run on the Pi:

```bash
sudo /opt/pi-todo/app/deploy.sh
```

The private production URL is `/todo/`; its API is under `/todo/api/`.
