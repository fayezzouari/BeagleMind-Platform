import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const KB_URL = process.env.KNOWLEDGE_BASE_URL || 'http://beaglemind-api:8000';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const body = await req.json();
  const title: string = body?.title || 'New Chat';
  const payload = {
    user_id: (session as unknown as { user_sub?: string })?.user_sub || undefined,
    user_email: session?.user?.email || undefined,
  title,
  first_message: body?.first_message,
  };
  const r = await fetch(`${KB_URL}/api/conversations`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
