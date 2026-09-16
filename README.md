# Crednco Admin

Dashboard for reviewing and approving Crednco loan searches and applications.
A FastAPI backend reads records from Firestore and serves them to a React +
Vite single-page admin panel.

This repository was split out of the original Crednco monorepo and contains the
admin side only. The customer-facing routes (`/predict`, `/apply`, `/user/*`)
live in the separate `crednco-app` backend, which writes to the same Firestore
collections this panel reads.

---

## Requirements

| Tool | Version |
|---|---|
| Python | 3.12 or newer |
| Node.js | 20 or newer (Vite 8 requirement) |
| Firebase project | Firestore enabled, with a service account |

---

## Quick start

```bash
git clone https://github.com/salloju000/crednco-AdminPanel.git
cd crednco-AdminPanel
```

**1. Backend dependencies**

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
```

**2. Configure environment**

Copy both example files and fill in your own values — see
[Configuration](#configuration) below.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**3. Frontend dependencies**

```bash
cd frontend
npm install
```

**4. Run**

```bash
npm run dev
```

This single command starts **both** services:

- the FastAPI backend on `http://localhost:8001`
- the Vite dev server on `http://localhost:5173`

Output is prefixed `[backend]` and `[frontend]`; `Ctrl+C` stops both.

---

## Configuration

No credentials are committed to this repository. Both `.env` files are
gitignored and must be created locally from the `.env.example` templates.

### `backend/.env`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ENV` | no | `production` | `development` enables insecure local fallbacks |
| `PORT` | no | `8001` | Port the API listens on |
| `LOG_LEVEL` | no | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR` |
| `ALLOWED_ORIGINS` | no | localhost dev servers | Comma-separated CORS origins |
| `JWT_SECRET` | **yes in production** | dev-only fallback | Signs admin session tokens |
| `ADMIN_API_KEY` | **yes in production** | dev-only fallback | Admin API access key |
| `ALLOW_DEFAULT_ADMIN` | no | `false` | See [Local login](#local-login) |

Firebase credentials — supply **one** of these three:

| Variable | Purpose |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to a service account JSON file (simplest locally) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | The whole service account JSON inline (good for hosted deploys) |
| `FIREBASE_PROJECT_ID` + `FIREBASE_PRIVATE_KEY` + `FIREBASE_CLIENT_EMAIL` | The three fields individually |

Outside `ENV=development`, the backend **refuses to start** if `JWT_SECRET` or
`ADMIN_API_KEY` are missing, rather than falling back to a guessable default.

### `frontend/.env`

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL, e.g. `http://localhost:8001` |
| `VITE_ADMIN_KEY` | Admin key sent by the panel; must match the backend |

> Vite inlines every `VITE_*` variable into the JavaScript bundle at build
> time. Anything placed here is readable by anyone who loads the page, so it
> must never hold a value you would treat as a server-side secret.

### Getting a Firebase service account

1. Firebase Console → Project Settings → **Service accounts**
2. **Generate new private key** → downloads a JSON file
3. Save it as `backend/serviceAccountKey.json` (already gitignored)
4. Point `FIREBASE_SERVICE_ACCOUNT_PATH` at it

---

## Authentication

Admin accounts use TOTP two-factor codes rather than stored passwords. The
`password` field of the login request carries the current 6-digit
authenticator code.

To enrol an admin, start the backend and run:

```bash
cd backend
python create_admin.py <user_id>      # defaults to "admin"
```

This writes `<user_id>_qrcode.png` next to the script. Scan it with Google
Authenticator (or any TOTP app), then log in with that user ID and the
rotating code.

### Local login

For local work without Firebase, setting **both** `ENV=development` and
`ALLOW_DEFAULT_ADMIN=true` accepts a hardcoded `admin` / `admin123` login that
skips TOTP entirely. It is disabled by default, ignored outside
`ENV=development`, and logs a loud warning whenever it is active. Never enable
it on a deployed environment.

---

## API

All `/admin/*` routes require an `Authorization: Bearer <token>` header from
`/login`, and are rate limited.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/login` | Exchange user ID + TOTP code for a JWT |
| `POST` | `/create-user` | Enrol an admin, returns a TOTP QR code |
| `POST` | `/reset-2fa` | Reset a user's TOTP secret |
| `GET` | `/admin/searches` | All search records, newest first |
| `GET` | `/admin/applications` | All formalized applications, newest first |
| `GET` | `/admin/user-stats` | Registered-user metrics |
| `POST` | `/admin/searches/{id}/{approve\|reject}` | Set a search's approval status |
| `POST` | `/admin/applications/{id}/{approve\|reject}` | Set an application's approval status |

Interactive docs run at `http://localhost:8001/docs` (Swagger) and `/redoc`.

State-changing requests are additionally protected by CSRF middleware that
requires an `Origin` or `Referer` header matching `ALLOWED_ORIGINS` — a plain
`curl` POST without an `Origin` header is rejected with HTTP 403 by design.

---

## Project layout

```
backend/
  main.py              FastAPI app, CORS/CSRF setup, /admin routes
  admin_security.py    Login, TOTP enrolment, JWT issuing
  firebase_init.py     Firebase Admin SDK initialisation
  firestore_client.py  Firestore handle + record normalisation
  records.py           Search/application reads and status updates
  user_stats.py        Registered-user metrics
  create_admin.py      CLI helper to enrol an admin via QR code
frontend/
  scripts/
    dev-backend.mjs    Launches uvicorn alongside Vite for `npm run dev`
  src/
    app/               Root App component
    components/        Tables, charts, modals, login screen
    hooks/             Data fetching, CSV export, formatting
```

---

## npm scripts

Run from `frontend/`.

| Script | Does |
|---|---|
| `npm run dev` | Backend **and** frontend together |
| `npm run dev:frontend` | Vite only |
| `npm run dev:backend` | FastAPI only |
| `npm run build` | Type-check and produce a production bundle |
| `npm run lint` | ESLint |

`dev:backend` uses the interpreter in `backend/.venv`, falling back to whatever
`python` is on `PATH`. If something already listens on port 8001 it logs and
skips rather than failing, so a backend started in another terminal keeps
working. Override the port with `BACKEND_PORT=8123 npm run dev`.

---

## Tests

```bash
cd backend
.venv/Scripts/python.exe -m pytest
```

---

## Troubleshooting

**The dashboard shows an error instead of records.**
The `/admin/searches` and `/admin/applications` routes return HTTP 503 with a
descriptive message when Firestore is unreachable or its read quota is
exhausted. Check the detail text — a `Firestore read quota exceeded` message
means the Firebase project has hit its daily read limit (the Spark plan resets
at midnight Pacific) rather than the database being empty.

**Requests fail with a CORS error.**
Vite falls through to port 5174, 5175 and beyond when 5173 is already taken.
Add whichever port it actually used to `ALLOWED_ORIGINS` in `backend/.env`.

**The backend will not start.**
Outside `ENV=development` it exits deliberately when `JWT_SECRET` or
`ADMIN_API_KEY` are unset. Set them, or set `ENV=development` for local work.

**Login returns HTTP 403 `CSRF protection: missing Origin or Referer header`.**
Expected when calling the API directly. Pass `-H "Origin: http://localhost:5173"`.
