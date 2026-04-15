/**
 * Provider base URL validation
 *
 * Security goals:
 * - Prevent OpenAI credentials/prompts being sent to insecure/local/private endpoints
 * - Allow local Ollama endpoints while blocking arbitrary remote targets
 */

import net from 'node:net';
import type { SupportedProvider } from './models';

const LOCAL_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

function isPrivateOrSpecialIPv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;

  // Loopback, RFC1918 private, link-local, CGNAT
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

function isPrivateOrSpecialIPv6(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);

  // Loopback and unspecified
  if (normalized === '::1' || normalized === '::') {
    return true;
  }

  // Unique local addresses fc00::/7, link-local fe80::/10
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  return false;
}

function isPrivateOrSpecialIpLiteral(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  const ipVersion = net.isIP(normalized);

  if (ipVersion === 4) {
    return isPrivateOrSpecialIPv4(normalized);
  }

  if (ipVersion === 6) {
    return isPrivateOrSpecialIPv6(normalized);
  }

  return false;
}

function isLocalOllamaHost(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return LOCAL_LOOPBACK_HOSTS.has(normalized) || normalized.endsWith('.localhost');
}

function rejectCredentialsInUrl(provider: SupportedProvider, url: URL): void {
  if (url.username || url.password) {
    throw new Error(`Provider ${provider} baseUrl must not include credentials`);
  }
}

function validateOpenAIBaseUrl(url: URL): void {
  const hostname = normalizeHostname(url.hostname);

  if (url.protocol !== 'https:') {
    throw new Error('Provider openai baseUrl must use https://');
  }

  if (
    LOCAL_LOOPBACK_HOSTS.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    isPrivateOrSpecialIpLiteral(hostname)
  ) {
    throw new Error(
      'Provider openai baseUrl must target a public host (localhost/private addresses are blocked)'
    );
  }
}

function validateOllamaBaseUrl(url: URL): void {
  const hostname = normalizeHostname(url.hostname);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Provider ollama baseUrl must use http:// or https://');
  }

  if (!isLocalOllamaHost(hostname)) {
    throw new Error(
      'Provider ollama baseUrl must use a local host (localhost, 127.0.0.1, ::1, or 0.0.0.0)'
    );
  }
}

/**
 * Validate provider base URL according to provider security requirements.
 */
export function validateProviderBaseUrl(provider: SupportedProvider, baseUrl?: string): void {
  if (!baseUrl?.trim()) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`Provider ${provider} baseUrl must be a valid absolute URL`);
  }

  rejectCredentialsInUrl(provider, parsed);

  if (provider === 'openai') {
    validateOpenAIBaseUrl(parsed);
    return;
  }

  if (provider === 'ollama') {
    validateOllamaBaseUrl(parsed);
  }
}
