import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

async function run() {
  const result = await client.execute("SELECT * FROM app_settings WHERE id = 'global'");
  const settings = result.rows[0];
  
  const pageTitle = `RT ${settings.rtNumber} ${settings.rwNumber ? `RW ${settings.rwNumber} ` : ''}${settings.village} - Aplikasi RT`;
  const desc = `Sistem Informasi Keuangan dan Buku Kas. RT ${settings.rtNumber} ${settings.rwNumber ? `RW ${settings.rwNumber} ` : ''}${settings.dusun ? `${settings.dusun} ` : ''}${settings.village} ${settings.district} ${settings.regency}`;
  const image = settings.logoUrl || "/vite.svg";

  let html = fs.readFileSync("index.html", "utf-8");
  html = html.replace(/<title>.*<\/title>/, `<title>${pageTitle}</title>`);
  html = html.replace(/<meta name="description" content=".*" \/>/, `<meta name="description" content="${desc}" />`);
  html = html.replace(/<meta property="og:title" content=".*" \/>/, `<meta property="og:title" content="${pageTitle}" />`);
  html = html.replace(/<meta property="og:description" content=".*" \/>/, `<meta property="og:description" content="${desc}" />`);
  html = html.replace(/<meta property="og:image" content=".*" \/>/, `<meta property="og:image" content="${image}" />`);

  fs.writeFileSync("index.html", html);
  console.log("Updated index.html!");
}

run();
