-- Schema untuk Turso (SQLite)

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  displayName TEXT,
  photoURL TEXT,
  isActive BOOLEAN DEFAULT FALSE,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS residents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  block TEXT,
  number TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  residentId TEXT REFERENCES residents(id),
  residentName TEXT,
  year INTEGER,
  months TEXT, -- Simpan sebagai JSON string atau comma-separated
  amount INTEGER,
  paymentDate TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS cash_book (
  id TEXT PRIMARY KEY,
  description TEXT,
  date TEXT,
  type TEXT, -- 'income' atau 'expense'
  amount INTEGER,
  category TEXT,
  paymentId TEXT, -- Opsional, link ke payments
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  date TEXT,
  author TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY, -- Biasanya 'global'
  rtNumber TEXT,
  village TEXT,
  district TEXT,
  regency TEXT,
  defaultIuran INTEGER
);
