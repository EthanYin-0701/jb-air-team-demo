import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { processJob } from '@/lib/worker';
import { getCatalogs } from '@/lib/openrouter';
import { checkDuration, supportedDurations } from '@/lib/video-params';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quoteId, petAssetId, danceAssetId, frameTimestamp, userPrompt, style, aspectRatio, duration, startTime } = body;

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

    // 时长必须落在报价所选视频模型的能力范围内：用当前目录快照重验，
    // 目录无法确认时暂停提交（不假定缓存模型永久可用）。
    let videoModel;
    try {
      const catalogs = await getCatalogs();
      videoModel = catalogs.videoModels.find(m => m.id === quote.videoModelId);
    } catch (error) {
      return NextResponse.json(
        { error: `Cannot verify the video model capabilities right now: ${error instanceof Error ? error.message : String(error)}` },
        { status: 503 },
      );
    }
    if (!videoModel) {
      return NextResponse.json({ error: 'The quoted video model is no longer available' }, { status: 400 });
    }

    const durationCheck = checkDuration(duration, supportedDurations(videoModel.videoInfo));
    if (!durationCheck.ok) {
      return NextResponse.json({ error: durationCheck.message }, { status: 400 });
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
        userPrompt,
        style,
        aspectRatio,
        duration: durationCheck.duration,
        startTime,
      },
      quoteId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Start in-process worker asynchronously
    processJob(jobId).catch(console.error);

    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET() {
  const jobs = db.jobs.list('local-user');
  return NextResponse.json(jobs);
}
