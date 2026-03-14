// PM2 Ecosystem File for ClawCraft Services
// Start with: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'clawcraft-relayer',
      script: 'npx',
      args: 'tsx scripts/relayer.ts',
      cwd: '/home/node/.openclaw/workspace/clawcraft',
      env: {
        RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY,
        CONVEX_URL: 'https://unique-sheep-164.convex.cloud',
        REPUTATION_REGISTRY_ADDRESS: '0x92E829A08B1Fe841A544F27Ca858d1fd4F919989',
      },
      // Restart settings
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/relayer-error.log',
      out_file: 'logs/relayer-out.log',
      merge_logs: true,
    },
  ],
};
