import { buildVideoRequestBody } from '../lib/openrouter';

/**
 * 这些断言对应 OpenRouter 官方视频请求 schema
 * （SDK `VideoGenerationRequest` / `FrameImage` / `InputReference`，
 * 固定提交 43d6d571164276be6052075ea33f46096c94d97f）：
 * frame_images 必须是对象数组，input_references 的 type 只能是
 * image_url | video_url | audio_url。历史上传字符串导致上游 ZodError。
 */
describe('Video request body', () => {
  const base = {
    model: 'vendor/video-model',
    prompt: 'a cat dancing',
    imageUrl: 'https://example.com/cat.jpg',
  };

  it('sends frame_images as objects with image_url/type/frame_type', () => {
    const body = buildVideoRequestBody(base);

    expect(body.frame_images).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/cat.jpg' },
        frame_type: 'first_frame',
      },
    ]);
  });

  it('omits input_references when no reference video is given', () => {
    const body = buildVideoRequestBody(base);
    expect(body.input_references).toBeUndefined();
  });

  it('sends video reference with the video_url discriminator', () => {
    const body = buildVideoRequestBody({
      ...base,
      referenceVideoUrl: 'https://example.com/dance.mp4',
    });

    expect(body.input_references).toEqual([
      {
        type: 'video_url',
        video_url: { url: 'https://example.com/dance.mp4' },
      },
    ]);
  });

  it('only includes optional params that are provided', () => {
    const minimal = buildVideoRequestBody(base);
    expect(minimal).not.toHaveProperty('aspect_ratio');
    expect(minimal).not.toHaveProperty('duration');

    const withOptions = buildVideoRequestBody({
      ...base,
      aspectRatio: '9:16',
      duration: 5,
    });
    expect(withOptions.aspect_ratio).toBe('9:16');
    expect(withOptions.duration).toBe(5);
  });
});
