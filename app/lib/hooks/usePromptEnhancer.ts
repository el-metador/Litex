import { useState } from 'react';
import { fetchWithSupabaseAuth } from '~/lib/supabase/authenticated-fetch';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (input: string, setInput: (value: string) => void, model?: string) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);
    const response = await fetchWithSupabaseAuth('/api/enhancer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: input,
        model,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Enhancer request failed (${response.status})`;

      try {
        const body = (await response.json()) as { error?: string; requestId?: string };
        errorMessage = body.error ?? errorMessage;

        if (body.requestId) {
          errorMessage = `${errorMessage} [requestId: ${body.requestId}]`;
        }
      } catch {
        // noop
      }

      setEnhancingPrompt(false);
      setPromptEnhanced(false);
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();

    const originalInput = input;

    if (!reader) {
      setEnhancingPrompt(false);
      setPromptEnhanced(false);
      throw new Error('Enhancer did not return a readable stream');
    }

    const decoder = new TextDecoder();

    let _input = '';
    let _error;

    try {
      setInput('');

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        _input += decoder.decode(value);

        logger.trace('Set input', _input);

        setInput(_input);
      }
    } catch (error) {
      _error = error;
      setInput(originalInput);
    } finally {
      if (_error) {
        logger.error(_error);
        setEnhancingPrompt(false);
        setPromptEnhanced(false);
        throw _error;
      }

      setEnhancingPrompt(false);
      setPromptEnhanced(true);

      setTimeout(() => {
        setInput(_input);
      });
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
