const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'salon.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    amount INTEGER NOT NULL,
    duration INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_code TEXT UNIQUE NOT NULL,
    service_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (service_id) REFERENCES services(id),
    UNIQUE(date, time)
  );
`);

const count = db.prepare('SELECT COUNT(*) as c FROM services').get().c;
if (count === 0) {
  const insert = db.prepare(
    `INSERT INTO services (name, description, amount, duration) VALUES (?, ?, ?, ?)`
  );
  const seed = db.transaction((rows) => {
    for (const r of rows) insert.run(r.name, r.description, r.amount, r.duration);
  });
  seed([
    { name: 'Haircut & Style', description: 'Wash, cut and blow-dry finish.', amount: 800, duration: 45 },
    { name: 'Hair Colour', description: 'Global colour with ammonia-free tones.', amount: 2500, duration: 90 },
    { name: 'Keratin Treatment', description: 'Smoothening for frizz-free hair, lasts months.', amount: 4500, duration: 120 },
    { name: 'Hair Spa', description: 'Deep-conditioning scalp & hair therapy.', amount: 1200, duration: 60 },
    { name: 'Beard Grooming', description: 'Shape, trim and hot-towel finish.', amount: 350, duration: 20 },
    { name: 'Bridal Styling', description: 'Full look — hair, draping and touch-ups.', amount: 6000, duration: 150 },
  ]);
  console.log('Seeded default services.');
}

module.exports = db;
