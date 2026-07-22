
let activeShifts = [];
let ioInstance = null;

export const setIo = (io) => {
  ioInstance = io;
};

export const getActiveShifts = () => activeShifts;

export const logShift = (from, to) => {
  // Remove any existing shift for the target table
  activeShifts = activeShifts.filter(s => String(s.to) !== String(to));
  
  activeShifts.push({
    from: String(from),
    to: String(to),
    timestamp: new Date().toISOString()
  });
  
  if (ioInstance) {
    ioInstance.emit('shift_history_updated', activeShifts);
  }
};

export const clearShiftForTable = (tableNumber) => {
  const originalLength = activeShifts.length;
  activeShifts = activeShifts.filter(s => String(s.to) !== String(tableNumber));
  
  if (activeShifts.length !== originalLength && ioInstance) {
    ioInstance.emit('shift_history_updated', activeShifts);
  }
};
