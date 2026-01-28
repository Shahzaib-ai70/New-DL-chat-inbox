module.exports = {
  apps: [{
    name: "dlchats-server",
    script: "./server.cjs",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: "production",
      PORT: 3002
    }
  }]
}
