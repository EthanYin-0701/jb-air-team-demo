import { mergeCatalogs } from '../lib/openrouter';

describe('Catalog Merge Logic', () => {
  const mockPromptModels: any[] = [
    { id: 'gemini-1', architecture: { output_modalities: ['text'] } },
    { id: 'other-1', architecture: { output_modalities: ['text'] } },
  ];
  
  const mockVideoModels: any[] = [
    { id: 'video-1', architecture: { output_modalities: ['video'] } },
    { id: 'video-2', architecture: { output_modalities: ['video'] } },
  ];
  
  const mockVideoInfo: any[] = [
    { id: 'video-1', supported_durations: [5] },
  ];

  it('filters prompt models correctly', () => {
    const { promptModels } = mergeCatalogs(mockPromptModels, [], []);
    expect(promptModels).toHaveLength(2);
    expect(promptModels[0].id).toBe('gemini-1');
  });

  it('merges video models with capability info', () => {
    const { videoModels } = mergeCatalogs([], mockVideoModels, mockVideoInfo);
    expect(videoModels).toHaveLength(2);
    
    const v1 = videoModels.find(m => m.id === 'video-1');
    expect(v1?.videoInfo).toBeDefined();
    expect(v1?.videoInfo?.supported_durations).toContain(5);
    
    const v2 = videoModels.find(m => m.id === 'video-2');
    expect(v2?.videoInfo).toBeUndefined();
  });
});
