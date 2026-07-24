'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated } from '../../lib/auth';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (pathname === '/login') {
      setListo(true);
      return;
    }
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setListo(true);
  }, [pathname, router]);

  if (!listo) return null;
  return <>{children}</>;
}
