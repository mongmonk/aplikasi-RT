import express from "express";
import path from "path";
import fs from "fs";
import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Turso Client
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

// Initialize Database Schema
async function initDb() {
  console.log("Checking database schema...");
  try {
    const queries = [
      `CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        email TEXT,
        displayName TEXT,
        photoURL TEXT,
        isActive BOOLEAN DEFAULT FALSE,
        createdAt TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS residents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        block TEXT,
        number TEXT,
        createdAt TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        residentId TEXT REFERENCES residents(id),
        residentName TEXT,
        year INTEGER,
        months TEXT,
        amount INTEGER,
        paymentDate TEXT,
        createdAt TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS cash_book (
        id TEXT PRIMARY KEY,
        description TEXT,
        date TEXT,
        type TEXT,
        amount INTEGER,
        category TEXT,
        paymentId TEXT,
        createdAt TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        date TEXT,
        author TEXT,
        createdAt TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY,
        rtNumber TEXT,
        village TEXT,
        district TEXT,
        regency TEXT,
        defaultIuran INTEGER
      )`
    ];

    for (const q of queries) {
      await client.execute(q);
    }

    // Schema Migrations (Add missing columns safely)
    await client.execute("ALTER TABLE app_settings ADD COLUMN dusun TEXT").catch(()=>{});
    await client.execute("ALTER TABLE app_settings ADD COLUMN rwNumber TEXT").catch(()=>{});
    await client.execute("ALTER TABLE app_settings ADD COLUMN logoUrl TEXT").catch(()=>{});

    // Add default settings if not exists
    const settingsCheck = await client.execute("SELECT count(*) as count FROM app_settings WHERE id = 'global'");
    if (Number(settingsCheck.rows[0].count) === 0) {
      await client.execute({
        sql: "INSERT INTO app_settings (id, rtNumber, village, district, regency, defaultIuran) VALUES ('global', '00', 'Desa Dasar', 'Kecamatan Dasar', 'Kota Dasar', 15000)",
        args: []
      });
    }

  console.log("Database schema verified/initialized.");
} catch (error) {
  console.error("Database initialization error:", error);
}
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Residents
app.get("/api/residents", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM residents ORDER BY name ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch residents" });
  }
});

