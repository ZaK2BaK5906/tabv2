const iconPaths: Record<string, string> = {
  grid: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z',
  'file-text':
    'M6 3h8l5 5v13H6V3zm8 1.5V9h4.5L14 4.5zM8 12h8M8 16h8M8 20h5',
  scale:
    'M12 3v3m-7 4h14M7 7l-4 6h8l-4-6zm10 0l-4 6h8l-4-6zM6 19h12',
  car:
    'M5 15l1.5-4h11L19 15m-1 4a1.5 1.5 0 1 1-3 0m-6 0a1.5 1.5 0 1 1-3 0M5 15h14',
  settings:
    'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm8 4l2 1-2 1-.5 1.5 1.2 1.7-1.4 1.4-1.7-1.2L14 19l-1 2-1-2-1.6-.5-1.7 1.2-1.4-1.4 1.2-1.7L4 14l-2-1 2-1 .5-1.5L3.3 8.8 4.7 7.4l1.7 1.2L10 6l1-2 1 2 1.6.5 1.7-1.2 1.4 1.4-1.2 1.7L20 12z',
  bell:
    'M12 4a4 4 0 0 1 4 4v3.5l1.5 2V15H6.5v-1.5L8 11.5V8a4 4 0 0 1 4-4zm0 16a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z',
  search:
    'M11 5a6 6 0 1 1-3.9 10.5L4 19l-1-1 3.5-3.1A6 6 0 0 1 11 5z',
  money: 'M12 5v14m-5-9h10m-9 4h8',
  users:
    'M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm8 0a3 3 0 1 0-2.8-4M2 20a6 6 0 0 1 12 0m2 0a5 5 0 0 1 6 0',
  chart: 'M5 19V9m6 10V5m6 14v-7',
  handshake:
    'M4 11l3-3 4 4 4-4 3 3-6 6-4-4-4 4-4-4',
  tag:
    'M3 11l8-8h7v7l-8 8-7-7zm12-5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  receipt:
    'M4 4h16v16l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L4 20V4zm4 4h8m-8 4h8m-8 4h4',
  clock:
    'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 4v4l3 3',
  check:
    'M5 12l5 5L20 7',
  lock:
    'M6 10V8a6 6 0 1 1 12 0v2m-12 0h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z',
  box:
    'M3 8l9-4 9 4v8l-9 4-9-4V8zm9-4v16m-9-12l9 4 9-4',
  'user-plus':
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm11-3v6m-3-3h6',
  building:
    'M3 21h18M5 21V7l8-4v18m6-10v10m-6-8h.01M9 17h.01M9 13h.01M9 9h.01',
  gavel:
    'M14.5 3l6 6L18 11.5l-6-6L14.5 3zM3 21l7-7m5-5l3 3m-10 2l3 3'
};

const Icon = ({ name }: { name: string }) => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={iconPaths[name] ?? iconPaths.grid} />
  </svg>
);

export default Icon;
