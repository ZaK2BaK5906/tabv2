import { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import ShellLayout from '../layouts/ShellLayout';
import { routes } from './routes';
import { useUiStore } from '../store/uiStore';

const App = () => {
  const navigate = useNavigate();
  const { isOpen, setOpen } = useUiStore();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mdt:open') {
        setOpen(true);
        if (typeof event.data.route === 'string') {
          navigate(event.data.route);
        }
      }
      if (event.data?.type === 'mdt:close') {
        setOpen(false);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate, setOpen]);

  useEffect(() => {
    if (typeof (window as Window & { GetParentResourceName?: () => string }).GetParentResourceName !== 'function') {
      setOpen(true);
    }
  }, [setOpen]);

  useEffect(() => {
    document.body.classList.toggle('mdt-open', isOpen);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <ShellLayout>
      <Suspense
        fallback={<div className="flex h-full items-center justify-center">Chargement...</div>}
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
