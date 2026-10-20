import { db, Job } from '../lib/db';
import { generateVideo, getJobStatus, refinePrompt } from '../lib/openrouter';
import { processJob } from '../lib/worker';

jest.mock('../lib/db', () => ({
  db: {
    jobs: { get: jest.fn(), update: jest.fn() },
    assets: { get: jest.fn() },
    invocations: { create: jest.fn() },
  },
}));

jest.mock('../lib/openrouter', () => ({
  refinePrompt: jest.fn(),
  generateVideo: jest.fn(),
  getJobStatus: jest.fn(),
  getJobContent: jest.fn(),
  buildBasePrompt: jest.fn(),
}));

describe('job video submission', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it.each([3, 8])('passes the selected duration of %s seconds to the provider', async duration => {
    const job: Job = {
      id: 'job-1',
      ownerId: 'local-user',
      promptModelId: 'prompt-model',
      videoModelId: 'video-model',
      status: 'queued',
      inputs: {
        petAssetId: 'pet-1',
        style: 'disco',
        aspectRatio: '9:16',
        duration,
        startTime: 0,
      },
      quoteId: 'quote-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    jest.mocked(db.jobs.get).mockReturnValue(job);
    jest.mocked(db.assets.get).mockReturnValue({
      id: 'pet-1', ownerId: 'local-user', type: 'image', role: 'pet',
      source: 'url', url: 'https://example.com/pet.jpg', status: 'ready',
      createdAt: job.createdAt,
    });
    jest.mocked(refinePrompt).mockResolvedValue({
      refinedPrompt: 'A pet dancing.', basePrompt: 'A pet dancing.',
      raw: {}, usage: undefined, id: 'refinement-1',
    });
    jest.mocked(generateVideo).mockResolvedValue({ id: 'provider-1' });
    // End processing after submission without writing a video to disk.
    jest.mocked(getJobStatus).mockRejectedValue(new Error('Provider unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await processJob(job.id);

    expect(generateVideo).toHaveBeenCalledWith(
      'video-model', 'A pet dancing.', 'https://example.com/pet.jpg', undefined,
      { aspectRatio: '9:16', duration },
    );
  });
});
