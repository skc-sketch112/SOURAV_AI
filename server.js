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
  const html = 
    <html>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
        <h2>📱 Scan this QR with WhatsApp</h2>
        <img src="${latestQR}" style="width:300px;height:300px;">
      </body>
    </html>;
  res.send(html);
});

// Start server
app.listen(PORT, () => {
  console.log(chalk.green(🌐 Keep-alive server running on port ${PORT}));
});

// Export for index.js to update QR dynamically
module.exports = {
  setQR: (qr) => { latestQR = qr; }
};
