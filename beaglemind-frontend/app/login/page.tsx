"use client";
import { signIn } from 'next-auth/react';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded overflow-hidden bg-neutral-800 border border-neutral-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/beagleboard-logo.png" alt="BeagleBoard Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">BeagleMind</h1>
            <div className="text-sm text-neutral-400">BeagleBoard AI Assistant</div>
          </div>
        </div>

        <p className="text-sm text-neutral-400 mb-6">Sign in with your Google account to start chatting.</p>

        <button
          className="w-full py-2.5 px-4 rounded-md bg-white text-neutral-900 font-medium hover:bg-neutral-100 transition border border-neutral-300"
          onClick={() => signIn('google', { callbackUrl: '/' })}
        >
          Continue with Google
        </button>

        <div className="mt-6 text-xs text-neutral-500">
          By continuing, you agree to our{' '}
          <Link href="#" className="underline hover:text-neutral-300">Terms</Link>{' '}and{' '}
          <Link href="#" className="underline hover:text-neutral-300">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}
