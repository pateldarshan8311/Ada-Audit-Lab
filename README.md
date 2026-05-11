# Ada Audit Lab

Frontend deploys to Netlify as a static Next.js export. Backend deploys to Render as a Node/Express service that runs Lighthouse, Puppeteer, axe-core, and AI remediation, with MongoDB-backed report storage in production.

## Local Setup

```bash
npm install
cp .env.example .env

cd backend
npm install
cp .env.example .env
```

Frontend `.env`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Backend `.env`:

```bash
PORT=4000
CORS_ALLOWED_ORIGINS=http://localhost:3000
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=pulse_ada_audit_lab
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini
PUPPETEER_EXECUTABLE_PATH=
LIGHTHOUSE_CHROME_PATH=
```

## Local Run

```bash
cd backend
npm run dev
```

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy Files

- `netlify.toml` for the frontend
- `render.yaml` for the backend
- `backend/` for the Render service root

## Node Version

Use Node.js `20.9+` locally and in production.
