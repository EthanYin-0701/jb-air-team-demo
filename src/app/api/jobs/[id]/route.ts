import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = db.jobs.get(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Basic ownership check (simplification: single local user)
  if (job.ownerId !== 'local-user') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  return NextResponse.json(job);
}
