# Vokler scripts

This folder contains small helper scripts to run each project locally.

## API (FastAPI + ARQ)

- Windows:
  - `api-dev.bat`
  - `api-worker.bat`
  - `api-docker-up.bat` (Postgres + Redis)
- macOS/Linux/Git-Bash:
  - `api-dev.sh`
  - `api-worker.sh`
  - `api-docker-up.sh` (Postgres + Redis)

## Web (Next.js)

- Windows: `web-dev.bat`
- macOS/Linux/Git-Bash: `web-dev.sh`

## Extension (Vite build --watch)

- Windows: `extension-dev.bat`
- macOS/Linux/Git-Bash: `extension-dev.sh`

## Mobile (Expo)

- Windows: `mobile-dev.bat`
- macOS/Linux/Git-Bash: `mobile-dev.sh`

## Notes

- Run from anywhere; scripts `cd` into the correct folder.
- If dependencies are missing, install them first:
  - API: `cd api && uv sync`
  - Web/Extension/Mobile: `cd <dir> && npm install`

