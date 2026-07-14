require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-me-admin-key';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OPEN_TIME = '10:00';
const CLOSE_TIME = '19:00';
const SLOT_MINUTES = 30;

function generateDailySlots() {
  const slots = [];
  let [h, m] = OPEN_TIME.split(':').map(Number);
  const [ch, cm] = CLOSE_TIME.split(':').map(Number);
  while (h < ch || (h === ch && m < cm)) {
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    slots.push(label);
    m += SLOT_MINUTES;
    if (m >= 60) { m -= 60; h += 1; }
  }
  return slots;
}
const ALL_SLOTS = generateDailySlots();

function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key') || req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized. Missing or invalid admin key.' });
  }
  next();
}

app.get('/api/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY id').all();
  res.json(services);
});

app.get('/api/availability', (req, res) => {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Provide a valid date as YYYY-MM-DD.' });
  }
  const booked = db
    .prepare(`SELECT time FROM bookings WHERE date = ? AND status = 'confirmed'`)
    .all(date)
    .map((r) => r.time);

  const slots = ALL_SLOTS.map((time) => ({ time, available: !booked.includes(time) }));
  res.json({ date, slots });
});

app.post('/api/bookings', (req, res) => {
  const { serviceId, name, phone, date, time } = req.body;

  if (!serviceId || !name || !phone || !date || !time) {
    return res.status(400).json({ error: 'serviceId, name, phone, date and time are all required.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });
  }
  if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
    return res.status(400).json({ error: 'phone must be a valid 10-digit number.' });
  }
  if (!ALL_SLOTS.includes(time)) {
    return res.status(400).json({ error: 'time is not a valid slot.' });
  }

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
  if (!service) {
    return res.status(404).json({ error: 'Service not found.' });
  }

  const alreadyBooked = db
    .prepare(`SELECT id FROM bookings WHERE date = ? AND time = ? AND status = 'confirmed'`)
    .get(date, time);
  if (alreadyBooked) {
    return res.status(409).json({ error: 'That slot was just booked by someone else. Please pick another time.' });
  }

  const refCode = 'SN-' + crypto.randomInt(100000, 999999);

  try {
    const info = db
      .prepare(
        `INSERT INTO bookings (ref_code, service_id, customer_name, phone, date, time, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(refCode, service.id, name.trim(), phone.trim(), date, time, service.amount);

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...booking, service_name: service.name, duration: service.duration });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'That slot was just booked. Please pick another time.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong while saving the booking.' });
  }
});

app.get('/api/bookings/:refCode', (req, res) => {
  const booking = db
    .prepare(
      `SELECT b.*, s.name as service_name, s.duration
       FROM bookings b JOIN services s ON s.id = b.service_id
       WHERE b.ref_code = ?`
    )
    .get(req.params.refCode);
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });
  res.json(booking);
});

app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  const bookings = db
    .prepare(
      `SELECT b.*, s.name as service_name
       FROM bookings b JOIN services s ON s.id = b.service_id
       ORDER BY b.date DESC, b.time DESC`
    )
    .all();
  res.json(bookings);
});

app.patch('/api/admin/bookings/:id/cancel', requireAdmin, (req, res) => {
  const result = db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Booking not found.' });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Salon backend running on http://localhost:${PORT}`);
  console.log(`Admin key: ${ADMIN_KEY}`);
});
