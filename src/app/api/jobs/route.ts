import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { processJob } from '@/lib/worker';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quoteId, petAssetId, danceAssetId, musicAssetId, frameTimestamp, userPrompt, style, aspectRatio, duration, startTime } = body;

    const quote = db.quotes.get(quoteId);
    if (!quote) return NextResponse.json({ error: 'Invalid quote' }, { status: 400 });

    if (new Date(quote.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Quote expired' }, { status: 400 });
    }

    if (!petAssetId || !db.assets.get(petAssetId)) {
      return NextResponse.json({ error: 'Invalid pet asset' }, { status: 400 });
    }

    // 参考舞蹈视频是可选的：仅当客户端确实带来了素材 id 时才校验与保存。
    if (danceAssetId && !db.assets.get(danceAssetId)) {
      return NextResponse.json({ error: 'Invalid dance reference asset' }, { status: 400 });
    }

    // 参考音乐同样是可选的高级选项，校验规则与参考舞蹈视频一致。
    if (musicAssetId && !db.assets.get(musicAssetId)) {
      return NextResponse.json({ error: 'Invalid music reference asset' }, { status: 400 });
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
        musicAssetId,
        frameTimestamp,
        userPrompt,
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
