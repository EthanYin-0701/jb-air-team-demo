import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { processJob } from '@/lib/worker';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quoteId, petAssetId, danceAssetId, frameTimestamp, style, aspectRatio, duration, startTime } = body;

    const quote = db.quotes.get(quoteId);
    if (!quote) return NextResponse.json({ error: 'Invalid quote' }, { status: 400 });

    if (new Date(quote.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Quote expired' }, { status: 400 });
    }

    const jobId = Math.random().toString(36).substring(7);
    const job = db.jobs.create({
      id: jobId,
      ownerId: 'local-user',
      promptModelId: quote.promptModelId,
      videoModelId: quote.videoModelId,
      status: 'queued',
      inputs: {
        petAssetId,
        danceAssetId,
        frameTimestamp,
        style,
        aspectRatio,
        duration,
        startTime,
      },
      quoteId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Start in-process worker asynchronously
    processJob(jobId).catch(console.error);

    return NextResponse.json(job);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const jobs = db.jobs.list('local-user');
  return NextResponse.json(jobs);
}
