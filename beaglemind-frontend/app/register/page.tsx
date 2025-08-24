"use client";
import { signIn } from 'next-auth/react';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full border rounded-lg p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">Create your account</h1>
        <p className="text-sm text-gray-600 mb-6">Register with your Google account.</p>
        <button
          className="w-full py-2 px-4 bg-black text-white rounded hover:opacity-90"
          onClick={() => signIn('google')}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
