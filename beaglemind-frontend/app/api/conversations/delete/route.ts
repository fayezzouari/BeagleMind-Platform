import { NextResponse } from 'next/server';

const KB_URL = process.env.KNOWLEDGE_BASE_URL || 'http://beaglemind-api:8000';

export async function POST(req: Request) {
  const body = await req.json();
  const r = await fetch(`${KB_URL}/api/conversations/delete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
