import { NavLink } from 'react-router-dom';
import { routes } from '../app/routes';
import Icon from '../components/Icon';
import Topbar from '../components/Topbar';
import { usePlayerStore } from '../store/playerStore';

const ShellLayout = ({ children }: { children: React.ReactNode }) => {
  const { player } = usePlayerStore();

  // Determine user role
  const jobName = player?.job?.name || 'unemployed';
  const isBoss = player?.isBoss ?? false;
  const isDoj = jobName === 'doj';
  const isDealership = jobName === 'dealership' || jobName === 'cardealer' || jobName === 'concessionnaire';
  const isUnemployed = !jobName || jobName === 'unemployed';

  // Filter routes based on player role
  const visibleRoutes = routes.filter((route) => {
    // Citizen (unemployed) - only sees their invoices
    if (isUnemployed) {
      return route.path === '/my-invoices';
    }

    // DOJ page - only for DOJ
    if (route.path === '/taxes') {
      return isDoj;
    }

    // Dealership page - only for dealership jobs
    if (route.path === '/dealership') {
      return isDealership;
    }

    // Boss-only pages
    if (route.path === '/employees' || route.path === '/commissions' || route.path === '/partnerships' || route.path === '/products') {
      return isBoss;
    }

    // Employee pages: Dashboard, Invoices, MyInvoices
    if (route.path === '/' || route.path === '/invoices' || route.path === '/my-invoices') {
      return true;
    }

    return false;
  });

  return (
    <div className="nui-root">
      <div className="tablet-frame">
        <aside className="flex w-24 flex-col items-center gap-6 border-r border-white/5 bg-base-900/80 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-soft">
            <span className="font-display text-lg">MDT</span>
          </div>
          <nav className="flex flex-1 flex-col gap-2">
            {visibleRoutes.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                title={route.label}
                className={({ isActive }) =>
                  [
                    'flex h-12 w-12 items-center justify-center rounded-2xl border border-transparent text-white/70 transition',
                    isActive
                      ? 'border-white/10 bg-surface-800 text-white shadow-card'
                      : 'hover:border-white/10 hover:bg-surface-700'
                  ].join(' ')
                }
              >
                <Icon name={route.icon} />
              </NavLink>
            ))}
          </nav>
          <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 text-white/70 transition hover:bg-surface-700">
            <Icon name="settings" />
          </button>
        </aside>
        <main className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex-1 overflow-y-auto px-6 pb-10 pt-6 scrollbar-thin xl:px-10">
            <div className="mx-auto w-full max-w-[1400px]">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ShellLayout;