app.post("/api/residents", async (req, res) => {
  const { id, name, block, number } = req.body;
  try {
    await client.execute({
      sql: "INSERT INTO residents (id, name, block, number, createdAt) VALUES (?, ?, ?, ?, ?)",
      args: [id, name, block, number, new Date().toISOString()]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to create resident" });
  }
});

app.delete("/api/residents/:id", async (req, res) => {
  try {
    await client.execute({
      sql: "DELETE FROM residents WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete resident" });
  }
});

app.post("/api/residents/:id", async (req, res) => {
  const { name, block, number } = req.body;
  try {
    await client.execute({
      sql: "UPDATE residents SET name = ?, block = ?, number = ? WHERE id = ?",
      args: [name, block, number, req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update resident" });
  }
});

// Payments
app.get("/api/payments", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM payments ORDER BY paymentDate DESC");
    // Parse months JSON string
    const rows = result.rows.map(row => ({
      ...row,
      months: JSON.parse(row.months as string)
    }));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

app.post("/api/payments", async (req, res) => {
  const { id, residentId, residentName, year, months, amount, paymentDate } = req.body;
  try {
    await client.execute({
      sql: "INSERT INTO payments (id, residentId, residentName, year, months, amount, paymentDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, residentId, residentName, year, JSON.stringify(months), amount, paymentDate, new Date().toISOString()]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to create payment" });
  }
});

app.delete("/api/payments/:id", async (req, res) => {
  try {
    await client.execute({
      sql: "DELETE FROM payments WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

// Cash Book
app.get("/api/cash-book", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM cash_book ORDER BY date DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cash entries" });
  }
});

app.post("/api/cash-book", async (req, res) => {
  const { id, description, date, type, amount, category, paymentId } = req.body;
  try {
    await client.execute({
      sql: "INSERT INTO cash_book (id, description, date, type, amount, category, paymentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, description, date, type, amount, category, paymentId || null, new Date().toISOString()]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to create cash entry" });
  }
});

app.delete("/api/cash-book/:id", async (req, res) => {
  try {
    await client.execute({
      sql: "DELETE FROM cash_book WHERE id = ?",
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete cash entry" });
  }
});

app.put("/api/cash-book/:id", async (req, res) => {
  const { description, date, type, amount } = req.body;
  try {
    await client.execute({
      sql: "UPDATE cash_book SET description = ?, date = ?, type = ?, amount = ? WHERE id = ?",
      args: [description, date, type, amount, req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update cash entry" });
  }
});

// Bulk Delete helper for iuran
app.post("/api/payments/cleanup", async (req, res) => {
  const { paymentId } = req.body;
  try {
    await client.batch([
      { sql: "DELETE FROM payments WHERE id = ?", args: [paymentId] },
      { sql: "DELETE FROM cash_book WHERE paymentId = ?", args: [paymentId] }
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to cleanup payment" });
  }
});

app.post("/api/import/bulk", async (req, res) => {
  const { residents, payments, cashEntries } = req.body;
  try {
    const statements: any[] = [];
    
    residents.forEach((r: any) => {
      statements.push({
        sql: "INSERT INTO residents (id, name, block, number, createdAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
        args: [r.id, r.name, r.block, r.number, r.createdAt]
      });
    });

    payments.forEach((p: any) => {
      statements.push({
        sql: "INSERT INTO payments (id, residentId, residentName, year, months, amount, paymentDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [p.id, p.residentId, p.residentName, p.year, JSON.stringify(p.months), p.amount, p.paymentDate, p.createdAt]
      });
    });

    cashEntries.forEach((c: any) => {
      statements.push({
        sql: "INSERT INTO cash_book (id, description, date, type, amount, category, paymentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [c.id, c.description, c.date, c.type, c.amount, c.category, c.paymentId, c.createdAt]
      });
    });

    const CHUNK_SIZE = 50;
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
      await client.batch(statements.slice(i, i + CHUNK_SIZE));
    }
    
    res.json({ success: true, count: statements.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed bulk import" });
  }
});

app.post("/api/payments/record", async (req, res) => {
  const { payment, cashEntry } = req.body;
  try {
    await client.batch([
      {
        sql: "INSERT INTO payments (id, residentId, residentName, year, months, amount, paymentDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [payment.id, payment.residentId, payment.residentName, payment.year, JSON.stringify(payment.months), payment.amount, payment.paymentDate, payment.createdAt]
      },
      {
        sql: "INSERT INTO cash_book (id, description, date, type, amount, category, paymentId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [cashEntry.id, cashEntry.description, cashEntry.date, cashEntry.type, cashEntry.amount, cashEntry.category, payment.id, cashEntry.createdAt]
      }
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// Announcements
app.get("/api/announcements", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM announcements ORDER BY date DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

app.post("/api/announcements", async (req, res) => {
  const { id, title, content, date, author } = req.body;
  try {
    await client.execute({
      sql: "INSERT INTO announcements (id, title, content, date, author, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      args: [id, title, content, date, author, new Date().toISOString()]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

// Settings
app.get("/api/logo", async (req, res) => {
  try {
    const result = await client.execute("SELECT logoUrl FROM app_settings WHERE id = 'global'");
    const logoUrl = result.rows[0]?.logoUrl as string;
    if (logoUrl && logoUrl.startsWith('data:image')) {
      const parts = logoUrl.split(';');
      const mimeType = parts[0].split(':')[1];
      const base64Data = parts[1].split(',')[1];
      const imgBuffer = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': imgBuffer.length
      });
      res.end(imgBuffer);
    } else {
      res.status(404).send("Not found");
    }
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM app_settings WHERE id = 'global'");
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.post("/api/settings", async (req, res) => {
  const { rtNumber, rwNumber, dusun, village, district, regency, defaultIuran, logoUrl } = req.body;
  try {
    await client.execute({
      sql: "INSERT INTO app_settings (id, rtNumber, rwNumber, dusun, village, district, regency, defaultIuran, logoUrl) VALUES ('global', ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET rtNumber=excluded.rtNumber, rwNumber=excluded.rwNumber, dusun=excluded.dusun, village=excluded.village, district=excluded.district, regency=excluded.regency, defaultIuran=excluded.defaultIuran, logoUrl=excluded.logoUrl",
      args: [rtNumber, rwNumber || null, dusun || null, village, district, regency, defaultIuran, logoUrl || null]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// Users
app.get("/api/users", async (req, res) => {
  try {
    const result = await client.execute("SELECT * FROM users ORDER BY createdAt DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/users/sync", async (req, res) => {
  const { uid, email, displayName, photoURL } = req.body;
  // Auto-activate the designated admin email
  const isAdminEmail = email === 'backupcemonggaul@gmail.com';
  
  try {
    // Check if user already exists to preserve their isActive status if they were manually activated
    const existing = await client.execute({
      sql: "SELECT isActive FROM users WHERE uid = ?",
      args: [uid]
    });

    let activeStatus = isAdminEmail ? 1 : 0;
    if (existing.rows.length > 0) {
      // If they already exist, we don't want to reset their status UNLESS they are the admin email and were somehow inactive
      activeStatus = Number(existing.rows[0].isActive) || (isAdminEmail ? 1 : 0);
    }

    await client.execute({
      sql: "INSERT INTO users (uid, email, displayName, photoURL, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET email=excluded.email, displayName=excluded.displayName, photoURL=excluded.photoURL, isActive=MAX(isActive, excluded.isActive)",
      args: [uid, email, displayName, photoURL, activeStatus, new Date().toISOString()]
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

app.post("/api/users/:uid/activate", async (req, res) => {
  try {
    await client.execute({
      sql: "UPDATE users SET isActive = ? WHERE uid = ?",
      args: [req.body.isActive, req.params.uid]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// --- SSR: Serve dynamic HTML with meta tags from DB ---
let cachedHtml: string | null = null;

function getHtmlTemplate(): string | null {
  if (cachedHtml) return cachedHtml;
  const tryPaths = [
    path.join(process.cwd(), 'dist', '_template.html'),
    path.join(__dirname, '..', 'dist', '_template.html'),
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
  ];
  for (const p of tryPaths) {
    try {
      cachedHtml = fs.readFileSync(p, 'utf-8');
      return cachedHtml;
    } catch {}
  }
  return null;
}

async function serveDynamicHtml(_req: express.Request, res: express.Response) {
  let title = 'Aplikasi RT-Ku';
  let desc = 'Sistem Informasi Keuangan dan Buku Kas Warga';

  try {
    const result = await client.execute("SELECT * FROM app_settings WHERE id = 'global'");
    const s = result.rows[0];
    if (s) {
      title = `RT ${s.rtNumber}${s.rwNumber ? ` RW ${s.rwNumber}` : ''} ${s.village} - Aplikasi RT-Ku`;
      desc = `Sistem Informasi Keuangan dan Buku Kas. RT ${s.rtNumber}${s.rwNumber ? ` RW ${s.rwNumber}` : ''}${s.dusun ? ` ${s.dusun}` : ''} ${s.village} ${s.district} ${s.regency}`;
    }
  } catch (e) {
    console.error('SSR settings fetch error:', e);
  }

  const template = getHtmlTemplate();
  if (template) {
    const html = template.replaceAll('__APP_TITLE__', title).replaceAll('__APP_DESC__', desc);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  // Fallback: serve a minimal HTML if template not found
  console.error('SSR template not found, serving fallback');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="en"><head>
    <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>${title}</title>
    <meta name="description" content="${desc}"/>
    <meta property="og:title" content="${title}"/>
    <meta property="og:description" content="${desc}"/>
    <meta property="og:image" content="/api/logo"/>
    <meta name="theme-color" content="#0f172a"/>
    <link rel="icon" href="/api/logo"/><link rel="manifest" href="/manifest.json"/>
  </head><body><div id="root"></div>
    <script>location.reload();</script>
  </body></html>`);
}

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const viteName = "vite";
  import(viteName).then(async (vite) => {
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
  });
} else {
  if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
  }
  // Serve dynamic HTML with SSR meta tags for all page routes
  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    await serveDynamicHtml(req, res);
  });
}

// Initialize DB schema
if (process.env.VERCEL) {
  initDb().catch(console.error);
}

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", async () => {
    await initDb();
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
