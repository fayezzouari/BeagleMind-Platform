import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const KB_URL = process.env.KNOWLEDGE_BASE_URL || 'http://beaglemind-api:8000';

export async function POST() {
  const session = await getServerSession(authOptions);
  // If no authenticated user context, return empty list gracefully
  const userSub = (session as unknown as { user_sub?: string })?.user_sub || undefined;
  const userEmail = session?.user?.email || undefined;
  if (!userSub && !userEmail) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
  const payload = {
    user_id: userSub,
    user_email: userEmail,
    limit: 50,
  };
  try {
    const r = await fetch(`${KB_URL}/api/conversations/list`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!r.ok) {
      // On upstream errors, return empty list to avoid breaking the UI
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    type ConversationListItem = { id: string; title?: string; lastMessage?: string; updated_at?: string };
    type ConversationListResponse = { items?: ConversationListItem[] };
    const data: unknown = await r.json();
    const isResponse = (val: unknown): val is ConversationListResponse => {
      return typeof val === 'object' && val !== null && Array.isArray((val as { items?: unknown }).items ?? []);
    };
    // Normalize to expected shape; fallback to empty list if missing
    const items: ConversationListItem[] = isResponse(data) ? (data.items ?? []) : [];
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    // Network errors/timeouts: ignore and return empty list
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
