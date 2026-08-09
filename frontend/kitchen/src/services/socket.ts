import { io, Socket } from 'socket.io-client';

const getDeviceId = (): string => {
  let id = localStorage.getItem('pos_device_id');
  if (!id) {
    id = 'KDS-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
    localStorage.setItem('pos_device_id', id);
  }
  return id;
};

const getDeviceName = (): string => {
  return localStorage.getItem('pos_device_name') || 'Kitchen Display';
};

const getServerUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Dynamically use current origin (protocol + host + port)
    // Works whether backend runs on port 3100 (prod) or 3101 (dev)
    if (window.location.port === '5175' || window.location.port === '5173') {
      return `${window.location.protocol}//${window.location.hostname}:3101`;
    }
    return window.location.origin;
  }
  return 'http://localhost:3101';
};

export const socket: Socket = io(getServerUrl(), {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  timeout: 20000,
  query: {
    deviceId: getDeviceId(),
    deviceType: 'Kitchen',
    deviceName: getDeviceName()
  }
});

export const getSocket = () => socket;
