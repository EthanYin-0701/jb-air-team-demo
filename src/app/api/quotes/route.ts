import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCatalogs, NO_PROMPT_OPTIMIZATION } from '@/lib/openrouter';
import { checkDuration, supportedDurations } from '@/lib/video-params';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { promptModelId, videoModelId, params } = body;

    const catalogs = await getCatalogs();
    // 选择「不优化」时无需存在对应的提示词模型，其余情况仍必须命中目录。
    const skipPromptOptimization = promptModelId === NO_PROMPT_OPTIMIZATION;
    const promptModel = catalogs.promptModels.find(m => m.id === promptModelId);
    const videoModel = catalogs.videoModels.find(m => m.id === videoModelId);

    if ((!skipPromptOptimization && !promptModel) || !videoModel) {
      return NextResponse.json({ error: 'Invalid model selection' }, { status: 400 });
    }

    // 报价时就锁定时长：只接受所选视频模型 supported_durations 内的值，
    // 避免用户填了模型不支持的长度到生成阶段才失败。
    const supported = supportedDurations(videoModel.videoInfo);
    const quotedParams: Record<string, unknown> = { ...(params ?? {}) };
    const rawDuration = quotedParams.duration;

    if (rawDuration != null || supported.length > 0) {
      const durationCheck = checkDuration(rawDuration, supported);
      if (!durationCheck.ok) {
        return NextResponse.json({ error: durationCheck.message }, { status: 400 });
      }
      quotedParams.duration = durationCheck.duration;
    }

    const quoteId = Math.random().toString(36).substring(7);
    const quote = db.quotes.create({
      id: quoteId,
      ownerId: 'local-user',
      promptModelId,
      videoModelId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 mins
      params: quotedParams,
    });

    return NextResponse.json(quote);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
