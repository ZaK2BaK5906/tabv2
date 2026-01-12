const icons: Record<string, string> = {
  grid: '⬚',
  'file-text': '📄',
  scale: '⚖️',
  car: '🚗',
  settings: '⚙️',
  bell: '🔔',
  search: '🔍',
  money: '💰',
  users: '👥',
  chart: '📈'
};

const Icon = ({ name }: { name: string }) => (
  <span className="text-lg">{icons[name] ?? '⬦'}</span>
);

export default Icon;
