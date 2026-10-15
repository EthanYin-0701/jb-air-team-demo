import { parseVideoJobStatus } from '../lib/openrouter';

/**
 * GET /api/v1/videos/{jobId} 的响应是**顶层对象**（官方 `VideoGenerationResponse`）：
 * { id, polling_url, status, error?, generation_id?, unsigned_urls?, usage? }
 * 曾按 `data.status` 读取，导致 "Cannot read properties of undefined (reading 'status')"。
 */
describe('parseVideoJobStatus', () => {
  it('reads the top-level status response', () => {
    const parsed = parseVideoJobStatus({
      id: 'gen-vid-1',
      polling_url: 'https://openrouter.ai/api/v1/videos/gen-vid-1',
      status: 'in_progress',
      unsigned_urls: ['https://cdn.example.com/out.mp4'],
      usage: { cost: 0.05 },
    });

    expect(parsed.status).toBe('in_progress');
    expect(parsed.pollingUrl).toBe('https://openrouter.ai/api/v1/videos/gen-vid-1');
    expect(parsed.unsignedUrls).toEqual(['https://cdn.example.com/out.mp4']);
    expect(parsed.usage?.cost).toBe(0.05);
  });

  it('accepts every documented terminal state', () => {
    for (const status of ['pending', 'in_progress', 'completed', 'failed', 'cancelled', 'expired']) {
      expect(parseVideoJobStatus({ id: 'x', status }).status).toBe(status);
    }
  });

  it('flattens the string error field', () => {
    const parsed = parseVideoJobStatus({ id: 'x', status: 'failed', error: 'content policy' });
    expect(parsed.error).toBe('content policy');
  });

  it('rejects unexpected shapes with a diagnosable error', () => {
    expect(() => parseVideoJobStatus({ data: { status: 'completed' } })).toThrow(
      /Unexpected video status response/
    );
    expect(() => parseVideoJobStatus(undefined)).toThrow(/Unexpected video status response/);
  });
});
