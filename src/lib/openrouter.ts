const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';

export interface OpenRouterModel {
  id: string;
  name: string;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
    output_modalities: string[];
    input_modalities?: string[];
  };
  pricing: {
    prompt: string;
    completion: string;
    image: string;
    request: string;
  };
}

export interface VideoModelInfo {
  id: string;
  canonical_slug: string;
  supported_durations: number[] | null;
  supported_aspect_ratios: string[] | null;
  supported_resolutions: string[] | null;
  supported_frame_images: boolean | null;
  generate_audio: boolean | null;
  pricing_skus: any[] | null;
}

let catalogCache: {
  promptModels: OpenRouterModel[];
  videoModels: (OpenRouterModel & { videoInfo?: VideoModelInfo })[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchAllModels(outputModality: string, arch?: string): Promise<OpenRouterModel[]> {
  let allModels: OpenRouterModel[] = [];
  let nextUrl = `${OPENROUTER_API_URL}/models?output_modalities=${outputModality}${arch ? `&arch=${arch}` : ''}&limit=1000`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`);
    const data = await res.json();
    allModels = allModels.concat(data.data);
    nextUrl = data.links?.next || null;
  }

  return allModels;
}

async function fetchVideoModelsInfo(): Promise<VideoModelInfo[]> {
  const res = await fetch(`${OPENROUTER_API_URL}/videos/models`, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch video models info: ${res.statusText}`);
  const data = await res.json();
  return data.data;
}

export function mergeCatalogs(
  promptModelsRaw: OpenRouterModel[],
  videoModelsRaw: OpenRouterModel[],
  videoInfoRaw: VideoModelInfo[]
) {
  const promptModels = promptModelsRaw.filter(m => 
    m.architecture?.output_modalities?.includes('text')
  );

  const videoModels = videoModelsRaw.map(m => {
    const videoInfo = videoInfoRaw.find(info => 
      info.id === m.id || info.canonical_slug === m.id
    );
    return { ...m, videoInfo };
  });

  return { promptModels, videoModels };
}

export async function getCatalogs() {
  if (catalogCache && Date.now() - catalogCache.timestamp < CACHE_TTL) {
    return catalogCache;
  }

  try {
    const [promptModelsRaw, videoModelsRaw, videoInfoRaw] = await Promise.all([
      fetchAllModels('text', 'Gemini'),
      fetchAllModels('video'),
      fetchVideoModelsInfo(),
    ]);

    const { promptModels, videoModels } = mergeCatalogs(promptModelsRaw, videoModelsRaw, videoInfoRaw);

    catalogCache = {
      promptModels,
      videoModels,
      timestamp: Date.now(),
    };

    return catalogCache;
  } catch (error) {
    if (catalogCache) {
      console.error('Failed to refresh catalog, using stale cache', error);
      return catalogCache;
    }
    throw error;
  }
}

export interface RefinePromptContext {
  /** 用户自由填写的指令，可为空。 */
  userPrompt?: string;
  style: string;
  aspectRatio: string;
  duration?: number;
  /** 是否真的提供了宠物图片素材。 */
  hasPetImage: boolean;
  /** 是否真的提供了可用的参考舞蹈视频（决定提示词该不该谈「跟随参考动作」）。 */
  hasDanceReference: boolean;
}

const DEFAULT_PET_PROMPT = 'A pet dancing along to the reference dance moves.';

/** 清洗后提示词的长度上限，避免把整篇说明喂给视频模型。 */
export const MAX_REFINED_PROMPT_LENGTH = 600;

/** 低于该长度的段落视为标题/残句，不足以作为提示词。 */
export const MIN_REFINED_PROMPT_LENGTH = 20;

/**
 * 提示词整理模型的 system prompt。
 * 输出必须是一段可直接发送的视频提示词：无 markdown、无多方案、无解释，
 * 且不得包含分辨率/像素尺寸/画幅开关（这些由 API 参数控制，写进提示词会与参数冲突）。
 */
export const REFINE_SYSTEM_PROMPT = [
  'You rewrite a user request into ONE directly executable prompt for a video generation model.',
  '',
  'Rules:',
  '- Output the prompt text only: no preamble, no headings, no bullet points, no tables, no markdown, no code fences, no explanations, no translation, no alternatives or multiple options.',
  '- A single paragraph of plain English, 80 words at most.',
  '- Describe subject, action, camera framing, lighting and mood, keeping it physically plausible.',
  '- Do NOT specify resolution, pixel dimensions, output size, or parameter switches such as "--ar 9:16", "--duration 5" or "--resolution". Those are controlled by the API parameters, not by the prompt.',
  '- If a pet image is given, keep that pet\'s identity and appearance. If a reference dance video is given, the pet should follow that choreography.',
  '- Never mention model names, platforms, settings or usage tips.',
].join('\n');

/** 未整理/整理失败时的兜底提示词，同时用于给整理模型提供上下文。 */
export function buildBasePrompt(context: RefinePromptContext) {
  const parts = [
    context.userPrompt?.trim() || DEFAULT_PET_PROMPT,
    `Style: ${context.style}.`,
    `Aspect ratio: ${context.aspectRatio}.`,
  ];
  if (context.duration != null) parts.push(`Duration: ${context.duration}s.`);
  return parts.join(' ');
}

/** 组装发给整理模型的消息，把真实素材/参数上下文说清楚。 */
export function buildRefineMessages(context: RefinePromptContext) {
  const assetContext = [
    context.hasPetImage
      ? 'The user supplied one pet photo; the pet in it must keep its identity and appearance.'
      : 'The user supplied no pet photo; describe a generic but realistic pet.',
    context.hasDanceReference
      ? 'The user supplied a reference dance video; the pet must follow that choreography.'
      : 'The user supplied no reference dance video; invent a plausible dance matching the description.',
  ].join(' ');

  const request = [
    assetContext,
    `User request: ${context.userPrompt?.trim() || '(none, use the default pet dance idea)'}`,
    `Style: ${context.style}.`,
    `Aspect ratio: ${context.aspectRatio}.`,
    `Duration: ${context.duration != null ? `${context.duration}s` : 'unspecified'}.`,
    'Return the prompt text only.',
  ].join('\n');

  return [
    { role: 'system' as const, content: REFINE_SYSTEM_PROMPT },
    { role: 'user' as const, content: request },
  ];
}

/**
 * 从整理模型的回答里抽出唯一一段可用提示词：
 * 去掉 code fence / markdown 标题 / 加粗 / 列表符号 / 表格行 / 分隔线 / 参数开关，
 * 取第一段足够长的正文，并截断到长度上限。
 * 抽不出内容时返回空串，由调用方降级为基础提示词。
 */
export function sanitizeRefinedPrompt(raw: string | null | undefined, maxLength = MAX_REFINED_PROMPT_LENGTH) {
  if (!raw) return '';

  const withoutFences = raw
    .replace(/```[a-zA-Z0-9_-]*\n?/g, '')
    // 去掉「Aspect ratio: 9:16」「分辨率：1080p」「--duration 5」这类参数行
    .replace(/^.*(?:aspect[-_ ]?ratio|resolution|画面比例|分辨率|尺寸|--ar\b|--duration\b|--resolution\b).*$/gim, '')
    // 去掉 markdown 表格行与水平分隔线（它们同时也是段落边界）
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '');

  const text = withoutFences
    .split('\n')
    .map((line) => line.replace(/^\s*(?:#{1,6}\s*|[-*+>]\s+|\d+\.\s+)/, '').trim())
    .join('\n')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*(?:prompt|提示词|英文提示词)\s*[:：]\s*/i, '')
    .trim();

  const paragraph = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .find((p) => p.length >= MIN_REFINED_PROMPT_LENGTH);

  if (!paragraph) return '';

  const trimmed = paragraph.length > maxLength
    ? paragraph.slice(0, maxLength).replace(/\s+\S*$/, '')
    : paragraph;

  return trimmed.trim();
}

export async function refinePrompt(modelId: string, context: RefinePromptContext) {
  const basePrompt = buildBasePrompt(context);

  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: buildRefineMessages(context),
      }),
    });
  } catch (error: any) {
    throw new Error(`Failed to refine prompt: ${error?.message || error}`);
  }

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to refine prompt: ${res.statusText} - ${errorBody}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '';

  return {
    /** 清洗后的单段提示词；为空串表示不可用，调用方应回退到 basePrompt。 */
    refinedPrompt: sanitizeRefinedPrompt(raw),
    basePrompt,
    raw,
    usage: data.usage,
    id: data.id,
  };
}

export interface VideoRequestBodyOptions {
  model: string;
  prompt: string;
  imageUrl: string;
  referenceVideoUrl?: string;
  aspectRatio?: string;
  duration?: number;
}

/**
 * 构造 POST /api/v1/videos 的 HTTP 请求体。
 *
 * 上游 schema（OpenRouter SDK `VideoGenerationRequest`）要求：
 * - `frame_images` 是 **对象数组**，形如
 *   `{ type: 'image_url', image_url: { url }, frame_type: 'first_frame' }`；
 *   传字符串会被拒（ZodError: expected object, received string）。
 * - `input_references` 是带 discriminator 的联合，`type` 只能是
 *   `'image_url' | 'video_url' | 'audio_url'`，视频参考形如
 *   `{ type: 'video_url', video_url: { url } }`。
 */
export function buildVideoRequestBody(options: VideoRequestBodyOptions) {
  const body: Record<string, unknown> = {
    model: options.model,
    prompt: options.prompt,
    frame_images: [
      {
        type: 'image_url',
        image_url: { url: options.imageUrl },
        frame_type: 'first_frame',
      },
    ],
  };

  if (options.referenceVideoUrl) {
    body.input_references = [
      {
        type: 'video_url',
        video_url: { url: options.referenceVideoUrl },
      },
    ];
  }

  if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;
  if (options.duration != null) body.duration = options.duration;

  return body;
}

export async function generateVideo(modelId: string, prompt: string, imageUrl: string, referenceVideoUrl?: string, options: any = {}) {
  const body = buildVideoRequestBody({
    model: modelId,
    prompt,
    imageUrl,
    referenceVideoUrl,
    aspectRatio: options.aspectRatio,
    duration: options.duration,
  });

  const res = await fetch(`${OPENROUTER_API_URL}/videos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to submit video: ${res.statusText} - ${errorBody}`);
  }

  const data = await res.json();
  return data; // Should contain id
}

/**
 * GET /api/v1/videos/{jobId} 的响应（HTTP 为 snake_case，**没有 data 包装**）：
 * `{ id, polling_url, status, error?, generation_id?, unsigned_urls?, usage? }`
 */
export interface VideoJobStatus {
  id: string;
  status: string;
  pollingUrl?: string;
  generationId?: string;
  unsignedUrls?: string[];
  error?: string;
  usage?: { cost?: number; is_byok?: boolean };
}

/** 归一化上游状态响应，形状不对时抛出带原文的错误，便于定位。 */
export function parseVideoJobStatus(raw: unknown): VideoJobStatus {
  const body = raw as Record<string, any> | null;
  if (!body || typeof body !== 'object' || typeof body.status !== 'string') {
    throw new Error(`Unexpected video status response: ${JSON.stringify(raw)?.slice(0, 300)}`);
  }

  return {
    id: body.id,
    status: body.status,
    pollingUrl: body.polling_url,
    generationId: body.generation_id,
    unsignedUrls: Array.isArray(body.unsigned_urls) ? body.unsigned_urls : undefined,
    error: typeof body.error === 'string' ? body.error : body.error?.message,
    usage: body.usage,
  };
}

export async function getJobStatus(jobId: string): Promise<VideoJobStatus> {
  const res = await fetch(`${OPENROUTER_API_URL}/videos/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to get video status: ${res.statusText} - ${text.slice(0, 300)}`);
  }

  return parseVideoJobStatus(JSON.parse(text));
}

/**
 * GET /api/v1/videos/{jobId}/content 返回的是视频二进制流（`video/mp4`），不是 JSON。
 * 返回文件字节，由调用方写盘。
 */
export async function getJobContent(jobId: string): Promise<Uint8Array> {
  const res = await fetch(`${OPENROUTER_API_URL}/videos/${jobId}/content`, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to get video content: ${res.statusText} - ${errorBody.slice(0, 300)}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}
