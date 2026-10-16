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

// 视频产物写盘只在下载成功时才发生，测试里不落盘。
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('../lib/openrouter');

const actualOpenrouter = jest.requireActual('../lib/openrouter');

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

  /** 把视频生成之后的链路 mock 成「一次成功」，只关注提示词整理这一段的差异。 */
  function mockSuccessfulVideoPipeline() {
    (openrouter.generateVideo as jest.Mock).mockResolvedValue({ id: 'v-job-1' });
    // 上游 GET /videos/{id} 返回顶层对象，没有 data 包装。
    (openrouter.getJobStatus as jest.Mock).mockResolvedValue({
      id: 'v-job-1',
      status: 'completed',
      usage: { cost: 0.1 },
    });
    // /content 返回视频字节流。
    (openrouter.getJobContent as jest.Mock).mockResolvedValue(new Uint8Array([1, 2, 3]));
  }

  async function runJob() {
    const promise = processJob(jobId);
    await jest.runAllTimersAsync();
    await promise;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (db.jobs.get as jest.Mock).mockReturnValue(mockJob);
    (db.assets.get as jest.Mock).mockReturnValue({ source: 'url', url: 'https://img.com' });
    (openrouter.refinePrompt as jest.Mock).mockResolvedValue({
      refinedPrompt: 'Refined!',
      usage: { total_tokens: 10 },
      id: 'ref-1',
    });
    // buildBasePrompt 是纯函数，worker 依赖它做降级，因此保留真实实现。
    (openrouter.buildBasePrompt as jest.Mock).mockImplementation(actualOpenrouter.buildBasePrompt);
    mockSuccessfulVideoPipeline();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('completes successfully when all steps pass', async () => {
    await runJob();

    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'analyzing' });
    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'submitting' });
    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'provider_queued', providerJobId: 'v-job-1' });
    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'succeeded', outputVideoPath: expect.any(String) });
    expect(openrouter.generateVideo).toHaveBeenCalledWith(
      'v-1',
      'Refined!',
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('passes the user prompt and the real asset context to the prompt refiner', async () => {
    (db.jobs.get as jest.Mock).mockReturnValue({
      ...mockJob,
      inputs: { ...mockJob.inputs, userPrompt: 'cat wearing sunglasses' },
    });

    await runJob();

    expect(openrouter.refinePrompt).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({
        userPrompt: 'cat wearing sunglasses',
        style: 'cartoon',
        aspectRatio: '1:1',
        hasPetImage: true,
        hasDanceReference: true,
      })
    );
  });

  it('tells the refiner there is no dance reference when the advanced option is empty', async () => {
    (db.jobs.get as jest.Mock).mockReturnValue({
      ...mockJob,
      inputs: { petAssetId: 'a-1', style: 'cartoon', aspectRatio: '1:1' },
    });

    await runJob();

    expect(openrouter.refinePrompt).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({ hasDanceReference: false, userPrompt: undefined })
    );
    expect(openrouter.generateVideo).toHaveBeenCalledWith(
      'v-1',
      'Refined!',
      expect.any(String),
      undefined,
      expect.any(Object)
    );
  });

  it('forwards the reference music to the video model and the refiner (ATD-2)', async () => {
    (db.jobs.get as jest.Mock).mockReturnValue({
      ...mockJob,
      inputs: { ...mockJob.inputs, musicAssetId: 'a-3' },
    });
    (db.assets.get as jest.Mock).mockImplementation((id: string) =>
      id === 'a-3'
        ? { source: 'url', url: 'https://music.com/track.mp3' }
        : { source: 'url', url: 'https://img.com' }
    );

    await runJob();

    expect(openrouter.refinePrompt).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({ hasMusicReference: true })
    );
    expect(openrouter.generateVideo).toHaveBeenCalledWith(
      'v-1',
      'Refined!',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ referenceAudioUrl: 'https://music.com/track.mp3' })
    );
  });

  it('leaves the music reference out when the advanced option is empty (ATD-2)', async () => {
    await runJob();

    expect(openrouter.refinePrompt).toHaveBeenCalledWith(
      'p-1',
      expect.objectContaining({ hasMusicReference: false })
    );
    expect(openrouter.generateVideo).toHaveBeenCalledWith(
      'v-1',
      'Refined!',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ referenceAudioUrl: undefined })
    );
  });

  it('falls back to the base prompt when the refiner returns nothing usable', async () => {
    (openrouter.refinePrompt as jest.Mock).mockResolvedValue({
      refinedPrompt: '',
      usage: { total_tokens: 10 },
      id: 'ref-1',
    });

    await runJob();

    expect(openrouter.generateVideo).toHaveBeenCalledWith(
      'v-1',
      expect.stringContaining('A pet dancing along to the reference dance moves.'),
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );
    expect(db.invocations.create).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'refining', status: 'fallback' })
    );
  });

  it('polls the provider until it reports completed', async () => {
    (openrouter.getJobStatus as jest.Mock)
      .mockResolvedValueOnce({ id: 'v-job-1', status: 'pending' })
      .mockResolvedValueOnce({ id: 'v-job-1', status: 'in_progress' })
      .mockResolvedValue({ id: 'v-job-1', status: 'completed', usage: { cost: 0.2 } });

    await runJob();

    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'provider_queued' });
    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'generating' });
    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'processing' });
    expect(openrouter.getJobContent).toHaveBeenCalledWith('v-job-1');
    expect(db.invocations.create).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'generating', cost: 0.2 })
    );
  });

  it('fails the job when the provider reports a terminal failure', async () => {
    (openrouter.getJobStatus as jest.Mock).mockResolvedValue({
      id: 'v-job-1',
      status: 'failed',
      error: 'content policy violation',
    });

    await runJob();

    expect(db.jobs.update).toHaveBeenCalledWith(jobId, {
      status: 'failed',
      error: expect.stringContaining('content policy violation'),
    });
    expect(openrouter.getJobContent).not.toHaveBeenCalled();
  });

  it('does not fail the job when refinement itself fails', async () => {
    (openrouter.refinePrompt as jest.Mock).mockRejectedValue(new Error('Refinement failed'));

    await runJob();

    expect(openrouter.generateVideo).toHaveBeenCalledWith(
      'v-1',
      expect.stringContaining('A pet dancing along to the reference dance moves.'),
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );
    expect(db.invocations.create).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'refining', status: 'failed' })
    );
    expect(db.jobs.update).not.toHaveBeenCalledWith(
      jobId,
      expect.objectContaining({ status: 'failed' })
    );
    expect(db.jobs.update).toHaveBeenCalledWith(jobId, { status: 'succeeded', outputVideoPath: expect.any(String) });
  });
});
