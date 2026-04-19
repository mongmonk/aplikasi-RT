import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

async function run() {
  const result = await client.execute("SELECT * FROM app_settings WHERE id = 'global'");
  console.log(JSON.stringify(result.rows[0], null, 2));
}

run();
