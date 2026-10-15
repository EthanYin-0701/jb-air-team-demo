import { processJob } from '../lib/worker';
import { db } from '../lib/db';
import * as openrouter from '../lib/openrouter';

jest.mock('../lib/db', () => ({
  db: {
    jobs: {
      get: jest.fn(),
      update: jest.fn(),
    },
    invocations: {
      create: jest.fn(),
    },
    assets: {
      get: jest.fn(),
    },
  },
}));

jest.mock('../lib/openrouter');

describe('Job State Machine', () => {
  const jobId = 'job-123';
  const mockJob = {
    id: jobId,
    promptModelId: 'p-1',
    videoModelId: 'v-1',
    inputs: {
      petAssetId: 'a-1',
      danceAssetId: 'a-2',
      style: 'cartoon',
      aspectRatio: '1:1',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (db.jobs.get as jest.Mock).mockReturnValue(mockJob);
    (db.assets.get as jest.Mock).mockReturnValue({ source: 'url', url: 'https://img.com' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('completes successfully when all steps pass', async () => {
    (openrouter.refinePrompt as jest.Mock).mockResolvedValue({ 
      refinedPrompt: 'Refined!', 
      usage: { total_tokens: 10 },
      id: 'ref-1'
    });
    
    (openrouter.generateVideo as jest.Mock).mockResolvedValue({ id: 'v-job-1' });
    
    (openrouter.getJobStatus as jest.Mock).mockResolvedValue({
      data: { status: 'completed', usage: { cost: 0.1 } }
    });
    
    (openrouter.getJobContent as jest.Mock).mockResolvedValue({
      data: [{ url: 'https://vid.com' }]
    });

    // Mock fetch for video download
    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
    }) as any;

    const promise = processJob(jobId);
    
    // Advance timers to trigger the while loop iterations
    await jest.runAllTimersAsync();
    
    await promise;

    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'analyzing' });
    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'submitting' });
    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'provider_queued', providerJobId: 'v-job-1' });
    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'succeeded', outputVideoPath: expect.any(String) });
  });

  it('fails when refinement fails', async () => {
    (openrouter.refinePrompt as jest.Mock).mockRejectedValue(new Error('Refinement failed'));

    const promise = processJob(jobId);
    await jest.runAllTimersAsync();
    await promise;

    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'failed', error: 'Refinement failed' });
  });
});
