# Trackline Shuttle Tracker

A polished live tracking frontend for a campus shuttle system. It runs as a Vite + React + TypeScript app with a real OpenStreetMap/Leaflet campus map, phone GPS support, nearby shuttle sorting, and a simulated live GPS feed so the passenger experience can be tested without a backend.

## Run locally

```bash
npm install
npm run db:migrate
npm run dev:all
```

`dev:all` starts both the Express + Socket.IO API on port `4000` and the Vite frontend on port `5173`. If you prefer separate terminals, run `npm run server` and `npm run dev` separately.

To host only the backend, deploy the [`server/`](server/README.md) folder as its own Node.js application. It has its own package and deployment instructions; the root commands above remain available for local development.

Open the frontend in your browser:

```bash
http://localhost:5173
```

Open the local URL printed by Vite and sign in with the seeded admin account from `.env` (`admin@trackline.local` / your local `ADMIN_PASSWORD`). Routes, shuttles, pickup points, drivers, assignments, schedules, settings, trips, and the login session are loaded through the Express API from MariaDB. Use **Driver GPS** for a real phone GPS trip, or **GPS simulator** for development testing.

## Test on a phone

1. Run `npm run dev:all` on the host computer. Vite listens on the local network by default.
2. Open the Network URL shown by Vite (for example, `http://192.168.1.10:5173`) on a phone or another computer connected to the same Wi-Fi/LAN.
3. If the page does not open, allow inbound TCP port `5173` through the host computer's firewall and check that the network does not isolate devices from each other.
4. Sign in normally; API requests and live updates use the same frontend URL through Vite's proxy, so port `4000` does not need to be opened for browser access.
5. Allow Location permission when the browser asks.
6. Tap the crosshair/locate button to center the map on your phone.

Phone browser GPS usually requires `localhost` or HTTPS. If a plain local Network URL is blocked from using location, use an HTTPS tunnel or test on the same phone with the local app served through a secure development URL.

The passenger phone can provide the passenger's own location. A driver phone or GPS device can start a trip and send coordinates to the backend; the API stores the latest position and history, then broadcasts `shuttle:location` through Socket.IO to connected passenger dashboards.

## Current structure

```text
src/
  App.tsx       # dashboard, navigation, live fleet screen, and maintenance entry points
  RealMap.tsx   # Leaflet/OpenStreetMap map, route, markers, and popups
  RouteEditor.tsx       # database-backed visual incoming route builder
  RouteBuilderMap.tsx   # draggable route markers and road geometry preview
  ShuttleWizard.tsx     # shuttle + assignment setup with route builder
  DriverTracking.tsx    # driver phone GPS trip page
  MaintenanceManager.tsx # pickup points, drivers, assignments, and schedules CRUD
  main.tsx      # app entry
  styles.css    # responsive dark transit UI and map markers
```

The dashboard uses the free OpenStreetMap/Leaflet map when `VITE_MAP_PROVIDER=osm` is set (this is the local default). Route details, stops, TDK destination, shuttle assignments, and live positions are loaded from the database; the selected shuttle route is no longer read from a frontend route array. A PWA manifest and production service worker are also included for mobile installation.

## TDK incoming-trip architecture

All newly created routes are incoming routes whose final destination is forced to `TDK` using `system_settings.TDK_*`. The database now contains:

- `routes` and `route_stops` for permanent incoming route definitions
- `pickup_points` for reusable pickup locations (the legacy `stops` table remains synchronized for compatibility)
- `drivers`, `shuttle_assignments`, and `trip_schedules` for maintenance and scheduling
- `trips` for actual journeys and `trip_stop_status` for route progress
- `shuttle_locations` for timestamped GPS history and latest-position queries
- `system_settings` for TDK coordinates and GPS thresholds

The maintenance API uses soft deactivation for routes, shuttles, drivers, and pickup points so historical trips are not destroyed.

### Main API groups

```text
GET/POST/PUT/PATCH/DELETE /api/routes
GET/POST/PUT/PATCH/DELETE /api/routes/:id/stops/:stopId
GET/POST/PUT/PATCH/DELETE /api/pickup-points
GET/POST/PUT/PATCH/DELETE /api/drivers
GET/POST/PUT/PATCH       /api/shuttle-assignments
GET/POST                  /api/trip-schedules
GET                         /api/trips, /api/trips/active, /api/trips/:id
POST                        /api/trips/start, /api/trips/:id/end
POST                        /api/trips/:id/location
GET                         /api/shuttles/:id/location/latest
GET                         /api/trips/:id/location-history
```

Run the database setup from a clean clone with:

```bash
npm install
npm run db:check
npm run db:migrate
npm run db:seed
npm run dev:all
```

`db:migrate` is idempotent and also creates development seed data. Never put real production passwords or API keys in `.env.example`; keep them in the local `.env` file or a deployment secret manager.

## Main Gate incoming manifests

For an existing database, apply the focused schema update without rerunning development seeds:

```bash
npm run db:migrate:main-gate
```

Then create an active `MAIN_GATE` account in **Users & roles**. Signing in opens `/main-gate`. Main Gate can view today's real TDK-bound trips and unstarted assignments/schedules, trip-specific boarded passengers and signatures, verify passengers on active trips, download one-sheet trip workbooks or a multi-sheet daily workbook, and search earlier incoming manifests. Scheduled rows have no trip manifest until a trip actually starts. The backend restricts this role to Main Gate and profile APIs.

Test passengers added through the admin/driver testing form are visible in the Main Gate manifest with a **TEST ONLY** label. They are excluded from official passenger totals, verification, and Excel downloads; those features require employees to board through the normal passenger flow.

New trips and boardings capture route, driver, capacity, shuttle, and stop snapshots. The focused migration freezes the best information currently available for older trips, but cannot reconstruct historical values already changed before the migration.

Run the focused tests with `node server/tests/main-gate.test.cjs`. Set `TEST_API_URL=http://localhost:4000` to also run read-only integration checks against a running local API.

## Optional Google Maps

The app supports Google Maps when a restricted browser key is present. Because a browser key is public by design, restrict it in Google Cloud to `Maps JavaScript API` and your local/production HTTP origins, then add it to `.env` using the Vite-compatible variable name:

```text
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-restricted-key
VITE_MAP_PROVIDER=google
```

Restart Vite after changing `.env`. The key pasted into chat should be rotated before use because it is exposed. Without this variable, the app uses the no-key map provider automatically.

## Local database settings

The local `.env` file is configured for the MariaDB session shown in the screenshot:

```text
Host, port, user, and database are read from the local `.env` file and are never exposed to the browser.
```

The database password is kept in `.env`, which is ignored by git. Do not expose `DB_PASSWORD` through a `VITE_` variable or frontend code.

To verify the local MariaDB connection and create `shuttle_tracking` if it does not exist:

```bash
npm run db:check
```
