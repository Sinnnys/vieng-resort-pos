# Vieng Resort & Apartment Complex

Public website for Vieng Resort & Apartment Complex, Vientiane.

## Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + SQLite
- **Container**: Docker

## Quick Start (Docker)

```bash
docker compose up -d --build
```

The site will be available at `http://localhost:4000`.

## Development

### Backend

```bash
cd backend
cp env.example .env
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create a `frontend/.env` for development:

```
VITE_API_BASE_URL=http://localhost:4000/api
```

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── db.js         # SQLite schema & helpers
│   │   └── server.js     # Express API + static file server
│   ├── env.example
│   └── package.json
├── frontend/
│   ├── public/media/     # Images & logo
│   ├── src/
│   │   ├── App.tsx       # Main React component
│   │   ├── App.css       # Styles
│   │   └── main.tsx      # Entry point
│   └── package.json
├── Dockerfile
├── docker-compose.yml
└── .dockerignore
```
