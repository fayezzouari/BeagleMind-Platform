"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RemovedSearchRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/wizard');
  }, [router]);
  return (
    <div className="flex items-center justify-center h-screen bg-slate-950 text-slate-300">
      Redirecting to the new Hardware Wizard…
    </div>
  );
}
