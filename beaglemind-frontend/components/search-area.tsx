"use client";

import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchItem {
  link: string;
  title: string;
  snippet: string;
}

export function SearchArea() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await resp.json();
      setResults(data.results || []);
  } catch (err: unknown) {
  setError('Failed to search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollArea className="flex-1 h-full">
      {/* Empty state with centered search box */}
      {results.length === 0 && !loading && !error ? (
        <div className="p-4">
          <div className="max-w-2xl mx-auto mt-24 text-center">
            <img src="/beagleboard-logo.png" alt="BeagleBoard Logo" className="w-20 h-20 object-contain mx-auto mb-6" />
            <h1 className="text-3xl font-semibold mb-4">BeagleMind Search</h1>
            <form onSubmit={onSearch} className="flex gap-2">
              <input
                className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-3 text-sm outline-none focus:border-cyan-600"
                placeholder="Search BeagleBoard docs, guides, and examples"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-3 rounded-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-sm"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      ) : (
        // Results list view
        <div className="p-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={onSearch} className="flex items-center gap-2 mb-6">
              <input
                className="w-full bg-slate-900 border border-slate-700 rounded-full px-4 py-2 text-sm outline-none focus:border-cyan-600"
                placeholder="Search BeagleBoard knowledge..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-4 py-2 rounded-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-sm"
              >
                Search
              </button>
            </form>

            {loading && <div className="text-slate-400 text-sm">Searching…</div>}
            {error && <div className="text-red-400 text-sm">{error}</div>}

            <ul className="space-y-6">
              {results.map((r, idx) => (
                <li key={idx}>
                  <div className="text-xs text-cyan-400 mb-1 truncate">{r.link}</div>
                  <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-lg text-cyan-300 hover:underline">
                    {r.title}
                  </a>
                  <p className="text-slate-300 text-xs mt-2 leading-relaxed">
                    {r.snippet}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </ScrollArea>
  );
}
