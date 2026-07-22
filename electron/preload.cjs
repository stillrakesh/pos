const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printHtml: (html, printerName) => ipcRenderer.invoke('print-html', html, printerName),
  printRawTcp: (buffer, ip, port) => ipcRenderer.invoke('print-raw-tcp', buffer, ip, port),
  printRawUsb: (buffer, printerName) => ipcRenderer.invoke('print-raw-usb', buffer, printerName),
  printPdfUsb: (html, printerName) => ipcRenderer.invoke('print-pdf-usb', html, printerName)
});
