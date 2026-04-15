import { describe, expect, it } from 'vitest';
import { createServerRouter } from './routes';

describe('server routes', () => {
  it('should create express router instance', () => {
    const router = createServerRouter();

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});
