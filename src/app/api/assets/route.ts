import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateUrl } from '@/lib/ssrf';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, role, source, url } = body;

    const assetId = Math.random().toString(36).substring(7);

    if (source === 'url') {
      if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });
      
      await validateUrl(url);

      // In a real app, we'd start a background task to download the asset.
      // For MVP, we'll just record it and mark it as ready if it passes validation.
      const asset = db.assets.create({
        id: assetId,
        ownerId: 'local-user',
        type,
        role,
        source: 'url',
        url,
        status: 'ready', // Simplification: assume ready if URL is valid
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json(asset);
    } else {
      // For upload, we'd normally return a signed URL.
      // Here we just return the asset ID and expect the client to "upload" it.
      const asset = db.assets.create({
        id: assetId,
        ownerId: 'local-user',
        type,
        role,
        source: 'upload',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json(asset);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Mock upload endpoint
export async function PUT(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'File is required' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${id}-${file.name}`;
  const filePath = path.join(STORAGE_DIR, fileName);

  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  fs.writeFileSync(filePath, buffer);

  db.assets.update(id, {
    status: 'ready',
    localPath: filePath,
    metadata: { size: file.size, name: file.name },
  });

  return NextResponse.json({ success: true });
}
