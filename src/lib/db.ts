import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'db.json');

export interface User {
  id: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  ownerId: string;
  type: 'image' | 'video';
  role: 'pet' | 'dance' | 'frame';
  source: 'upload' | 'url';
  url?: string;
  localPath?: string;
  metadata?: Record<string, unknown>;
  status: 'pending' | 'ready' | 'failed';
  createdAt: string;
}

export interface ModelInvocation {
  id: string;
  jobId: string;
  step: 'refining' | 'generating';
  openrouterId?: string;
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cost?: number;
  status: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  ownerId: string;
  promptModelId: string;
  videoModelId: string;
  status: 'queued' | 'analyzing' | 'submitting' | 'provider_queued' | 'generating' | 'processing' | 'reconciling' | 'succeeded' | 'failed' | 'cancelled';
  inputs: {
    petAssetId: string;
    /** 可选的参考舞蹈视频素材；未开启「高级选项」时不存在。 */
    danceAssetId?: string;
    frameTimestamp?: number;
    /** Optional free-form instruction from the user, refined by the prompt model. */
    userPrompt?: string;
    style: string;
    aspectRatio: string;
    duration: number;
    startTime: number;
  };
  quoteId: string;
  providerJobId?: string;
  finalPrompt?: string;
  outputVideoPath?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
  id: string;
  ownerId: string;
  promptModelId: string;
  videoModelId: string;
  expiresAt: string;
  estimatedCost?: number;
  params: Record<string, unknown>;
}

interface Schema {
  users: User[];
  assets: Asset[];
  jobs: Job[];
  quotes: Quote[];
  invocations: ModelInvocation[];
}

const initialSchema: Schema = {
  users: [{ id: 'local-user', createdAt: new Date().toISOString() }],
  assets: [],
  jobs: [],
  quotes: [],
  invocations: [],
};

function readDb(): Schema {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialSchema, null, 2));
    return initialSchema;
  }
  const data = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(data);
}

function writeDb(data: Schema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export const db = {
  users: {
    get: (id: string) => readDb().users.find(u => u.id === id),
  },
  assets: {
    get: (id: string) => readDb().assets.find(a => a.id === id),
    create: (asset: Asset) => {
      const data = readDb();
      data.assets.push(asset);
      writeDb(data);
      return asset;
    },
    update: (id: string, updates: Partial<Asset>) => {
      const data = readDb();
      const index = data.assets.findIndex(a => a.id === id);
      if (index !== -1) {
        data.assets[index] = { ...data.assets[index], ...updates };
        writeDb(data);
      }
    },
  },
  jobs: {
    get: (id: string) => readDb().jobs.find(j => j.id === id),
    create: (job: Job) => {
      const data = readDb();
      data.jobs.push(job);
      writeDb(data);
      return job;
    },
    update: (id: string, updates: Partial<Job>) => {
      const data = readDb();
      const index = data.jobs.findIndex(j => j.id === id);
      if (index !== -1) {
        data.jobs[index] = { ...data.jobs[index], ...updates, updatedAt: new Date().toISOString() };
        writeDb(data);
      }
    },
    list: (ownerId: string) => readDb().jobs.filter(j => j.ownerId === ownerId),
  },
  quotes: {
    get: (id: string) => readDb().quotes.find(q => q.id === id),
    create: (quote: Quote) => {
      const data = readDb();
      data.quotes.push(quote);
      writeDb(data);
      return quote;
    },
  },
  invocations: {
    listByJob: (jobId: string) => readDb().invocations.filter(i => i.jobId === jobId),
    create: (invocation: ModelInvocation) => {
      const data = readDb();
      data.invocations.push(invocation);
      writeDb(data);
      return invocation;
    },
    update: (id: string, updates: Partial<ModelInvocation>) => {
      const data = readDb();
      const index = data.invocations.findIndex(i => i.id === id);
      if (index !== -1) {
        data.invocations[index] = { ...data.invocations[index], ...updates, updatedAt: new Date().toISOString() };
        writeDb(data);
      }
    },
  },
};
