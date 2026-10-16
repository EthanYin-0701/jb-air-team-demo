import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreationStudio from '@/app/page';
import { buildVideoRequestBody, buildRefineMessages } from '@/lib/openrouter';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: (url: string) => push(url) }),
}));

/**
 * ATD-2：高级选项里除了参考舞蹈视频，还要能填一个参考音乐链接，
 * 并且生成视频时真的把这段音乐作为参考素材提交给视频模型。
 */
describe('ATD-2: reference music link', () => {
  describe('video request body', () => {
    const base = {
      model: 'vendor/video-model',
      prompt: 'a cat dancing',
      imageUrl: 'https://example.com/cat.jpg',
    };

    it('sends the music reference with the audio_url discriminator', () => {
      const body = buildVideoRequestBody({
        ...base,
        referenceAudioUrl: 'https://example.com/track.mp3',
      });

      expect(body.input_references).toEqual([
        {
          type: 'audio_url',
          audio_url: { url: 'https://example.com/track.mp3' },
        },
      ]);
    });

    it('keeps both references when a dance video and music are given', () => {
      const body = buildVideoRequestBody({
        ...base,
        referenceVideoUrl: 'https://example.com/dance.mp4',
        referenceAudioUrl: 'https://example.com/track.mp3',
      });

      expect(body.input_references).toEqual([
        { type: 'video_url', video_url: { url: 'https://example.com/dance.mp4' } },
        { type: 'audio_url', audio_url: { url: 'https://example.com/track.mp3' } },
      ]);
    });

    it('still omits input_references when neither reference is given', () => {
      expect(buildVideoRequestBody(base).input_references).toBeUndefined();
    });
  });

  describe('prompt refinement context', () => {
    const context = {
      style: 'cartoon',
      aspectRatio: '9:16',
      hasPetImage: true,
      hasDanceReference: false,
    };

    it('tells the refiner to follow the music rhythm when music is supplied', () => {
      const [, user] = buildRefineMessages({ ...context, hasMusicReference: true });
      expect(user.content).toContain('reference music');
      expect(user.content).toContain('in time with its rhythm');
    });

    it('tells the refiner there is no music when the advanced option is empty', () => {
      const [, user] = buildRefineMessages({ ...context, hasMusicReference: false });
      expect(user.content).toContain('no reference music');
    });
  });

  describe('creation studio form', () => {
    /** 依次返回 models / assets / quote / job 的响应，便于断言最终提交的任务载荷。 */
    function mockApi() {
      const calls: { url: string; body: any }[] = [];

      global.fetch = jest.fn(async (url: any, init?: any) => {
        const href = String(url);
        const body = init?.body ? JSON.parse(init.body) : undefined;
        calls.push({ url: href, body });

        if (href.startsWith('/api/models')) {
          return { ok: true, json: async () => [{ id: 'm-1', name: 'Model 1', videoInfo: {} }] } as any;
        }
        if (href === '/api/assets') {
          return { ok: true, json: async () => ({ id: `asset-${body.role}` }) } as any;
        }
        if (href === '/api/quotes') {
          return { ok: true, json: async () => ({ id: 'quote-1' }) } as any;
        }
        if (href === '/api/jobs') {
          return { ok: true, json: async () => ({ id: 'job-1' }) } as any;
        }
        throw new Error(`Unexpected request: ${href}`);
      }) as any;

      return calls;
    }

    async function renderStudio() {
      render(<CreationStudio />);
      await waitFor(() => expect(screen.getByText('1. Reference Assets')).not.toBeNull());
    }

    beforeEach(() => {
      push.mockClear();
    });

    it('offers a reference music URL field inside the advanced options', async () => {
      mockApi();
      await renderStudio();

      expect(screen.queryByLabelText(/Reference Music/i)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /Advanced options/i }));

      expect(screen.getByLabelText(/Dance Reference Video/i)).not.toBeNull();
      expect(screen.getByLabelText(/Reference Music/i)).not.toBeNull();
    });

    it('registers the music link as an audio asset and attaches it to the job', async () => {
      const calls = mockApi();
      await renderStudio();

      fireEvent.change(screen.getByLabelText(/Pet Image/i), {
        target: { value: 'https://example.com/cat.jpg' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Advanced options/i }));
      fireEvent.change(screen.getByLabelText(/Reference Music/i), {
        target: { value: 'https://example.com/track.mp3' },
      });

      fireEvent.submit(screen.getByRole('button', { name: /Generate Pet Dance Video/i }).closest('form')!);

      await waitFor(() => expect(push).toHaveBeenCalledWith('/jobs/job-1'));

      const musicAssetCall = calls.find((c) => c.url === '/api/assets' && c.body?.role === 'music');
      expect(musicAssetCall?.body).toEqual(
        expect.objectContaining({
          type: 'audio',
          role: 'music',
          source: 'url',
          url: 'https://example.com/track.mp3',
        })
      );

      const jobCall = calls.find((c) => c.url === '/api/jobs');
      expect(jobCall?.body.musicAssetId).toBe('asset-music');
      // 没填参考舞蹈视频时不应该注册视频素材。
      expect(calls.some((c) => c.url === '/api/assets' && c.body?.role === 'dance')).toBe(false);
      expect(jobCall?.body.danceAssetId).toBeUndefined();
    });

    it('does not register any music asset when the field is left empty', async () => {
      const calls = mockApi();
      await renderStudio();

      fireEvent.change(screen.getByLabelText(/Pet Image/i), {
        target: { value: 'https://example.com/cat.jpg' },
      });
      fireEvent.submit(screen.getByRole('button', { name: /Generate Pet Dance Video/i }).closest('form')!);

      await waitFor(() => expect(push).toHaveBeenCalledWith('/jobs/job-1'));

      expect(calls.some((c) => c.url === '/api/assets' && c.body?.role === 'music')).toBe(false);
      expect(calls.find((c) => c.url === '/api/jobs')?.body.musicAssetId).toBeUndefined();
    });
  });
});
