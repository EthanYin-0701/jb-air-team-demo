'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from './components/SiteHeader';
import { useI18n } from '@/lib/i18n';
import type { OpenRouterModel, VideoModelInfo } from '@/lib/openrouter';

export default function CreationStudio() {
  const router = useRouter();
  const { t } = useI18n();
  const [promptModels, setPromptModels] = useState<OpenRouterModel[]>([]);
  const [videoModels, setVideoModels] = useState<(OpenRouterModel & { videoInfo?: VideoModelInfo })[]>([]);
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
  const [startTime] = useState(0);
  const [userPrompt, setUserPrompt] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [modelsLoadFailed, setModelsLoadFailed] = useState(false);

  useEffect(() => {
    async function fetchModels() {
      try {
        const [pRes, vRes] = await Promise.all([
          fetch('/api/models?purpose=prompt'),
          fetch('/api/models?purpose=video')
        ]);
        // A crashed/timed-out serverless function returns a non-JSON body;
        // surface the HTTP status instead of a generic parse failure.
        const parse = async (res: Response) => {
          try {
            return await res.json();
          } catch {
            return { error: `Failed to load models (HTTP ${res.status})` };
          }
        };
        const [pData, vData] = await Promise.all([parse(pRes), parse(vRes)]);
        
        if (pData.error || vData.error) {
          setError(pData.error || vData.error);
        } else {
          setPromptModels(pData);
          setVideoModels(vData);
        }
      } catch {
        setModelsLoadFailed(true);
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
    } catch (e) {
      setError((e instanceof Error && e.message) || t('studio.error.generic'));
      setSubmitting(false);
    }
  };

  const shownError = error || (modelsLoadFailed ? t('studio.error.loadModels') : '');

  if (loadingModels) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <SiteHeader />
        <div className="pet-card text-[var(--muted)]">{t('studio.loading')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <SiteHeader />

      {shownError && (
        <div className="mb-4 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-[var(--danger)]">
          {shownError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="pet-card">
          <h2 className="text-xl font-semibold mb-4">{t('studio.assets.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">{t('studio.assets.petLabel')}</label>
              <input 
                type="text" 
                className="pet-field" 
                placeholder="https://..."
                value={petInput.value}
                onChange={(e) => setPetInput({ ...petInput, value: e.target.value })}
                required
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                {t('studio.assets.petHint')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">{t('studio.assets.danceLabel')}</label>
              <button
                type="button"
                onClick={() => setShowAdvanced((open) => !open)}
                aria-expanded={showAdvanced}
                className="text-sm text-[var(--primary)] hover:underline"
              >
                {showAdvanced ? t('studio.assets.hideAdvanced') : t('studio.assets.showAdvanced')}
              </button>
              {showAdvanced && (
                <div className="mt-3 border-l-2 border-[var(--border)] pl-4">
                  <label className="block text-sm font-medium mb-1 text-[var(--muted)]" htmlFor="danceReference">
                    {t('studio.assets.danceUrlLabel')}
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
                    {t('studio.assets.danceHint')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="pet-card">
          <h2 className="text-xl font-semibold mb-4">{t('studio.models.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">{t('studio.models.prompt')}</label>
              <select 
                className="pet-field"
                value={selectedPromptModel}
                onChange={(e) => setSelectedPromptModel(e.target.value)}
                required
              >
                <option value="">{t('studio.models.select')}</option>
                {promptModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">{t('studio.models.video')}</label>
              <select 
                className="pet-field"
                value={selectedVideoModel}
                onChange={(e) => setSelectedVideoModel(e.target.value)}
                required
              >
                <option value="">{t('studio.models.select')}</option>
                {videoModels.map(m => (
                  <option key={m.id} value={m.id} disabled={!m.videoInfo}>
                    {m.name} {!m.videoInfo ? t('studio.models.missingInfo') : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="pet-card">
          <h2 className="text-xl font-semibold mb-4">{t('studio.prompt.title')}</h2>
          <label className="block text-sm font-medium mb-1 text-[var(--muted)]" htmlFor="userPrompt">
            {t('studio.prompt.label')}
          </label>
          <textarea
            id="userPrompt"
            rows={4}
            className="pet-field"
            placeholder={t('studio.prompt.placeholder')}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
          />
          <p className="mt-2 text-xs text-[var(--muted)]">
            {t('studio.prompt.hint')}
          </p>
        </section>

        <section className="pet-card">
          <h2 className="text-xl font-semibold mb-4">{t('studio.settings.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">{t('studio.settings.style')}</label>
              <select 
                className="pet-field"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                <option value="keep original look">{t('studio.settings.styleOriginal')}</option>
                <option value="cute cartoon">{t('studio.settings.styleCartoon')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">{t('studio.settings.aspectRatio')}</label>
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
              <label className="block text-sm font-medium mb-1 text-[var(--muted)]">{t('studio.settings.duration')}</label>
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
            {submitting ? t('studio.submitting') : t('studio.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
