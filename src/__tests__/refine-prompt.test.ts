import {
  REFINE_SYSTEM_PROMPT,
  MAX_REFINED_PROMPT_LENGTH,
  buildBasePrompt,
  buildRefineMessages,
  sanitizeRefinedPrompt,
} from '../lib/openrouter';

describe('Prompt refinement context', () => {
  const context = {
    userPrompt: '让这只猫跟着参考视频跳舞',
    style: 'keep original look',
    aspectRatio: '9:16',
    duration: 5,
    hasPetImage: true,
    hasDanceReference: true,
  };

  it('forbids the model from deciding resolution / parameter switches', () => {
    expect(REFINE_SYSTEM_PROMPT).toMatch(/Do NOT specify resolution/i);
    expect(REFINE_SYSTEM_PROMPT).toMatch(/--ar 9:16/);
  });

  it('tells the model which references are actually available', () => {
    const withReference = buildRefineMessages(context);
    expect(withReference[1].content).toContain('must follow that choreography');
    expect(withReference[1].content).toContain('keep its identity and appearance');
    expect(withReference[1].content).toContain('9:16');

    const withoutReference = buildRefineMessages({
      ...context,
      hasPetImage: false,
      hasDanceReference: false,
    });
    expect(withoutReference[1].content).toContain('no reference dance video');
    expect(withoutReference[1].content).toContain('no pet photo');
  });

  it('builds a usable fallback prompt', () => {
    expect(buildBasePrompt(context)).toContain('让这只猫跟着参考视频跳舞');
    expect(buildBasePrompt({ ...context, userPrompt: '' })).toContain(
      'A pet dancing along to the reference dance moves.'
    );
  });
});

describe('sanitizeRefinedPrompt', () => {
  it('keeps only the first paragraph of a verbose, markdown-formatted answer', () => {
    const verbose = `为了让视频生成模型能够完美保留猫咪原貌，建议使用以下提示词。
---
### 推荐英文提示词
> **Prompt:**
> A full-body vertical video of the exact cat from the input image dancing. The cat stands upright and bobs its head to the beat.
---
### 核心参数设置
| 参数项 | 推荐设置 |
| :--- | :--- |
| **画面比例** | \`--ar 9:16\` |`;

    const result = sanitizeRefinedPrompt(verbose);
    expect(result).toBe(
      '为了让视频生成模型能够完美保留猫咪原貌，建议使用以下提示词。'
    );
  });

  it('returns a single clean paragraph when the model follows the rules', () => {
    const clean =
      'A full-body 9:16 vertical video of the exact cat from the input photo dancing energetically on a neon stage, soft rim light, cinematic quality.';

    expect(sanitizeRefinedPrompt(clean)).toBe(
      'A full-body 9:16 vertical video of the exact cat from the input photo dancing energetically on a neon stage, soft rim light, cinematic quality.'
    );
  });

  it('strips parameter lines and switches from the prompt body', () => {
    const withParams = `**Prompt:** A cat dances on a rooftop.
Aspect ratio: 9:16
--duration 5 --resolution 1080p`;

    const result = sanitizeRefinedPrompt(withParams);
    expect(result).toBe('A cat dances on a rooftop.');
    expect(result).not.toMatch(/--|Aspect ratio/i);
  });

  it('truncates overly long prompts', () => {
    const long = `${'word '.repeat(400)}end`;
    const result = sanitizeRefinedPrompt(long);

    expect(result.length).toBeLessThanOrEqual(MAX_REFINED_PROMPT_LENGTH);
    expect(result.endsWith('word')).toBe(true);
  });

  it('returns an empty string when there is nothing usable', () => {
    expect(sanitizeRefinedPrompt(undefined)).toBe('');
    expect(sanitizeRefinedPrompt('### 参数建议\n| a | b |')).toBe('');
  });
});
