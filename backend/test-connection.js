const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client
  .connect()
  .then(() => {
    console.log("✅ Connected successfully!");
    return client.end();
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
  });
