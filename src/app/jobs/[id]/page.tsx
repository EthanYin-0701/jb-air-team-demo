'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import SiteHeader from '../../components/SiteHeader';
import type { Job, ModelInvocation } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface JobUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  breakdown: {
    step: ModelInvocation['step'];
    modelId: string;
    tokens?: number;
    cost?: number;
    status: string;
  }[];
  settlementStatus: 'settled' | 'pending';
}

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [usage, setUsage] = useState<JobUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUsage, setShowUsage] = useState(false);
  
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch(`/api/jobs/${id}/usage`);
        const data = await res.json();
        setUsage(data);
      } catch {}
    };

    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/jobs/${id}`);
        if (!res.ok) {
          setError('Failed to fetch job');
          return;
        }
        const data = await res.json();
        setJob(data);
        
        if (data.status === 'succeeded' || data.status === 'failed') {
          if (pollInterval.current) clearInterval(pollInterval.current);
          await fetchUsage();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    void fetchJob();
    pollInterval.current = setInterval(fetchJob, 3000);
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pollInterval.current) clearInterval(pollInterval.current);
      } else {
        pollInterval.current = setInterval(fetchJob, 3000);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <SiteHeader />
        <div className="pet-card text-[var(--muted)]">Fetching your pet&apos;s performance...</div>
      </div>
    );
  }
  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <SiteHeader />
        <div className="pet-card text-[var(--danger)]">Error: {error || 'Job not found'}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <SiteHeader />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Generation Result</h1>
        <Link
          href="/"
          className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white"
        >
          Generate Again
        </Link>
      </div>

      <div className="pet-card mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
            job.status === 'succeeded' ? 'bg-green-100 text-[var(--success)]' :
            job.status === 'failed' ? 'bg-red-100 text-[var(--danger)]' :
            'bg-[var(--accent-soft)] text-[var(--primary)]'
          }`}>
            {job.status.toUpperCase()}
          </div>
          <span className="text-[var(--muted)] text-sm">Job ID: {job.id}</span>
        </div>

        {(job.inputs?.userPrompt || job.finalPrompt) && (
          <div className="mb-6 space-y-1 text-sm">
            {job.inputs?.userPrompt && (
              <p className="text-gray-600">
                <span className="font-semibold text-black">Your prompt: </span>
                {job.inputs.userPrompt}
              </p>
            )}
            {job.finalPrompt && (
              <p className="text-gray-600">
                <span className="font-semibold text-black">Refined prompt: </span>
                {job.finalPrompt}
              </p>
            )}
          </div>
        )}

        {job.status === 'succeeded' && job.outputVideoPath && (
          <div className="mb-6">
            <video 
              src={`${job.outputVideoPath}?token=mvp-token`} 
              controls 
              className="w-full rounded-lg shadow-lg aspect-video bg-black"
            />
            <div className="mt-4">
              <a 
                href={`${job.outputVideoPath}?token=mvp-token`} 
                download 
                className="inline-block rounded-full bg-[var(--primary)] px-5 py-2 font-semibold text-white hover:bg-[var(--primary-hover)]"
              >
                Download Video
              </a>
            </div>
          </div>
        )}

        {job.status === 'failed' && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-[var(--danger)]">
            <strong>Error:</strong> {job.error || 'Unknown error occurred'}
          </div>
        )}

        {(job.status !== 'succeeded' && job.status !== 'failed') && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--accent-soft)]/30 p-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pets/dog.svg" alt="" aria-hidden="true" className="mb-4 h-20 w-20" />
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)] mb-4"></div>
            <p className="text-lg font-medium">Stage: {job.status}</p>
            <p className="text-[var(--muted)]">Your pet is warming up on the dance floor...</p>
          </div>
        )}
      </div>

      {usage && (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          <button 
            onClick={() => setShowUsage(!showUsage)}
            className="w-full bg-[var(--accent-soft)]/50 p-4 flex justify-between items-center hover:bg-[var(--accent-soft)]"
          >
            <span className="font-semibold">Usage & Cost Breakdown</span>
            <span>{showUsage ? '▲' : '▼'}</span>
          </button>
          
          {showUsage && (
            <div className="p-4 bg-white space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-[var(--accent-soft)]/40 rounded-xl">
                  <p className="text-xs text-[var(--muted)]">Input Tokens</p>
                  <p className="text-lg font-bold">{usage.totalInputTokens || 'N/A'}</p>
                </div>
                <div className="p-3 bg-[var(--accent-soft)]/40 rounded-xl">
                  <p className="text-xs text-[var(--muted)]">Output Tokens</p>
                  <p className="text-lg font-bold">{usage.totalOutputTokens || 'N/A'}</p>
                </div>
                <div className="p-3 bg-[var(--accent-soft)]/40 rounded-xl">
                  <p className="text-xs text-[var(--muted)]">Total Tokens</p>
                  <p className="text-lg font-bold">{usage.totalTokens || 'N/A'}</p>
                </div>
                <div className="p-3 bg-[var(--accent-soft)]/40 rounded-xl">
                  <p className="text-xs text-[var(--muted)]">OpenRouter Credit</p>
                  <p className="text-lg font-bold">${usage.totalCost?.toFixed(4) || 'Pending'}</p>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">Invocation Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-2">Step</th>
                        <th className="pb-2">Model</th>
                        <th className="pb-2">Tokens</th>
                        <th className="pb-2">Cost</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.breakdown.map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2">{item.step}</td>
                          <td className="py-2">{item.modelId}</td>
                          <td className="py-2">{item.tokens || 'N/A'}</td>
                          <td className="py-2">{item.cost ? `$${item.cost.toFixed(4)}` : 'N/A'}</td>
                          <td className="py-2">{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="text-xs text-[var(--muted)] text-right mt-2">
                Settlement Status: {usage.settlementStatus}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
