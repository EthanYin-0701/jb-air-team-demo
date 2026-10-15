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

export async function refinePrompt(modelId: string, basePrompt: string) {
  const res = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: 'You are an expert at writing prompts for video generation models. Refine the user pet dance video prompt to be more detailed and effective for the target model.' },
        { role: 'user', content: basePrompt }
      ],
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to refine prompt: ${res.statusText} - ${errorBody}`);
  }

  const data = await res.json();
  return {
    refinedPrompt: data.choices[0].message.content,
    usage: data.usage,
    id: data.id,
  };
}

export async function generateVideo(modelId: string, prompt: string, imageUrl: string, referenceVideoUrl?: string, options: any = {}) {
  const body: any = {
    model: modelId,
    prompt,
    frame_images: [imageUrl],
  };

  if (referenceVideoUrl) {
    body.input_references = [
      {
        type: 'video',
        url: referenceVideoUrl,
      }
    ];
  }

  if (options.aspectRatio) body.aspect_ratio = options.aspectRatio;

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

export async function getJobStatus(jobId: string) {
  const res = await fetch(`${OPENROUTER_API_URL}/videos/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
  });

  if (!res.ok) throw new Error(`Failed to get video status: ${res.statusText}`);
  return await res.json();
}

export async function getJobContent(jobId: string) {
  const res = await fetch(`${OPENROUTER_API_URL}/videos/${jobId}/content`, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
  });

  if (!res.ok) throw new Error(`Failed to get video content: ${res.statusText}`);
  return await res.json();
}
