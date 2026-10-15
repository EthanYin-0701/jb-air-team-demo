'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUsage, setShowUsage] = useState(false);
  
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) throw new Error('Failed to fetch job');
      const data = await res.json();
      setJob(data);
      
      if (data.status === 'succeeded' || data.status === 'failed') {
        if (pollInterval.current) clearInterval(pollInterval.current);
        fetchUsage();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    try {
      const res = await fetch(`/api/jobs/${id}/usage`);
      const data = await res.json();
      setUsage(data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchJob();
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

  if (loading) return <div className="p-8">Loading result...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Generation Result</h1>
        <Link href="/" className="text-blue-600 hover:underline">Generate Again</Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-8 border">
        <div className="flex items-center space-x-4 mb-4">
          <div className={`px-3 py-1 rounded-full text-sm font-semibold text-black ${
            job.status === 'succeeded' ? 'bg-green-100 text-green-800' :
            job.status === 'failed' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {job.status.toUpperCase()}
          </div>
          <span className="text-gray-500 text-sm">Job ID: {job.id}</span>
        </div>

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
                className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700"
              >
                Download Video
              </a>
            </div>
          </div>
        )}

        {job.status === 'failed' && (
          <div className="bg-red-50 p-4 rounded text-red-700 mb-6">
            <strong>Error:</strong> {job.error || 'Unknown error occurred'}
          </div>
        )}

        {(job.status !== 'succeeded' && job.status !== 'failed') && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-lg font-medium text-black">Stage: {job.status}</p>
            <p className="text-gray-500">Processing your dance video...</p>
          </div>
        )}
      </div>

      {usage && (
        <div className="border rounded-lg overflow-hidden shadow">
          <button 
            onClick={() => setShowUsage(!showUsage)}
            className="w-full bg-gray-50 p-4 flex justify-between items-center hover:bg-gray-100"
          >
            <span className="font-semibold text-black">Usage & Cost Breakdown</span>
            <span>{showUsage ? '▲' : '▼'}</span>
          </button>
          
          {showUsage && (
            <div className="p-4 bg-white space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">Input Tokens</p>
                  <p className="text-lg font-bold text-black">{usage.totalInputTokens || 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">Output Tokens</p>
                  <p className="text-lg font-bold text-black">{usage.totalOutputTokens || 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">Total Tokens</p>
                  <p className="text-lg font-bold text-black">{usage.totalTokens || 'N/A'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-500">OpenRouter Credit</p>
                  <p className="text-lg font-bold text-black">${usage.totalCost?.toFixed(4) || 'Pending'}</p>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2 text-black">Invocation Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-2 text-black">Step</th>
                        <th className="pb-2 text-black">Model</th>
                        <th className="pb-2 text-black">Tokens</th>
                        <th className="pb-2 text-black">Cost</th>
                        <th className="pb-2 text-black">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.breakdown.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2 text-black">{item.step}</td>
                          <td className="py-2 text-black">{item.modelId}</td>
                          <td className="py-2 text-black">{item.tokens || 'N/A'}</td>
                          <td className="py-2 text-black">{item.cost ? `$${item.cost.toFixed(4)}` : 'N/A'}</td>
                          <td className="py-2 text-black">{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 text-right mt-2">
                Settlement Status: {usage.settlementStatus}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
