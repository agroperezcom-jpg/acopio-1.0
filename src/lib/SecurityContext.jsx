import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const SecurityContext = createContext(null);

export function SecurityProvider({ children }) {
  const [isSessionVerified, setIsSessionVerifiedState] = useState(false);

  const { data: pinConfig = null, isLoading: isPinLoading } = useQuery({
    queryKey: ['security', 'pin-config'],
    queryFn: async () => {
      const configs = await base44.entities.Configuracion.filter(
        { clave: 'pin_seguridad' },
        '-created_date',
        1
      );
      return Array.isArray(configs) && configs.length > 0 ? configs[0] : null;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const verifyPin = useCallback(
    async (inputPin) => {
      if (isPinLoading) return false;
      const pinIngresado = String(inputPin ?? '').trim();
      const pinGuardado = String(pinConfig?.valor ?? '0000').trim();
      return pinIngresado !== '' && pinIngresado === pinGuardado;
    },
    [pinConfig, isPinLoading]
  );

  const setSessionVerified = useCallback((value = true) => {
    setIsSessionVerifiedState(Boolean(value));
  }, []);

  const value = useMemo(
    () => ({
      isSessionVerified,
      verifyPin,
      setSessionVerified,
      isPinLoading,
      pinConfig
    }),
    [isSessionVerified, verifyPin, setSessionVerified, isPinLoading, pinConfig]
  );

  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}
