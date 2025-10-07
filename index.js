// ================== IMPORTS ==================
const express = require("express");
const chalk = require("chalk");

// ================== CONFIG ==================
const PORT = process.env.PORT || 3000;
let latestQR = null; // QR code URL from index.js

// ================== EXPRESS SERVER ==================
const app = express();

// Keep-alive / status
app.get("/", (req, res) => {
  res.send("✅ SOURAV_MD BOT is running and alive!");
});

// QR code endpoint
app.get("/qr", (req, res) => {
  if (!latestQR) return res.send("⏳ QR not ready yet, please wait...");

  const html = `
    <html>
      <head>
        <title>SOURAV_MD BOT QR</title>
        <style>
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: Arial, sans-serif;
            background: #1a1a1a;
            color: #fff;
          }
          h2 {
            margin-bottom: 20px;
            font-size: 2em;
          }
          img {
            border: 4px solid #4caf50;
            border-radius: 12px;
          }
        </style>
      </head>
      <body>
        <h2>📱 Scan this QR with WhatsApp</h2>
        <img src="${latestQR}" alt="WhatsApp QR Code">
      </body>
    </html>
  `;

  res.send(html);
});

// Start server
app.listen(PORT, () => {
  console.log(chalk.green(`🌐 Keep-alive server running on port ${PORT}`));
});

// ================== EXPORT FOR INDEX.JS ==================
// Allows index.js to update QR dynamically
module.exports = {
  setQR: (qr) => { latestQR = qr; }
};
