# Todo app

A small, mobile-friendly personal todo app built with React, FastAPI, and SQLite.

## Run locally

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at <http://127.0.0.1:8000>. API documentation is available at
<http://127.0.0.1:8000/docs>.

### Frontend

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

The SQLite database is created at `backend/data/tasks.db`. That directory is
ignored by Git so deployments cannot overwrite your tasks.

