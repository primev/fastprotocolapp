import { Pool } from "pg"

// SSL configuration to allow self-signed certificates
// Setting rejectUnauthorized: false allows connections with self-signed certificates
const sslConfig = {
  rejectUnauthorized: false,
}

// Parse connection string to remove any conflicting SSL parameters
let connectionString = process.env.FAST_DAPP_DB_URL || ""

// Remove sslmode from connection string if present, as we'll set it via the ssl option
if (connectionString) {
  connectionString = connectionString
    .replace(/[?&]sslmode=[^&]*/gi, "")
    .replace(/[?&]ssl=[^&]*/gi, "")
}

const pool = new Pool({
  connectionString,
  // Explicitly set SSL config to allow self-signed certificates
  // This will be used regardless of what's in the connection string
  ssl: sslConfig,
})

export { pool }
