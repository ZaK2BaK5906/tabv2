import { lazy } from 'react';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const Invoices = lazy(() => import('../pages/Invoices'));
const Employees = lazy(() => import('../pages/Employees'));
const Commissions = lazy(() => import('../pages/Commissions'));
const Partnerships = lazy(() => import('../pages/Partnerships'));
const Taxes = lazy(() => import('../pages/Taxes'));
const Dealership = lazy(() => import('../pages/Dealership'));

export const routes = [
  { path: '/', label: 'Dashboard', element: Dashboard, icon: 'grid' },
  { path: '/invoices', label: 'Factures', element: Invoices, icon: 'file-text' },
  { path: '/employees', label: 'Employés', element: Employees, icon: 'users' },
  { path: '/commissions', label: 'Commissions', element: Commissions, icon: 'money' },
  { path: '/partnerships', label: 'Partenariats', element: Partnerships, icon: 'handshake' },
  { path: '/taxes', label: 'Taxes / DOJ', element: Taxes, icon: 'scale' },
  { path: '/dealership', label: 'Concession', element: Dealership, icon: 'car' }
];
