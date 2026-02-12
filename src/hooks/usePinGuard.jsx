import React, { useCallback, useRef, useState } from 'react';
import PINModal from '@/components/PINModal';
import { useSecurity } from '@/lib/SecurityContext';

export function usePinGuard() {
  const { isSessionVerified, verifyPin, setSessionVerified } = useSecurity();

  const [modalOpen, setModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [modalTitle, setModalTitle] = useState('Confirmar con PIN');
  const pendingCallbackRef = useRef(null);

  const askPin = useCallback(
    async (callback, title = 'Confirmar con PIN') => {
      if (typeof callback !== 'function') return;

      if (isSessionVerified) {
        return callback();
      }

      pendingCallbackRef.current = callback;
      setModalTitle(title);
      setModalOpen(true);
    },
    [isSessionVerified]
  );

  const handleConfirm = useCallback(
    async (pin) => {
      setIsVerifying(true);
      try {
        const isValid = await verifyPin(pin);
        if (!isValid) return false;

        setSessionVerified(true);
        const callback = pendingCallbackRef.current;
        pendingCallbackRef.current = null;
        setModalOpen(false);

        if (typeof callback === 'function') {
          await callback();
        }

        return true;
      } finally {
        setIsVerifying(false);
      }
    },
    [setSessionVerified, verifyPin]
  );

  const handleClose = useCallback(() => {
    pendingCallbackRef.current = null;
    setModalOpen(false);
  }, []);

  const PinGuardModal = useCallback(
    () => (
      <PINModal
        open={modalOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        isLoading={isVerifying}
        title={modalTitle}
      />
    ),
    [modalOpen, handleClose, handleConfirm, isVerifying, modalTitle]
  );

  return { askPin, PinGuardModal };
}
