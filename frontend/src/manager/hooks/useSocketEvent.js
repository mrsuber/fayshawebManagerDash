import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

/** Subscribes to a Socket.io event for the lifetime of the component. No-op without a live socket. */
export default function useSocketEvent(event, handler) {
  const socket = useSocket();
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!socket) return undefined;
    const fn = (payload) => ref.current(payload);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
