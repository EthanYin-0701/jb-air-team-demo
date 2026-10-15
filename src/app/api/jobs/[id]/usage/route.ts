import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = db.jobs.get(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const invocations = db.invocations.listByJob(id);

  const usage = {
    totalInputTokens: invocations.reduce((sum, i) => sum + (i.inputTokens || 0), 0),
    totalOutputTokens: invocations.reduce((sum, i) => sum + (i.outputTokens || 0), 0),
    totalTokens: invocations.reduce((sum, i) => sum + (i.totalTokens || 0), 0),
    totalCost: invocations.reduce((sum, i) => sum + (i.cost || 0), 0),
    breakdown: invocations.map(i => ({
      step: i.step,
      modelId: i.modelId,
      tokens: i.totalTokens,
      cost: i.cost,
      status: i.status,
    })),
    settlementStatus: job.status === 'succeeded' || job.status === 'failed' ? 'settled' : 'pending',
  };

  return NextResponse.json(usage);
}
