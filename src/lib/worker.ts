import { db, Job, ModelInvocation } from './db';
import { refinePrompt, generateVideo, getJobStatus, getJobContent, buildBasePrompt } from './openrouter';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage');

export async function processJob(jobId: string) {
  const job = db.jobs.get(jobId);
  if (!job) return;

  try {
    // 1. Analyzing
    db.jobs.update(jobId, { status: 'analyzing' });

    // 素材先解析出来，提示词整理需要知道「到底有没有图片/参考视频」。
    const petAsset = db.assets.get(job.inputs.petAssetId);
    // 参考舞蹈视频是可选的（高级选项）：没有 danceAssetId 时只按提示词生成。
    const danceAsset = job.inputs.danceAssetId
      ? db.assets.get(job.inputs.danceAssetId)
      : undefined;

    // 上传素材目前没有公网地址，只有 URL 来源的素材才真正可用（见 AGENTS.md 的已知简化）。
    const imageUrl = petAsset?.source === 'url' ? petAsset.url! : `https://example.com/placeholder-pet.jpg`;
    const danceUrl = danceAsset?.source === 'url' ? danceAsset.url : undefined;

    const refineContext = {
      userPrompt: job.inputs.userPrompt,
      style: job.inputs.style,
      aspectRatio: job.inputs.aspectRatio,
      duration: job.inputs.duration,
      hasPetImage: Boolean(petAsset),
      hasDanceReference: Boolean(danceUrl),
    };

    // 2. Submitting (Refine prompt)
    db.jobs.update(jobId, { status: 'submitting' });

    // 整理失败（接口报错或抽不出可用提示词）时降级为基础提示词，绝不把解释性文字送进视频模型。
    let refinement: Awaited<ReturnType<typeof refinePrompt>> | null = null;
    try {
      refinement = await refinePrompt(job.promptModelId, refineContext);
    } catch (error: any) {
      console.error(`Prompt refinement failed for job ${jobId}, using the base prompt instead:`, error?.message);
    }

    const refinedPrompt = refinement?.refinedPrompt ?? '';
    const usedRefinement = refinedPrompt.length > 0;
    const finalPrompt = usedRefinement ? refinedPrompt : buildBasePrompt(refineContext);

    db.invocations.create({
      id: Math.random().toString(36).substring(7),
      jobId,
      step: 'refining',
      openrouterId: refinement?.id,
      modelId: job.promptModelId,
      inputTokens: refinement?.usage?.prompt_tokens,
      outputTokens: refinement?.usage?.completion_tokens,
      totalTokens: refinement?.usage?.total_tokens,
      status: !refinement ? 'failed' : usedRefinement ? 'succeeded' : 'fallback',
      updatedAt: new Date().toISOString(),
    });

    db.jobs.update(jobId, { finalPrompt });

    // 3. Provider Queued / Generating (Submit video)
    const videoSubmission = await generateVideo(
      job.videoModelId,
      finalPrompt,
      imageUrl,
      danceUrl,
      { aspectRatio: job.inputs.aspectRatio, duration: job.inputs.duration }
    );

    db.jobs.update(jobId, { 
      status: 'provider_queued',
      providerJobId: videoSubmission.id,
    });

    // 4. Polling for completion
    // 上游响应是顶层对象：{ id, polling_url, status, error?, unsigned_urls?, usage? }
    const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled', 'expired'];
    const POLL_INTERVAL_MS = 5000;
    const MAX_POLL_MS = 15 * 60 * 1000;

    let providerJob = await getJobStatus(videoSubmission.id);
    const pollStartedAt = Date.now();

    while (!TERMINAL_STATUSES.includes(providerJob.status)) {
      if (Date.now() - pollStartedAt > MAX_POLL_MS) {
        throw new Error(`Video generation timed out after ${MAX_POLL_MS / 60000} minutes (last status: ${providerJob.status})`);
      }

      db.jobs.update(jobId, {
        status: providerJob.status === 'in_progress' ? 'generating' : 'provider_queued',
      });

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      providerJob = await getJobStatus(videoSubmission.id);
    }

    if (providerJob.status !== 'completed') {
      throw new Error(`Upstream video generation ${providerJob.status}: ${providerJob.error || 'unknown error'}`);
    }

    // 5. Processing (Fetch content)
    db.jobs.update(jobId, { status: 'processing' });

    const fileName = `${jobId}.mp4`;
    const filePath = path.join(STORAGE_DIR, fileName);
    fs.mkdirSync(STORAGE_DIR, { recursive: true });

    try {
      // /content 直接返回视频字节流（video/mp4）
      const videoBytes = await getJobContent(videoSubmission.id);
      if (videoBytes.byteLength === 0) throw new Error('Empty video content returned from provider');
      fs.writeFileSync(filePath, Buffer.from(videoBytes));
    } catch (contentError: any) {
      // 回退：上游响应里可能带有可直接下载的 unsigned_urls
      const fallbackUrl = providerJob.unsignedUrls?.[0];
      if (!fallbackUrl) throw contentError;

      const videoRes = await fetch(fallbackUrl);
      if (!videoRes.ok) throw contentError;

      fs.writeFileSync(filePath, Buffer.from(await videoRes.arrayBuffer()));
    }

    // Record invocation for video
    db.invocations.create({
      id: Math.random().toString(36).substring(7),
      jobId,
      step: 'generating',
      openrouterId: videoSubmission.id,
      modelId: job.videoModelId,
      cost: providerJob.usage?.cost,
      status: 'succeeded',
      updatedAt: new Date().toISOString(),
    });

    db.jobs.update(jobId, {
      status: 'succeeded',
      outputVideoPath: `/api/storage/${fileName}`, // Internal path
    });

  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error);
    db.jobs.update(jobId, { 
      status: 'failed',
      error: error.message,
    });
  }
}
