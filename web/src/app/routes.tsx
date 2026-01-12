import { lazy } from 'react';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const Invoices = lazy(() => import('../pages/Invoices'));
const Taxes = lazy(() => import('../pages/Taxes'));
const Dealership = lazy(() => import('../pages/Dealership'));

export const routes = [
  { path: '/', label: 'Dashboard', element: Dashboard, icon: 'grid' },
  { path: '/invoices', label: 'Factures', element: Invoices, icon: 'file-text' },
  { path: '/taxes', label: 'Taxes / DOJ', element: Taxes, icon: 'scale' },
  { path: '/dealership', label: 'Concession', element: Dealership, icon: 'car' }
];
