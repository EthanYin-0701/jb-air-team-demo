import { isIP, isIPv4, isIPv6 } from 'net';
import { promisify } from 'util';
import dns from 'dns';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

export async function validateUrl(urlStr: string) {
  const url = new URL(urlStr);

  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  const hostname = url.hostname;
  
  // Basic hostname checks
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error('Private IP addresses are not allowed');
    }
    return true;
  }

  // Resolve DNS
  let ips: string[] = [];
  try {
    const ipv4s = await resolve4(hostname);
    ips = ips.concat(ipv4s);
  } catch (e) {}

  try {
    const ipv6s = await resolve6(hostname);
    ips = ips.concat(ipv6s);
  } catch (e) {}

  if (ips.length === 0) {
    throw new Error('Could not resolve hostname');
  }

  for (const ip of ips) {
    if (isPrivateIP(ip)) {
      throw new Error('Hostname resolves to a private IP address');
    }
  }

  return true;
}

function isPrivateIP(ip: string): boolean {
  if (isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 224.0.0.0/4 (Multicast)
    if (parts[0] >= 224) return true;
  } else if (isIPv6(ip)) {
    // ::1/128 (Loopback)
    if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
    // fc00::/7 (Unique local)
    if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true;
    // fe80::/10 (Link-local)
    if (ip.toLowerCase().startsWith('fe8')) return true;
  }
  return false;
}
