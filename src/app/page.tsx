'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CreationStudio() {
  const router = useRouter();
  const [promptModels, setPromptModels] = useState<any[]>([]);
  const [videoModels, setVideoModels] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  
  const [petInput, setPetInput] = useState({ type: 'url', value: '' });
  const [danceInput, setDanceInput] = useState({ type: 'url', value: '' });
  
  const [selectedPromptModel, setSelectedPromptModel] = useState('');
  const [selectedVideoModel, setSelectedVideoModel] = useState('');
  
  const [style, setStyle] = useState('keep original look');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [duration, setDuration] = useState(5);
  const [startTime, setStartTime] = useState(0);

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
      // 1. Create assets
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

      const danceRes = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'video',
          role: 'dance',
          source: danceInput.type,
          url: danceInput.type === 'url' ? danceInput.value : undefined,
        }),
      });
      const danceAsset = await danceRes.json();

      // 2. Get Quote
      const quoteRes = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          petAssetId: petAsset.id,
          danceAssetId: danceAsset.id,
          promptModelId: selectedPromptModel,
          videoModelId: selectedVideoModel,
          params: { style, aspectRatio, duration, startTime },
        }),
      });
      const quote = await quoteRes.json();

      // 3. Submit Job
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          petAssetId: petAsset.id,
          danceAssetId: danceAsset.id,
          style,
          aspectRatio,
          duration,
          startTime,
        }),
      });
      const job = await jobRes.json();

      router.push(`/jobs/${job.id}`);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  if (loadingModels) return <div className="p-8">Loading models...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">PawGroove Studio</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-4">1. Asset Inputs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">Pet Image (URL)</label>
              <input 
                type="text" 
                className="w-full p-2 border rounded text-black" 
                placeholder="https://..."
                value={petInput.value}
                onChange={(e) => setPetInput({ ...petInput, value: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Dance Reference (URL)</label>
              <input 
                type="text" 
                className="w-full p-2 border rounded text-black" 
                placeholder="https://..."
                value={danceInput.value}
                onChange={(e) => setDanceInput({ ...danceInput, value: e.target.value })}
                required
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">2. Model Selection</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">Prompt Model (Gemini)</label>
              <select 
                className="w-full p-2 border rounded text-black"
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
              <label className="block text-sm font-medium mb-1">Video Model</label>
              <select 
                className="w-full p-2 border rounded text-black"
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

        <section>
          <h2 className="text-xl font-semibold mb-4">3. Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">Style</label>
              <select 
                className="w-full p-2 border rounded text-black"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                <option value="keep original look">Keep Original Look</option>
                <option value="cute cartoon">Cute Cartoon</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Aspect Ratio</label>
              <select 
                className="w-full p-2 border rounded text-black"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
              >
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duration (3-8s)</label>
              <input 
                type="number" 
                min="3" max="8" 
                className="w-full p-2 border rounded text-black"
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
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
          >
            {submitting ? 'Submitting...' : 'Generate Pet Dance Video'}
          </button>
        </div>
      </form>
    </div>
  );
}
