import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const KB_URL = process.env.KNOWLEDGE_BASE_URL || 'http://beaglemind-api:8000';

export async function POST() {
  const session = await getServerSession(authOptions);
  const payload = {
    user_id: (session as unknown as { user_sub?: string })?.user_sub || undefined,
    user_email: session?.user?.email || undefined,
    limit: 50,
  };
  const r = await fetch(`${KB_URL}/api/conversations/list`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
