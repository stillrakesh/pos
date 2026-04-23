(async () => {
  try {
    await import('./main.js');
  } catch (err) {
    console.error('Failed to load ES Module main.js:', err);
    // If we're in Electron, show a dialog
    try {
      const { dialog } = require('electron');
      dialog.showErrorBox('Launch Error', 'Failed to load application logic:\n' + err.message);
    } catch (e) {}
    process.exit(1);
  }
})();
