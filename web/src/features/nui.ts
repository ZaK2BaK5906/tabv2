const getResourceName = () => {
  const nativeName = (window as Window & { GetParentResourceName?: () => string })
    .GetParentResourceName?.();
  if (nativeName) {
    return nativeName;
  }
  const host = window.location.hostname;
  if (host.startsWith('cfx-nui-')) {
    return host.replace('cfx-nui-', '');
  }
  return host || 'mdt_premium';
};

export const fetchNui = async <T>(event: string, data?: unknown): Promise<T> => {
  const resource = getResourceName();

  const response = await fetch(`https://${resource}/${event}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data ?? {})
  });

  return response.json();
};
