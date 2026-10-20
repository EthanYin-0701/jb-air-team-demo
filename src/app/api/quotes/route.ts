import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCatalogs } from '@/lib/openrouter';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { promptModelId, videoModelId, params } = body;

    const catalogs = await getCatalogs();
    const promptModel = catalogs.promptModels.find(m => m.id === promptModelId);
    const videoModel = catalogs.videoModels.find(m => m.id === videoModelId);

    if (!promptModel || !videoModel) {
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
