# Studio Noor — Salon Booking Backend

A real backend for the salon booking website: Node.js + Express + SQLite.
Bookings are saved permanently in a database file (`salon.db`) — nothing is lost on refresh.

## What's inside

```
salon-backend/
├── server.js         # Express API
├── db.js             # SQLite schema + seed data (6 services)
├── public/
│   ├── index.html     # Customer-facing booking site
│   └── admin.html      # Admin dashboard to view/cancel bookings
├── package.json
├── .env.example
└── salon.db           # created automatically on first run
```

## Run it locally

You need [Node.js](https://nodejs.org) 18+ installed.

```bash
cd salon-backend
npm install
cp .env.example .env      # then edit .env and set your own ADMIN_KEY
npm start
```

Open:
- **Booking site:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin.html (enter the `ADMIN_KEY` from your `.env`)

## API reference

| Method | Route                              | Purpose                                  |
|--------|-------------------------------------|-------------------------------------------|
| GET    | `/api/services`                     | List all services (type, amount, duration) |
| GET    | `/api/availability?date=YYYY-MM-DD` | List time slots for a date + booked status |
| POST   | `/api/bookings`                     | Create a booking                          |
| GET    | `/api/bookings/:refCode`            | Look up one booking by its reference code |
| GET    | `/api/admin/bookings`               | List all bookings (needs `x-admin-key` header) |
| PATCH  | `/api/admin/bookings/:id/cancel`    | Cancel a booking (needs `x-admin-key` header) |

Example — create a booking:
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"serviceId":1,"name":"Riya Shah","phone":"9876543210","date":"2026-07-20","time":"10:00 AM"}'
```

## Editing the salon details

- **Services, prices, durations:** edit the seed list in `db.js`. It only re-seeds when `salon.db` doesn't exist yet — delete `salon.db` and restart to reset.
- **Salon name, address, hours, phone number:** edit the text directly in `public/index.html` (hero section and footer).
- **Working hours / slot length:** edit `OPEN_TIME`, `CLOSE_TIME`, `SLOT_MINUTES` at the top of `server.js`.
- **Admin key:** set `ADMIN_KEY` in `.env`. Keep this private — anyone with it can see customer phone numbers and cancel bookings.

## Putting it online (so customers can actually book)

**Important: Netlify alone cannot run this backend.** Netlify only hosts static
files and short-lived serverless functions — it cannot keep an Express server
running with a saved database file. Bookings would not be stored reliably.

The working setup is **split in two**:
- **Backend (server + database)** → Render (or Railway) — this is the part that must stay running.
- **Frontend (the website people see)** → Netlify — plain files, free, drag-and-drop.

### Step 1 — Deploy the backend on Render
1. Push this whole `salon-backend` folder to a GitHub repo (or use Render's "Upload" option if you don't want GitHub).
2. On [render.com](https://render.com) → New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add an environment variable `ADMIN_KEY` with your own secret value.
5. Deploy. Render gives you a live URL like `https://studio-noor-backend.onrender.com` — copy it.
6. **Persistence:** SQLite needs a disk that survives redeploys. On Render's free tier the disk is temporary, so bookings can reset when the service restarts. For a business that's actually taking bookings, either add a **Render persistent disk** (paid, a few dollars/month) or move to a free hosted database like **Supabase/Neon Postgres**. I can help with that migration whenever you're ready.

### Step 2 — Point the frontend at that backend
Open `public/index.html` and `public/admin.html`, find this line near the top of the `<script>`:
```js
const API = 'https://PASTE-YOUR-RENDER-URL-HERE.onrender.com';
```
Replace it with the real Render URL from Step 1 (no trailing slash), in **both** files.

### Step 3 — Deploy the frontend on Netlify
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the folder containing just `index.html` and `admin.html` (not the whole backend folder) onto the page.
3. Netlify gives you a live site URL instantly — that's the link you share with customers.
4. Anytime you edit `index.html`/`admin.html`, just drag the folder again to redeploy.

Once both are live: customer opens the Netlify site → books an appointment → the request goes to your Render backend → saved in the database → shows up in `admin.html`.

### Alternative — skip Netlify entirely
Since this Express server already serves the frontend itself (`public/` folder), you can deploy **just Render** and skip Netlify completely — one URL does everything, one less thing to manage. This is simpler if you don't have a specific reason to want Netlify.

## Known limitation

The booking form on the site allows one confirmed booking per page load (the button locks after success). Refresh the page to make another booking. This can be changed if you'd like a "book another" flow instead.
