import { Suspense, useEffect, useCallback } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import ShellLayout from '../layouts/ShellLayout';
import { routes } from './routes';
import { useUiStore } from '../store/uiStore';
import { usePlayerStore } from '../store/playerStore';
import { fetchNui } from '../features/nui';

const App = () => {
  const navigate = useNavigate();
  const { isOpen, setOpen } = useUiStore();
  const { fetchPlayer, clearPlayer } = usePlayerStore();

  const handleClose = useCallback(() => {
    setOpen(false);
    clearPlayer();
    fetchNui('mdt:close').catch(() => undefined);
  }, [setOpen, clearPlayer]);

  // Listen for NUI messages from client
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:open') {
        setOpen(true);
        fetchPlayer();
        if (typeof event.data.route === 'string') {
          navigate(event.data.route);
        }
      }
      if (event.data?.type === 'mdt:close') {
        setOpen(false);
        clearPlayer();
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate, setOpen, fetchPlayer, clearPlayer]);

  // Listen for Escape key to close tablet
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Toggle body class for CSS visibility
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('mdt-open');
    } else {
      document.body.classList.remove('mdt-open');
    }
  }, [isOpen]);

  // Don't render anything when closed
  if (!isOpen) {
    return null;
  }

  return (
    <ShellLayout>
      <Suspense
        fallback={<div className="flex h-full items-center justify-center text-white/50">Chargement...</div>}
      >
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={<route.element />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ShellLayout>
  );
};

export default App;
