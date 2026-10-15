import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage');

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  // Simplification: check for an opaque token "mvp-token"
  if (token !== 'mvp-token') {
    return new Response('Unauthorized', { status: 403 });
  }

  const filePath = path.join(STORAGE_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return new Response('Not Found', { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  const mimeType = filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': mimeType,
    },
  });
}
