# Room Hub API

Backend API built with NestJS for authentication and room booking workflows.

## Tech stack

- NestJS 11
- TypeORM
- PostgreSQL
- JWT authentication (Passport)
- Swagger documentation

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 14+

## Environment variables

Use `.env.example` as reference:

```env
# Application
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=
DB_NAME=room_hub

# JWT
JWT_SECRET=
JWT_EXPIRES_IN=7d
```

## Installation

```bash
npm install
```

## Start PostgreSQL with Docker

The project reads the database connection from `.env`, so you can start a local Postgres instance with:

```bash
docker compose up -d
```

`docker compose up -d` now starts PostgreSQL and runs the seed automatically.
The seed container waits for Postgres health, inserts/updates buildings and rooms,
and then exits.

Default values are already aligned with `.env.example`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=room_hub
```

Then start the API normally:

```bash
npm run start:dev
```

## Run the API

```bash
# development
npm run start:dev

# production build
npm run build
npm run start:prod
```

When running locally, the API is available at:

- `http://localhost:3000`
- Swagger: `http://localhost:3000/api/docs`

## Available endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /`

## Scripts

```bash
# lint
npm run lint

# unit tests
npm run test

# e2e tests
npm run test:e2e
```

## Project status

- Build passing
- Unit tests passing
- e2e tests passing
