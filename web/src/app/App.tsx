import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ShellLayout from '../layouts/ShellLayout';
import { routes } from './routes';

const App = () => (
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

export default App;
