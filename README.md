# TYDE Restaurant POS

A professional, local-first Restaurant Point of Sale system with real-time Captain App synchronization.

## Features

- **Local-First Architecture**: Works offline with local SQLite database.
- **Captain App**: Mobile order taking for servers.
- **Silent Printing**: Integration with QZ Tray for thermal printer support.
- **Real-time Sync**: Socket.IO for instant updates across devices.

## Version Control

- **Internal Tracking**: Use `public/version.json` to track stable releases and major updates.
- **Git Strategy**: Always commit changes before making major modifications to the core logic.
- **Data Safety**: All runtime data is stored in the `/data` directory. Do not modify these files manually.
- **Backups**: Run `node scripts/backup.js` regularly to save timestamped copies of your data to the `/backup` folder.

## Project Structure

- `/server`: Backend API and Socket.IO logic.
- `/src`: Frontend React application.
- `/data`: SQLite database and local configuration files.
- `/public`: Static assets, including `version.json`.
- `/scripts`: Utility scripts for maintenance and backups.

---
**⚠️ STABLE CORE**: Files marked with this comment contain critical logic. Proceed with caution when editing.
