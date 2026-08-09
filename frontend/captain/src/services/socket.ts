import { io, Socket } from 'socket.io-client';
import { getBackendURL } from '../config';

const getDeviceId = (): string => {
  let id = localStorage.getItem('pos_device_id');
  if (!id) {
    id = 'CAP-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
    localStorage.setItem('pos_device_id', id);
  }
  return id;
};

const getDeviceName = (): string => {
  return localStorage.getItem('pos_device_name') || 'Captain Device';
};

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const url = getBackendURL();
    console.log(`[Socket] Connecting to: ${url}`);
    
    socket = io(url, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling'],
      query: {
        deviceId: getDeviceId(),
        deviceType: 'Captain',
        deviceName: getDeviceName()
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && socket && !socket.connected) {
        console.log('[Socket] Page visible again — forcing reconnect');
        socket.connect();
      }
    });
  }
  return socket;
};

export const reconnectSocket = () => {
  if (socket) {
    console.log('[Socket] Disconnecting previous connection');
    socket.close();
    socket = null;
  }
  return getSocket();
};

export default getSocket();
