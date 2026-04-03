import { describe, expect, it } from 'vitest';
import { formatSessionList } from './App';

describe('formatSessionList', () => {
  it('should return a friendly message when no sessions exist', () => {
    expect(formatSessionList([])).toBe('No saved sessions found.');
  });

  it('should format saved sessions into a readable list', () => {
    const output = formatSessionList([
      {
        id: 'session-1',
        title: 'First Session',
        createdAt: new Date('2026-04-03T00:00:00.000Z'),
        updatedAt: new Date('2026-04-03T01:00:00.000Z'),
        messageCount: 3,
        preview: 'Hello there',
      },
    ]);

    expect(output).toContain('Saved sessions:');
    expect(output).toContain('session-1');
    expect(output).toContain('First Session');
    expect(output).toContain('3 messages');
  });
});
