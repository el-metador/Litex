import { randomUUID } from 'node:crypto';
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { formatDataStreamPart } from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { generateText, shouldUseNonStreamingLlm, streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import {
  checkUsageLimit,
  completeLlmJob,
  enqueueLlmJob,
  estimateTokensFromText,
  failLlmJob,
  isChatSessionOwnedByActor,
  recordBillingEvent,
  recordUsageEvent,
  resolveActor,
  serverEnv,
} from '~/lib/.server/node-layer';
import { resolveLlmModelId } from '~/lib/llm/models';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

async function chatAction({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as { messages: Messages; model?: string; sessionId?: string };
  const messages = body.messages;
  const sessionId = body.sessionId?.trim();
  const model = resolveLlmModelId(body.model ?? serverEnv.LITECODE_DEFAULT_MODEL);
  const exposeInternalStreamErrors =
    process.env.NODE_ENV !== 'production' || process.env.LITECODE_EXPOSE_STREAM_ERRORS === '1';
  const actor = await resolveActor(request);

  if (sessionId) {
    if (actor.isAnonymous) {
      return json({ error: 'Authentication required' }, { status: 401 });
    }

    const hasAccess = await isChatSessionOwnedByActor(actor, sessionId);

    if (hasAccess === null) {
      return json({ error: 'History backend unavailable' }, { status: 503 });
    }

    if (!hasAccess) {
      return json({ error: 'Invalid chat session' }, { status: 403 });
    }
  }

  const usageState = await checkUsageLimit(actor, 'chat');

  if (!usageState.allowed) {
    return json(
      {
        error: 'Daily chat limit reached',
        limits: usageState,
      },
      { status: 429 },
    );
  }

  const requestId = randomUUID();
  const stream = new SwitchableStream();
  const jobId = await enqueueLlmJob({
    actor,
    feature: 'chat',
    model,
    payload: {
      requestId,
      messageCount: messages.length,
    },
  });

  try {
    if (shouldUseNonStreamingLlm(model)) {
      console.warn('Streaming is unavailable in current runtime, falling back to non-stream generation', {
        requestId,
        model,
        hasTransformStream: typeof TransformStream === 'function',
        hasTextDecoderStream: typeof TextDecoderStream === 'function',
      });

      const continuedMessages: Messages = [...messages];
      let aggregatedText = '';
      let finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown' = 'unknown';

      for (let segment = 0; segment < MAX_RESPONSE_SEGMENTS; segment++) {
        const result = await generateText(continuedMessages, { toolChoice: 'none' }, model);

        aggregatedText += result.text;
        finishReason = result.finishReason;

        if (result.finishReason !== 'length') {
          break;
        }

        if (segment + 1 >= MAX_RESPONSE_SEGMENTS) {
          console.warn('Cannot continue non-stream message: Maximum segments reached');
          break;
        }

        const segmentsLeft = MAX_RESPONSE_SEGMENTS - (segment + 1);

        console.log(
          `Reached max token limit (${MAX_TOKENS}) in non-stream mode: Continuing message (${segmentsLeft} segments left)`,
        );

        continuedMessages.push({ role: 'assistant', content: result.text });
        continuedMessages.push({ role: 'user', content: CONTINUE_PROMPT });
      }

      const tokens = estimateTokensFromText(aggregatedText);

      void Promise.all([
        recordUsageEvent({
          actor,
          feature: 'chat',
          requestId,
          tokens,
          model,
        }),
        recordBillingEvent(actor, 'chat', requestId, tokens, {
          finishReason,
        }),
        completeLlmJob(jobId, {
          finishReason,
          tokens,
        }),
      ]).catch((error) => {
        console.error('Post-processing failed in non-stream mode', error);
      });

      const responseBody =
        formatDataStreamPart('text', aggregatedText) +
        formatDataStreamPart('finish_message', {
          finishReason,
          usage: {
            promptTokens: 0,
            completionTokens: tokens,
          },
        });

      return new Response(responseBody, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-litecode-request-id': requestId,
        },
      });
    }

    const options: StreamingOptions = {
      toolChoice: 'none',
      onFinish: async ({ text: content, finishReason }) => {
        if (finishReason === 'length') {
          if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
            console.warn('Cannot continue message: Maximum segments reached');
            stream.close();
            return;
          }

          const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

          console.log(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

          messages.push({ role: 'assistant', content });
          messages.push({ role: 'user', content: CONTINUE_PROMPT });

          const result = await streamText(messages, options, model);

          return stream.switchSource(
            result.toDataStream({
              getErrorMessage: (error) => {
                const message =
                  error instanceof Error
                    ? error.message
                    : typeof error === 'string'
                      ? error
                      : JSON.stringify(error);

                console.error('Chat continuation stream failed', {
                  requestId,
                  model,
                  error: message,
                  cause: error instanceof Error ? error.cause : undefined,
                  rawError: error,
                });

                const publicMessage = exposeInternalStreamErrors ? message : 'An error occurred.';
                return `${publicMessage} [requestId: ${requestId}]`;
              },
            }),
          );
        }

        const tokens = estimateTokensFromText(content);
        stream.close();

        void Promise.all([
          recordUsageEvent({
            actor,
            feature: 'chat',
            requestId,
            tokens,
            model,
          }),
          recordBillingEvent(actor, 'chat', requestId, tokens, {
            finishReason,
          }),
          completeLlmJob(jobId, {
            finishReason,
            tokens,
          }),
        ]).catch((error) => {
          console.error('Post-processing failed', error);
        });

        return;
      },
    };

    const result = await streamText(messages, options, model);
    stream.switchSource(
      result.toDataStream({
        getErrorMessage: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'string'
                ? error
                : JSON.stringify(error);

          console.error('Chat stream failed', {
            requestId,
            model,
            error: message,
            cause: error instanceof Error ? error.cause : undefined,
            rawError: error,
          });

          const publicMessage = exposeInternalStreamErrors ? message : 'An error occurred.';
          return `${publicMessage} [requestId: ${requestId}]`;
        },
      }),
    );

    return new Response(stream.readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'x-litecode-request-id': requestId,
      },
    });
  } catch (error) {
    console.error('Chat request failed', {
      requestId,
      model,
      error: error instanceof Error ? error.message : error,
    });

    await failLlmJob(jobId, error instanceof Error ? error.message : 'Unknown error');

    return json(
      {
        error: error instanceof Error ? error.message : 'Internal Server Error',
        requestId,
      },
      { status: 500 },
    );
  }
}
