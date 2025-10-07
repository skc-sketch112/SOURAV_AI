module.exports = {
  apps: [
    {
      name: "SOURAV_MD_BOT",
      script: "server.js",
      watch: true,              // watches for local file changes for hot reload
      ignore_watch: ["node_modules", "remote_plugins"], // don’t watch huge directories
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        DEBUG_MODE: "true",
        PLUGIN_REPO: "https://github.com/yourname/private-plugins.git",
        GITHUB_TOKEN: "" // optional if private repo
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
};
