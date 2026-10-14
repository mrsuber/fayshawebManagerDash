import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getToken } from '../api';
import config from '../config';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

/**
 * One Socket.io connection per signed-in session, authenticated with the JWT in the handshake
 * (`socket.handshake.auth.token` on the server). Disabled in mock mode.
 */
export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (config.useMocks || !user) return undefined;
    const s = io(config.socketUrl, { auth: { token: getToken() }, transports: ['websocket', 'polling'] });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
