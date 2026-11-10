import {
  FALLBACK_MAX_DURATION,
  FALLBACK_MIN_DURATION,
  checkDuration,
  supportedDurations,
} from '../lib/video-params';

/**
 * 时长必须跟随所选视频模型的 supported_durations：
 * 浏览器端用它限制下拉可选项，服务端用同一套规则重验。
 */
describe('supportedDurations', () => {
  it('returns a sorted, de-duplicated list of positive whole seconds', () => {
    expect(supportedDurations({ supported_durations: [8, 4, 4, 6] })).toEqual([4, 6, 8]);
  });

  it('drops values that cannot be whole seconds', () => {
    expect(
      supportedDurations({ supported_durations: [5, 2.5, -3, 0, Number.NaN] }),
    ).toEqual([5]);
  });

  it('treats null or missing capabilities as "not provided"', () => {
    expect(supportedDurations({ supported_durations: null })).toEqual([]);
    expect(supportedDurations(undefined)).toEqual([]);
    expect(supportedDurations(null)).toEqual([]);
  });
});

describe('checkDuration', () => {
  const supported = [4, 6, 8];

  it('accepts a duration the selected video model supports', () => {
    expect(checkDuration(6, supported)).toEqual({ ok: true, duration: 6, supported });
  });

  it('rejects a duration the model does not support and reports the allowed ones', () => {
    const result = checkDuration(5, supported);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unsupported');
      expect(result.supported).toEqual(supported);
      expect(result.message).toContain('4, 6, 8');
    }
  });

  it('accepts numeric strings coming from JSON payloads', () => {
    expect(checkDuration('8', supported)).toMatchObject({ ok: true, duration: 8 });
  });

  it('rejects missing, fractional and non-numeric values', () => {
    expect(checkDuration(undefined, supported).ok).toBe(false);
    expect(checkDuration('', supported).ok).toBe(false);
    expect(checkDuration(6.5, supported).ok).toBe(false);
    expect(checkDuration('six', supported).ok).toBe(false);
  });

  it('falls back to the unverified range when the model publishes no durations', () => {
    expect(checkDuration(FALLBACK_MIN_DURATION, [])).toMatchObject({ ok: true });
    expect(checkDuration(FALLBACK_MAX_DURATION, [])).toMatchObject({ ok: true });
    expect(checkDuration(FALLBACK_MAX_DURATION + 1, []).ok).toBe(false);
    expect(checkDuration(FALLBACK_MIN_DURATION - 1, []).ok).toBe(false);
  });

  it('requires a value when the model publishes durations', () => {
    const result = checkDuration(undefined, supported);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing');
  });
});
