import { io, Socket } from 'socket.io-client';
import { getBackendURL } from '../config';

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
      transports: ['websocket', 'polling']
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
