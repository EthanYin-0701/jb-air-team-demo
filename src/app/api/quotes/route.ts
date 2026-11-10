import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCatalogs, NO_PROMPT_OPTIMIZATION } from '@/lib/openrouter';

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

    const quoteId = Math.random().toString(36).substring(7);
    const quote = db.quotes.create({
      id: quoteId,
      ownerId: 'local-user',
      promptModelId,
      videoModelId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 mins
      params,
    });

    return NextResponse.json(quote);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
