import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef({});

  useEffect(() => {
    socketRef.current = io(API_URL || window.location.origin, {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => setConnected(true));
    socketRef.current.on('disconnect', () => setConnected(false));

    Object.entries(listenersRef.current).forEach(([event, cb]) => {
      socketRef.current.on(event, cb);
    });

    return () => socketRef.current?.disconnect();
  }, []);

  const on = (event, callback) => {
    listenersRef.current[event] = callback;
    socketRef.current?.on(event, callback);
  };

  return { socket: socketRef.current, connected, on };
}
