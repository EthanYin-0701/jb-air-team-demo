import { NextResponse } from 'next/server';
import { getCatalogs } from '@/lib/openrouter';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const purpose = searchParams.get('purpose');

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is missing' }, { status: 500 });
    }

    const catalogs = await getCatalogs();

    if (purpose === 'prompt') {
      return NextResponse.json(catalogs.promptModels);
    } else if (purpose === 'video') {
      return NextResponse.json(catalogs.videoModels);
    }

    return NextResponse.json(catalogs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
