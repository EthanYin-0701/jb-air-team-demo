import { db, Job, ModelInvocation } from './db';
import { refinePrompt, generateVideo, getJobStatus, getJobContent } from './openrouter';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage');

export async function processJob(jobId: string) {
  const job = db.jobs.get(jobId);
  if (!job) return;

  try {
    // 1. Analyzing
    db.jobs.update(jobId, { status: 'analyzing' });
    // In a real app, we'd analyze the pet image/video here.
    // For MVP, we use a basic prompt.
    const basePrompt = `A video of a pet dancing. Style: ${job.inputs.style}. Aspect Ratio: ${job.inputs.aspectRatio}.`;

    // 2. Submitting (Refine prompt)
    db.jobs.update(jobId, { status: 'submitting' });
    const refinement = await refinePrompt(job.promptModelId, basePrompt);
    
    db.invocations.create({
      id: Math.random().toString(36).substring(7),
      jobId,
      step: 'refining',
      openrouterId: refinement.id,
      modelId: job.promptModelId,
      inputTokens: refinement.usage?.prompt_tokens,
      outputTokens: refinement.usage?.completion_tokens,
      totalTokens: refinement.usage?.total_tokens,
      status: 'succeeded',
      updatedAt: new Date().toISOString(),
    });

    db.jobs.update(jobId, { finalPrompt: refinement.refinedPrompt });

    // 3. Provider Queued / Generating (Submit video)
    const petAsset = db.assets.get(job.inputs.petAssetId);
    const danceAsset = db.assets.get(job.inputs.danceAssetId);
    
    // Simulate S3 URL by providing local serve path if it were public, 
    // but here we just need a URL for OpenRouter. 
    // Since we don't have a public URL, we'll assume the caller provided a URL or we'd need a tunnel.
    // For this sandbox, we'll use the URL if it's an import, or a placeholder if it's an upload.
    const imageUrl = petAsset?.source === 'url' ? petAsset.url! : `https://example.com/placeholder-pet.jpg`;
    const danceUrl = danceAsset?.source === 'url' ? danceAsset.url! : undefined;

    const videoSubmission = await generateVideo(
      job.videoModelId,
      refinement.refinedPrompt,
      imageUrl,
      danceUrl,
      { aspectRatio: job.inputs.aspectRatio }
    );

    db.jobs.update(jobId, { 
      status: 'provider_queued',
      providerJobId: videoSubmission.id,
    });

    // 4. Polling for completion
    let status = 'provider_queued';
    let providerJob: any = null;

    while (status === 'provider_queued' || status === 'generating' || status === 'pending' || status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      providerJob = await getJobStatus(videoSubmission.id);
      
      const upstreamStatus = providerJob.data.status;
      if (upstreamStatus === 'completed') {
        status = 'processing';
      } else if (upstreamStatus === 'failed' || upstreamStatus === 'cancelled' || upstreamStatus === 'expired') {
        status = 'failed';
      } else if (upstreamStatus === 'in_progress') {
        status = 'generating';
      }
      
      db.jobs.update(jobId, { status: status as any });
      
      if (status === 'failed') {
        throw new Error(`Upstream video generation failed: ${providerJob.data.error?.message || 'Unknown error'}`);
      }
    }

    // 5. Processing (Fetch content)
    if (status === 'processing') {
      const content = await getJobContent(videoSubmission.id);
      const videoUrl = content.data[0]?.url;
      
      if (!videoUrl) throw new Error('No video URL returned from provider');

      // Download video to local storage
      const videoRes = await fetch(videoUrl);
      const videoBuffer = await videoRes.arrayBuffer();
      const fileName = `${jobId}.mp4`;
      const filePath = path.join(STORAGE_DIR, fileName);
      fs.writeFileSync(filePath, Buffer.from(videoBuffer));

      // Record invocation for video
      db.invocations.create({
        id: Math.random().toString(36).substring(7),
        jobId,
        step: 'generating',
        openrouterId: videoSubmission.id,
        modelId: job.videoModelId,
        cost: providerJob.data.usage?.cost,
        status: 'succeeded',
        updatedAt: new Date().toISOString(),
      });

      db.jobs.update(jobId, { 
        status: 'succeeded',
        outputVideoPath: `/api/storage/${fileName}`, // Internal path
      });
    }

  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error);
    db.jobs.update(jobId, { 
      status: 'failed',
      error: error.message,
    });
  }
}
