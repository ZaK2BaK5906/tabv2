export const fetchNui = async <T>(event: string, data?: unknown): Promise<T> => {
  const resource = (window as Window & { GetParentResourceName?: () => string })
    .GetParentResourceName?.();

  const response = await fetch(`https://${resource ?? 'mdt_premium'}/${event}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data ?? {})
  });

  return response.json();
};
