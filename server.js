// ================== IMPORTS ==================
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const chalk = require("chalk");
const pino = require("pino");
const figlet = require("figlet");
const moment = require("moment");
const axios = require("axios");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const server = require("./server"); // Import server to update QR

// ================== CONFIG ==================
const DEBUG_MODE = process.env.DEBUG_MODE === "true";
const PLUGIN_REPO = process.env.PLUGIN_REPO || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const REMOTE_PLUGIN_DIR = path.join(__dirname, "remote_plugins");
const LOCAL_PLUGIN_DIR = path.join(__dirname, "plugins");

// ================== DEBUG ==================
function debugLog(...msg) {
  if (DEBUG_MODE) console.log(chalk.cyan("[DEBUG]"), ...msg);
}

// ================== BANNER ==================
figlet.text("SOURAV_MD BOT", { font: "Standard" }, (err, data) => {
  if (!err) console.log(chalk.magenta("\n" + data));
  console.log(chalk.yellow("🔥 Welcome to SOURAV_MD BOT - Fully Powered & Professional!\n"));
});

// ================== PLUGIN SYSTEM ==================
const commands = new Map();

function loadPlugin(filePath) {
  try {
    delete require.cache[require.resolve(filePath)];
    const plugin = require(filePath);
    const name = plugin.name || path.basename(filePath, ".js");
    const aliases = Array.isArray(plugin.command)
      ? plugin.command.map(c => c.toLowerCase())
      : [plugin.command?.toLowerCase() || name.toLowerCase()];
    aliases.forEach(alias => commands.set(alias, plugin));
    console.log(chalk.green("✅ Loaded plugin:"), chalk.cyan(name), `[${aliases.join(", ")}]`);
  } catch (err) {
    console.error(chalk.red(`❌ Failed to load plugin ${filePath}:`), err.message);
  }
}

function loadPluginsFromDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir)
    .filter(f => f.endsWith(".js"))
    .forEach(file => loadPlugin(path.join(dir, file)));
}

async function cloneRemotePlugins() {
  if (!PLUGIN_REPO) return console.log(chalk.gray("🔒 No remote plugin repo configured."));
  if (fs.existsSync(REMOTE_PLUGIN_DIR)) {
    try {
      console.log(chalk.cyan("🔄 Pulling latest remote plugins..."));
      execSync(`cd ${REMOTE_PLUGIN_DIR} && git pull origin main`, { stdio: "ignore" });
      return;
    } catch {
      console.log(chalk.yellow("⚠️ Pull failed, cloning fresh..."));
      fs.rmSync(REMOTE_PLUGIN_DIR, { recursive: true, force: true });
    }
  }

  try {
    console.log(chalk.cyan("🌍 Cloning remote plugins..."));
    const repoUrl = PLUGIN_REPO.replace("https://", `https://${GITHUB_TOKEN}@`);
    execSync(`git clone ${repoUrl} ${REMOTE_PLUGIN_DIR}`, { stdio: "ignore" });
    console.log(chalk.green("✅ Remote plugins cloned successfully."));
  } catch (err) {
    console.error(chalk.red("❌ Failed to clone remote plugins:"), err.message);
  }
}

async function loadAllPlugins() {
  commands.clear();
  console.log(chalk.yellow("📦 Loading all plugins..."));
  loadPluginsFromDir(LOCAL_PLUGIN_DIR);
  loadPluginsFromDir(path.join(REMOTE_PLUGIN_DIR, "plugins"));
  console.log(chalk.green(`✨ Loaded ${commands.size} total plugins.`));
}

// ================== HOT RELOAD SYSTEM ==================
async function startHotReload(interval = 60000) {
  setInterval(async () => {
    try {
      debugLog("🔁 Checking for plugin updates...");
      if (PLUGIN_REPO) {
        execSync(`cd ${REMOTE_PLUGIN_DIR} && git fetch origin main`, { stdio: "ignore" });
        const latest = execSync(`cd ${REMOTE_PLUGIN_DIR} && git rev-parse origin/main`).toString().trim();
        const current = execSync(`cd ${REMOTE_PLUGIN_DIR} && git rev-parse HEAD`).toString().trim();
        if (latest !== current) {
          console.log(chalk.yellow("⚡ New updates found — pulling & reloading..."));
          execSync(`cd ${REMOTE_PLUGIN_DIR} && git pull origin main`, { stdio: "ignore" });
          await loadAllPlugins();
        }
      }
    } catch (err) {
      console.error(chalk.red("❌ Hot reload failed:"), err.message);
    }
  }, interval);
}

// ================== START BOT ==================
async function startBot() {
  await cloneRemotePlugins();
  await loadAllPlugins();

  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    version
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
      server.setQR(qrUrl); // update server.js QR
      console.log(chalk.blue("📲 Scan your QR here:") + chalk.cyan(qrUrl));
    }

    if (connection === "open") {
      console.log(chalk.green("✅ SOURAV_MD BOT CONNECTED SUCCESSFULLY!"));
      startHotReload();
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error)?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) startBot();
      else console.log(chalk.red("❌ Logged out. Delete 'auth' folder and restart."));
    }
  });

  // ================== MESSAGE HANDLER ==================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;

    let body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption ||
      m.message.videoMessage?.caption ||
      "";

    if (!body.startsWith(".")) return;
    const args = body.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // Manual reload
    if (cmd === "reload") {
      await sock.sendMessage(m.key.remoteJid, { text: "♻️ Reloading all plugins..." });
      await cloneRemotePlugins();
      await loadAllPlugins();
      return await sock.sendMessage(m.key.remoteJid, { text: "✅ Plugins reloaded successfully!" });
    }

    const command = commands.get(cmd);
    if (command && typeof command.execute === "function") {
      try {
        console.log(chalk.blue(`[CMD] Executing: ${cmd}`));
        await command.execute(sock, m, args, { axios, downloadContentFromMessage });
        console.log(chalk.green(`⚡ Command executed successfully: ${cmd}`));
      } catch (err) {
        console.error(chalk.red(`❌ Command ${cmd} error:`), err.message);
        await sock.sendMessage(m.key.remoteJid, { text: `⚠️ Error: ${err.message}` }, { quoted: m });
      }
    }
  });
}

// ================== ERROR HANDLERS ==================
process.on("uncaughtException", err => console.error(chalk.red("❌ Uncaught Exception:"), err));
process.on("unhandledRejection", err => console.error(chalk.red("❌ Unhandled Rejection:"), err));

// ================== START ==================
startBot();
