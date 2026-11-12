'use client';

import { useEffect, useState } from 'react';

type Connection = 'checking' | 'online' | 'offline';

export function ApiStatus() {
  const [status, setStatus] = useState<Connection>('checking');

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const endpoint = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

    fetch(endpoint + '/api/v1/health', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error('API unreachable');
        return response.json() as Promise<{ service?: string; status?: string }>;
      })
      .then((payload) => {
        if (mounted) {
          setStatus(payload.status === 'ok' && payload.service === 'business-os-api' ? 'online' : 'offline');
        }
      })
      .catch(() => {
        if (mounted) setStatus('offline');
      })
      .finally(() => clearTimeout(timer));

    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const text = {
    checking: 'Checking API',
    online: 'API responding',
    offline: 'API not connected'
  }[status];

  return (
    <span className={'connection connection--' + status} role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      {text}
    </span>
  );
}
