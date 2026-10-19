'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from './components/SiteHeader';

export default function CreationStudio() {
  const router = useRouter();
  const [promptModels, setPromptModels] = useState<any[]>([]);
  const [videoModels, setVideoModels] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  
  const [petInput, setPetInput] = useState({ type: 'url', value: '' });
  const [danceInput, setDanceInput] = useState({ type: 'url', value: '' });
  /** 参考舞蹈视频默认折叠在「高级选项」里；只有填了 URL 才会作为参考素材提交。 */
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [selectedPromptModel, setSelectedPromptModel] = useState('');
  const [selectedVideoModel, setSelectedVideoModel] = useState('');
  
  const [style, setStyle] = useState('keep original look');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [duration, setDuration] = useState(5);
  const [startTime, setStartTime] = useState(0);
  const [userPrompt, setUserPrompt] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchModels() {
      try {
        const [pRes, vRes] = await Promise.all([
          fetch('/api/models?purpose=prompt'),
          fetch('/api/models?purpose=video')
        ]);
        const pData = await pRes.json();
        const vData = await vRes.json();
        
        if (pData.error || vData.error) {
          setError(pData.error || vData.error);
        } else {
          setPromptModels(pData);
          setVideoModels(vData);
        }
      } catch (e) {
        setError('Failed to load models');
      } finally {
        setLoadingModels(false);
      }
    }
    fetchModels();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // 1. Create assets — the pet image is required, the dance reference is optional
      // and only registered when the user filled in an advanced-options URL.
      const petRes = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image', // simplified
          role: 'pet',
          source: petInput.type,
          url: petInput.type === 'url' ? petInput.value : undefined,
        }),
      });
      const petAsset = await petRes.json();
      if (!petRes.ok) throw new Error(petAsset.error || 'Failed to register the pet image');

      const danceUrl = danceInput.value.trim();
      let danceAssetId: string | undefined;
      if (danceUrl) {
        const danceRes = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'video',
            role: 'dance',
            source: danceInput.type,
            url: danceInput.type === 'url' ? danceUrl : undefined,
          }),
        });
        const danceAsset = await danceRes.json();
        if (!danceRes.ok) throw new Error(danceAsset.error || 'Failed to register the dance reference');
        danceAssetId = danceAsset.id;
      }

      // 2. Get Quote
      const quoteRes = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          petAssetId: petAsset.id,
          danceAssetId,
          promptModelId: selectedPromptModel,
          videoModelId: selectedVideoModel,
          params: { userPrompt, style, aspectRatio, duration, startTime },
        }),
      });
      const quote = await quoteRes.json();
      if (!quoteRes.ok) throw new Error(quote.error || 'Failed to create a quote');

      // 3. Submit Job
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          petAssetId: petAsset.id,
          danceAssetId,
          userPrompt,
          style,
          aspectRatio,
          duration,
          startTime,
        }),
      });
      const job = await jobRes.json();
      if (!jobRes.ok) throw new Error(job.error || 'Failed to submit the job');

      router.push(`/jobs/${job.id}`);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  if (loadingModels) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <SiteHeader />
        <div className="pet-card text-[var(--muted)]">Fetching the dance floor models...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <SiteHeader />

      {error && (
        <div className="mb-4 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-[var(--danger)]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="pet-card">
          <h2 className="text-xl font-semibold mb-4">1. Asset Inputs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">Pet Image (URL)</label>
              <input 
                type="text" 
                className="pet-field" 
                placeholder="https://..."
                value={petInput.value}
                onChange={(e) => setPetInput({ ...petInput, value: e.target.value })}
                required
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                Required. The pet in this image becomes the subject of the generated video.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">Dance Reference (optional)</label>
              <button
                type="button"
                onClick={() => setShowAdvanced((open) => !open)}
                aria-expanded={showAdvanced}
                className="text-sm text-[var(--primary)] hover:underline"
              >
                {showAdvanced ? '▾ Hide advanced options' : '▸ Advanced options: dance reference video'}
              </button>
              {showAdvanced && (
                <div className="mt-3 border-l-2 border-[var(--border)] pl-4">
                  <label className="block text-sm font-medium mb-1 text-[var(--muted)]" htmlFor="danceReference">
                    Dance Reference Video (URL) — optional
                  </label>
                  <input
                    id="danceReference"
                    type="text"
                    className="pet-field"
                    placeholder="https://.../dance.mp4"
                    value={danceInput.value}
                    onChange={(e) => setDanceInput({ ...danceInput, value: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Must be a downloadable media file (.mp4 / .mov). Video-site share pages
                    (YouTube, Bilibili, …) cannot be read by the model and the reference motion
                    would be silently ignored. Leave empty to generate from the prompt alone.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="pet-card">
          <h2 className="text-xl font-semibold mb-4">2. Model Selection</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">Prompt Model (Gemini)</label>
              <select 
                className="pet-field"
                value={selectedPromptModel}
                onChange={(e) => setSelectedPromptModel(e.target.value)}
                required
              >
                <option value="">Select a model</option>
                {promptModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">Video Model</label>
              <select 
                className="pet-field"
                value={selectedVideoModel}
                onChange={(e) => setSelectedVideoModel(e.target.value)}
                required
              >
                <option value="">Select a model</option>
                {videoModels.map(m => (
                  <option key={m.id} value={m.id} disabled={!m.videoInfo}>
                    {m.name} {!m.videoInfo ? '(missing video capability info)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="pet-card">
          <h2 className="text-xl font-semibold mb-4">3. Prompt (Optional)</h2>
          <label className="block text-sm font-medium mb-1 text-[var(--muted)]" htmlFor="userPrompt">
            Video Prompt
          </label>
          <textarea
            id="userPrompt"
            rows={4}
            className="pet-field"
            placeholder="e.g. The cat is doing a hip-hop routine on a neon-lit stage, wearing tiny sunglasses..."
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
          />
          <p className="mt-2 text-xs text-[var(--muted)]">
            Describe what the pet should do or how the scene should look. Leave empty to use the default
            dance prompt. The selected Gemini model refines it before it is sent to the video model.
          </p>
        </section>

        <section className="pet-card">
          <h2 className="text-xl font-semibold mb-4">4. Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">Style</label>
              <select 
                className="pet-field"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                <option value="keep original look">Keep Original Look</option>
                <option value="cute cartoon">Cute Cartoon</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">Aspect Ratio</label>
              <select 
                className="pet-field"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
              >
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">Duration (3-8s)</label>
              <input 
                type="number" 
                min="3" max="8" 
                className="pet-field"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
              />
            </div>
          </div>
        </section>

        <div className="pt-4">
          <button 
            type="submit" 
            disabled={submitting || !selectedPromptModel || !selectedVideoModel}
            className="pet-button"
          >
            {submitting ? 'Submitting...' : '🐾 Generate Pet Dance Video'}
          </button>
        </div>
      </form>
    </div>
  );
}
