require("dotenv").config();
const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

client.connect()
  .then(() => {
    console.log("✅ Ulandi");
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
    return client.query("SELECT NOW()");
  })
  .then(res => {
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
    console.log(res.rows);
    process.exit(0);
  })
  .catch(err => {
    console.log("DATABASE_URL:", process.env.DATABASE_URL);
    console.error("❌ XATO:", err);
    process.exit(1);
  });