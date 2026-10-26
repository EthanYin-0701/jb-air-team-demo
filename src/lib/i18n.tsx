'use client';

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';

export const LOCALES = ['en', 'zh', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'pawgroove.locale';

/** Native names, so every user can find their own language regardless of the current UI language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
};

/** Values for the <html lang> attribute. */
const HTML_LANG: Record<Locale, string> = { en: 'en', zh: 'zh-CN', ja: 'ja' };

const en = {
  'header.tagline': 'Turn your furry friend into a dancing star',
  'header.language': 'Language',
  'studio.loading': 'Fetching the dance floor models...',
  'studio.error.loadModels': 'Failed to load models',
  'studio.error.generic': 'Something went wrong',
  'studio.assets.title': '1. Asset Inputs',
  'studio.assets.petLabel': 'Pet Image (URL)',
  'studio.assets.petHint': 'Required. The pet in this image becomes the subject of the generated video.',
  'studio.assets.danceLabel': 'Dance Reference (optional)',
  'studio.assets.hideAdvanced': '▾ Hide advanced options',
  'studio.assets.showAdvanced': '▸ Advanced options: dance reference video',
  'studio.assets.danceUrlLabel': 'Dance Reference Video (URL) — optional',
  'studio.assets.danceHint':
    'Must be a downloadable media file (.mp4 / .mov). Video-site share pages (YouTube, Bilibili, …) cannot be read by the model and the reference motion would be silently ignored. Leave empty to generate from the prompt alone.',
  'studio.models.title': '2. Model Selection',
  'studio.models.prompt': 'Prompt Model (Gemini)',
  'studio.models.video': 'Video Model',
  'studio.models.select': 'Select a model',
  'studio.models.missingInfo': '(missing video capability info)',
  'studio.prompt.title': '3. Prompt (Optional)',
  'studio.prompt.label': 'Video Prompt',
  'studio.prompt.placeholder':
    'e.g. The cat is doing a hip-hop routine on a neon-lit stage, wearing tiny sunglasses...',
  'studio.prompt.hint':
    'Describe what the pet should do or how the scene should look. Leave empty to use the default dance prompt. The selected Gemini model refines it before it is sent to the video model.',
  'studio.settings.title': '4. Settings',
  'studio.settings.style': 'Style',
  'studio.settings.styleOriginal': 'Keep Original Look',
  'studio.settings.styleCartoon': 'Cute Cartoon',
  'studio.settings.aspectRatio': 'Aspect Ratio',
  'studio.settings.duration': 'Duration (3-8s)',
  'studio.submitting': 'Submitting...',
  'studio.submit': '🐾 Generate Pet Dance Video',
};

export type MessageKey = keyof typeof en;

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  en,
  zh: {
    'header.tagline': '让你的毛孩子变身舞蹈明星',
    'header.language': '语言',
    'studio.loading': '正在加载舞池模型...',
    'studio.error.loadModels': '模型加载失败',
    'studio.error.generic': '出错了',
    'studio.assets.title': '1. 素材输入',
    'studio.assets.petLabel': '宠物图片（URL）',
    'studio.assets.petHint': '必填。图片中的宠物将成为生成视频的主角。',
    'studio.assets.danceLabel': '舞蹈参考（可选）',
    'studio.assets.hideAdvanced': '▾ 收起高级选项',
    'studio.assets.showAdvanced': '▸ 高级选项：舞蹈参考视频',
    'studio.assets.danceUrlLabel': '舞蹈参考视频（URL）— 可选',
    'studio.assets.danceHint':
      '必须是可直接下载的媒体文件（.mp4 / .mov）。视频网站的分享页面（YouTube、Bilibili 等）无法被模型读取，参考动作会被静默忽略。留空则仅根据提示词生成。',
    'studio.models.title': '2. 模型选择',
    'studio.models.prompt': '提示词模型（Gemini）',
    'studio.models.video': '视频模型',
    'studio.models.select': '请选择模型',
    'studio.models.missingInfo': '（缺少视频能力信息）',
    'studio.prompt.title': '3. 提示词（可选）',
    'studio.prompt.label': '视频提示词',
    'studio.prompt.placeholder': '例如：小猫戴着迷你墨镜，在霓虹灯舞台上跳街舞……',
    'studio.prompt.hint':
      '描述宠物要做的动作或场景的样子。留空则使用默认舞蹈提示词。所选 Gemini 模型会先优化提示词，再发送给视频模型。',
    'studio.settings.title': '4. 设置',
    'studio.settings.style': '风格',
    'studio.settings.styleOriginal': '保持原样',
    'studio.settings.styleCartoon': '可爱卡通',
    'studio.settings.aspectRatio': '画面比例',
    'studio.settings.duration': '时长（3-8 秒）',
    'studio.submitting': '提交中...',
    'studio.submit': '🐾 生成宠物舞蹈视频',
  },
  ja: {
    'header.tagline': 'あなたのペットをダンススターに',
    'header.language': '言語',
    'studio.loading': 'ダンスフロアのモデルを読み込み中...',
    'studio.error.loadModels': 'モデルの読み込みに失敗しました',
    'studio.error.generic': 'エラーが発生しました',
    'studio.assets.title': '1. 素材の入力',
    'studio.assets.petLabel': 'ペット画像（URL）',
    'studio.assets.petHint': '必須。この画像のペットが生成される動画の主役になります。',
    'studio.assets.danceLabel': 'ダンス参考（任意）',
    'studio.assets.hideAdvanced': '▾ 詳細オプションを閉じる',
    'studio.assets.showAdvanced': '▸ 詳細オプション：ダンス参考動画',
    'studio.assets.danceUrlLabel': 'ダンス参考動画（URL）— 任意',
    'studio.assets.danceHint':
      'ダウンロード可能なメディアファイル（.mp4 / .mov）である必要があります。動画サイトの共有ページ（YouTube、Bilibili など）はモデルが読み込めず、参考モーションは無視されます。空欄の場合はプロンプトのみで生成します。',
    'studio.models.title': '2. モデルの選択',
    'studio.models.prompt': 'プロンプトモデル（Gemini）',
    'studio.models.video': '動画モデル',
    'studio.models.select': 'モデルを選択',
    'studio.models.missingInfo': '（動画機能の情報がありません）',
    'studio.prompt.title': '3. プロンプト（任意）',
    'studio.prompt.label': '動画プロンプト',
    'studio.prompt.placeholder': '例：小さなサングラスをかけた猫が、ネオンのステージでヒップホップを踊る……',
    'studio.prompt.hint':
      'ペットの動きやシーンの雰囲気を説明してください。空欄の場合はデフォルトのダンスプロンプトを使用します。選択した Gemini モデルが内容を調整してから動画モデルに送信します。',
    'studio.settings.title': '4. 設定',
    'studio.settings.style': 'スタイル',
    'studio.settings.styleOriginal': 'オリジナルのまま',
    'studio.settings.styleCartoon': 'かわいいカートゥーン',
    'studio.settings.aspectRatio': 'アスペクト比',
    'studio.settings.duration': '長さ（3〜8 秒）',
    'studio.submitting': '送信中...',
    'studio.submit': '🐾 ペットのダンス動画を生成',
  },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function translate(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key];
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

// Without a provider (e.g. isolated component tests) the UI falls back to English.
const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => translate(DEFAULT_LOCALE, key),
});

// The chosen locale lives in localStorage; this tiny store lets React subscribe to it.
const localeListeners = new Set<() => void>();

function subscribeLocale(listener: () => void) {
  localeListeners.add(listener);
  return () => {
    localeListeners.delete(listener);
  };
}

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    // localStorage can be unavailable (privacy mode); keep the default.
    return DEFAULT_LOCALE;
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // The server snapshot is always the default, so hydration matches and the stored
  // preference is applied right after.
  const locale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => DEFAULT_LOCALE);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore persistence failures.
    }
    localeListeners.forEach((listener) => listener());
  }, []);

  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
