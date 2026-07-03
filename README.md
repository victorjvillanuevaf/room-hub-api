# Room Hub API

Backend API built with NestJS for authentication, buildings/rooms management and room reservation workflows, with real-time updates over WebSockets.

## Tech stack

- NestJS 11 (REST + WebSockets)
- TypeORM + PostgreSQL
- Redis (ioredis) for refresh token storage
- JWT authentication (Passport) with access/refresh tokens
- Socket.IO for real-time reservation updates
- Swagger documentation
- Rate limiting (`@nestjs/throttler`)
- Multer for room image uploads

## Prerequisites

- Node.js 20+
- npm 10+
- Docker + Docker Compose v2 (recommended — runs PostgreSQL and Redis for you, see below)

Only needed if you run PostgreSQL/Redis natively instead of via Docker:

- PostgreSQL 16+
- Redis 7+

## Environment variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

```env
# Application
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=room_hub

# JWT
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d

# Client (used for CORS and WebSocket origin)
CLIENT_URL=http://localhost:5173

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Rate limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=10

# Reservations
CANCELLATION_WINDOW_MINUTES=60

# Operating hours
OPERATING_START=09:00
OPERATING_END=18:00
```

## Installation

```bash
npm install
```

## Start PostgreSQL and Redis with Docker

The project reads the database and Redis connection from `.env`:

```bash
docker compose up -d
```

This starts PostgreSQL and Redis, then runs database migrations and the seed automatically:

- `migrate` waits for Postgres to be healthy and runs `npm run migration:run`.
- `seed` waits for `migrate` to finish successfully, then runs `npm run seed` (inserts/updates buildings and rooms).

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
- Uploaded room images are served statically at `http://localhost:3000/uploads`

## Modules and endpoints

### Auth (`/auth`)

- `POST /auth/register` — register a new user (sets `refreshToken` httpOnly cookie)
- `POST /auth/login` — login with email/password (sets `refreshToken` httpOnly cookie)
- `POST /auth/v1/refresh` — issue a new access token from the refresh token cookie
- `POST /auth/v1/logout` — revoke the current refresh token and clear the cookie
- `POST /auth/revoke-all` — revoke all sessions for a user (admin only)

### Users (`/users`, admin only)

- `GET /users` — list users (paginated)
- `GET /users/:id` — get a user by id
- `GET /users/by-email/:email` — get a user by email
- `POST /users` — create a user with a specific role

### Buildings (`/buildings`)

- `GET /buildings` — list all buildings

### Rooms (`/rooms`)

- `GET /rooms` — list rooms with building data (paginated, filterable)
- `GET /rooms/:id` — get a room by id
- `GET /rooms/:id/details` — get a room with building and reservation availability data
- `GET /rooms/building/:buildingId` — get rooms by building id
- `PATCH /rooms/:id` — update a room (admin only)
- `POST /rooms/:id/image` — upload a room image, PNG/JPEG/JPG up to 5MB (admin only)

### Reservations (`/reservations`)

- `GET /reservations` — list reservations of the authenticated user (admins can query any user via `userId`)
- `GET /reservations/room` — list reservations for a specific room
- `GET /reservations/operating-hours` — get the booking operating hours bounds (`OPERATING_START`/`OPERATING_END`)
- `POST /reservations` — create a reservation for the authenticated user
- `PATCH /reservations/:id` — cancel a reservation (blocked inside `CANCELLATION_WINDOW_MINUTES` before start)

### Real-time (WebSocket, Socket.IO)

- `joinRoom` — subscribe the socket to updates for a room
- `leaveRoom` — unsubscribe from a room
- `reservationUpdate` — emitted to a room's subscribers when its reservations change

Most endpoints require a Bearer access token (`JwtAuthGuard`); admin-only endpoints additionally require the `admin` role (`RolesGuard`).

## Database

- Migrations live in `src/database/migrations` and run automatically on boot (`migrationsRun: true`) and via `docker compose up -d`.
- `npm run migration:run` / `npm run migration:revert` run migrations manually using `src/database/data-source.ts`.
- `npm run seed` seeds buildings and rooms (`src/seeds/seed.ts`).

## Scripts

```bash
# lint
npm run lint

# format
npm run format

# unit tests
npm run test
npm run test:watch
npm run test:cov

# e2e tests
npm run test:e2e

# migrations
npm run migration:run
npm run migration:revert

# seed data
npm run seed
```
