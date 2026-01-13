import Icon from './Icon';
import { fetchNui } from '../features/nui';

const handleClose = () => {
  fetchNui('mdt:close').catch(() => undefined);
};

const Topbar = () => (
  <header className="flex items-center justify-between border-b border-white/5 bg-base-900 px-10 py-6">
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-[0.2em] text-white/40">Entreprise</span>
      <h1 className="font-display text-2xl">Benny's Customs</h1>
    </div>
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-800 px-4 py-2 text-sm text-white/70">
        <Icon name="search" />
        <span>Rechercher...</span>
      </div>
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-surface-800 px-4 py-2 text-sm">
        <div className="text-right">
          <p className="text-xs text-white/50">Grade</p>
          <p className="font-medium">Directeur</p>
        </div>
        <div className="h-8 w-px bg-white/10"></div>
        <div className="text-right">
          <p className="text-xs text-white/50">Solde</p>
          <p className="font-medium">$1,245,600</p>
        </div>
      </div>
      <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-surface-800">
        <Icon name="bell" />
      </button>
      <button
        onClick={handleClose}
        className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5"
      >
        Fermer
      </button>
    </div>
  </header>
);

export default Topbar;
