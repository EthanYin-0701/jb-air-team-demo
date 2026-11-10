/**
 * 视频时长能力与校验的共用逻辑。
 *
 * 浏览器端（`app/page.tsx`）用它把时长选择限制在所选视频模型
 * `supported_durations` 之内；服务端（`/api/quotes`、`/api/jobs`）用同一套规则
 * 重新校验，避免客户端绕过下拉框提交模型不支持的长度。
 * 纯函数、无 IO，可同时被客户端与服务端引用。
 */

export interface DurationCapability {
  supported_durations?: number[] | null;
}

/**
 * 目录未提供时长能力（`supported_durations` 为 null/缺失）时的兜底范围。
 * 此时能力属于「未提供」，不能当成模型支持全部时长，也不阻止用户生成；
 * 仍沿用历史上限 3-8 秒，并在界面上明确标注为未核验。
 */
export const FALLBACK_MIN_DURATION = 3;
export const FALLBACK_MAX_DURATION = 8;

/** 目录给出的、可用于下拉菜单的时长列表：去重、只保留正整数、升序。 */
export function supportedDurations(info?: DurationCapability | null): number[] {
  const raw = info?.supported_durations;
  if (!Array.isArray(raw)) return [];

  const unique = new Set<number>();
  for (const value of raw) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      unique.add(value);
    }
  }
  return [...unique].sort((a, b) => a - b);
}

/**
 * 把时长能力概括成一段范围文案，例如 `2–25s`；没有可选值时返回 null。
 * 目录未提供能力时用兜底范围 `3–8s`，与自由输入的 min/max 一致。
 */
export function supportedDurationRange(supported: number[]): string | null {
  const allowed = supportedDurations({ supported_durations: supported });
  if (allowed.length > 0) {
    return allowed.length === 1 ? `${allowed[0]}s` : `${allowed[0]}\u2013${allowed[allowed.length - 1]}s`;
  }
  return null;
}

export type DurationCheck =
  | { ok: true; duration: number; supported: number[] }
  | {
      ok: false;
      reason: 'missing' | 'invalid' | 'unsupported';
      message: string;
      supported: number[];
    };

/**
 * 校验一次提交的时长是否落在所选视频模型允许的范围内。
 *
 * `supported` 为空数组表示目录未提供时长能力，此时按兜底范围
 * `FALLBACK_MIN_DURATION..FALLBACK_MAX_DURATION` 校验。
 */
export function checkDuration(value: unknown, supported: number[]): DurationCheck {
  const allowed = supportedDurations({ supported_durations: supported });

  if (value == null || value === '') {
    return {
      ok: false,
      reason: 'missing',
      message: allowed.length
        ? `A duration is required: the selected video model supports ${supportedDurationRange(allowed)}.`
        : `A duration is required (${FALLBACK_MIN_DURATION}\u2013${FALLBACK_MAX_DURATION}s).`,
      supported: allowed,
    };
  }

  const duration = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(duration) || !Number.isInteger(duration) || duration <= 0) {
    return {
      ok: false,
      reason: 'invalid',
      message: 'Duration must be a positive whole number of seconds.',
      supported: allowed,
    };
  }

  if (allowed.length > 0) {
    if (!allowed.includes(duration)) {
      return {
        ok: false,
        reason: 'unsupported',
        message: `Duration ${duration}s is not supported by the selected video model (supported: ${supportedDurationRange(allowed)}).`,
        supported: allowed,
      };
    }
    return { ok: true, duration, supported: allowed };
  }

  if (duration < FALLBACK_MIN_DURATION || duration > FALLBACK_MAX_DURATION) {
    return {
      ok: false,
      reason: 'unsupported',
      message: `Duration ${duration}s is outside the ${FALLBACK_MIN_DURATION}\u2013${FALLBACK_MAX_DURATION}s range.`,
      supported: allowed,
    };
  }

  return { ok: true, duration, supported: allowed };
}
