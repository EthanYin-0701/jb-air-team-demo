import { validateUrl } from '../lib/ssrf';

// Mock dns module
jest.mock('dns', () => ({
  resolve4: (hostname: string, cb: any) => {
    if (hostname === 'localhost') cb(null, ['127.0.0.1']);
    else if (hostname === 'google.com') cb(null, ['8.8.8.8']);
    else if (hostname === 'private.com') cb(null, ['10.0.0.1']);
    else cb(new Error('DNS Error'));
  },
  resolve6: (hostname: string, cb: any) => cb(null, []),
}));

describe('SSRF Guard', () => {
  it('allows valid HTTPS URLs', async () => {
    await expect(validateUrl('https://google.com/image.jpg')).resolves.toBe(true);
  });

  it('blocks non-HTTPS URLs', async () => {
    await expect(validateUrl('http://google.com/image.jpg')).rejects.toThrow('Only HTTPS URLs are allowed');
  });

  it('blocks loopback IP', async () => {
    await expect(validateUrl('https://127.0.0.1/')).rejects.toThrow('Private IP addresses are not allowed');
  });

  it('blocks private IP', async () => {
    await expect(validateUrl('https://10.0.0.1/')).rejects.toThrow('Private IP addresses are not allowed');
  });

  it('blocks hostname resolving to private IP', async () => {
    await expect(validateUrl('https://private.com/')).rejects.toThrow('Hostname resolves to a private IP address');
  });
});
