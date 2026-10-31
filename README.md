# Cold Storage AI

## Run with Docker Compose

Start the full stack from the repository root:

```powershell
docker compose up --build
```

Open the dashboard at <http://localhost:8080>. The backend API is available at <http://localhost:8000>, and its health endpoint is <http://localhost:8000/health>.

The edge simulator sends buffered telemetry to the backend at `/api/v1/telemetry/ingest`. Postgres data is stored in the `postgres_data` volume and the edge SQLite outbox is stored in the `edge_data` volume, so temporary service restarts do not discard data.

Copy `.env.example` to `.env` before starting if you want to configure Postgres credentials, Gemini, or simulator intervals. Do not commit secrets.

## Run the dashboard locally

```powershell
Set-Location dashboard
npm install
npm run dev
```

When running Vite directly, the dashboard expects the backend at `http://localhost:8000`.
