import { lazy } from 'react';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const Invoices = lazy(() => import('../pages/Invoices'));
const MyInvoices = lazy(() => import('../pages/MyInvoices'));
const Employees = lazy(() => import('../pages/Employees'));
const Commissions = lazy(() => import('../pages/Commissions'));
const Partnerships = lazy(() => import('../pages/Partnerships'));
const Products = lazy(() => import('../pages/Products'));
const Taxes = lazy(() => import('../pages/Taxes'));
const Dealership = lazy(() => import('../pages/Dealership'));

// Routes for the main tablet (employees/boss)
export const routes = [
  { path: '/', label: 'Dashboard', element: Dashboard, icon: 'grid' },
  { path: '/invoices', label: 'Factures', element: Invoices, icon: 'file-text' },
  { path: '/my-invoices', label: 'Mes Factures', element: MyInvoices, icon: 'receipt' },
  { path: '/employees', label: 'Employés', element: Employees, icon: 'users' },
  { path: '/commissions', label: 'Commissions', element: Commissions, icon: 'money' },
  { path: '/partnerships', label: 'Partenariats', element: Partnerships, icon: 'handshake' },
  { path: '/products', label: 'Produits', element: Products, icon: 'tag' },
  { path: '/taxes', label: 'Taxes / DOJ', element: Taxes, icon: 'scale' },
  { path: '/dealership', label: 'Concession', element: Dealership, icon: 'car' }
];

// Routes for citizen invoice menu (simplified)
export const citizenRoutes = [
  { path: '/my-invoices', label: 'Mes Factures', element: MyInvoices, icon: 'receipt' }
];
