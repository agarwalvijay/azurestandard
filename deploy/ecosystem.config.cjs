// pm2 process config for the Azure Standard push backend.
//   cd ~/azurestandard && pm2 start deploy/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "azurestandard",
      script: "server.js",
      cwd: "/home/vagarwal/azurestandard/backend",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
