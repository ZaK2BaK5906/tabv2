import { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import ShellLayout from '../layouts/ShellLayout';
import { routes } from './routes';

const App = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'mdt:open') {
        return;
      }
      if (typeof event.data.route === 'string') {
        navigate(event.data.route);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [navigate]);

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
