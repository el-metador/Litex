import { describe, expect, it } from 'vitest';
import { resolveGeneratedTextOutput } from './stream-text';

describe('resolveGeneratedTextOutput', () => {
  it('returns direct result text when available', () => {
    const value = resolveGeneratedTextOutput({
      text: 'Прямой текст модели',
      response: { messages: [] },
    });

    expect(value).toBe('Прямой текст модели');
  });

  it('extracts text from response messages when top-level text is empty', () => {
    const value = resolveGeneratedTextOutput({
      text: '',
      response: {
        messages: [
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Первая часть ' },
              { type: 'text', text: 'ответа' },
            ],
          },
        ],
      },
    });

    expect(value).toBe('Первая часть ответа');
  });

  it('returns empty string when no text parts are present', () => {
    const value = resolveGeneratedTextOutput({
      text: '',
      response: {
        messages: [
          {
            role: 'assistant',
            content: [{ type: 'tool-call', toolCallId: 'call_1' }],
          },
        ],
      },
    });

    expect(value).toBe('');
  });
});
