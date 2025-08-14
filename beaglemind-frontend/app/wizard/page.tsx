"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { WizardArea } from '@/components/wizard-area';

export default function WizardPage() {
  // Sidebar removed for project planning section per requirements

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between h-14 px-5 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded overflow-hidden bg-neutral-800 border border-neutral-700">
                <img src="/beagleboard-logo.png" alt="BeagleBoard Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white tracking-tight">Project Wizard</h1>
                <div className="text-[11px] text-neutral-400">Structured BeagleBoard planning</div>
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="text-neutral-300 hover:text-white transition-colors">Chat</Link>
            <span className="text-neutral-500 hidden md:block">Project Planning</span>
          </nav>
        </header>
        <div className="flex-1 overflow-hidden">
          <WizardArea />
        </div>
      </div>
    </div>
  );
}
