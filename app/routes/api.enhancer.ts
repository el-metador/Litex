import { randomUUID } from 'node:crypto';
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { parseDataStreamPart } from 'ai';
import { generateText, shouldUseNonStreamingLlm, streamText } from '~/lib/.server/llm/stream-text';
import {
  checkUsageLimit,
  completeLlmJob,
  enqueueLlmJob,
  estimateTokensFromText,
  failLlmJob,
  recordBillingEvent,
  recordUsageEvent,
  resolveActor,
} from '~/lib/.server/node-layer';
import { resolveLlmModelId } from '~/lib/llm/models';
import { stripIndents } from '~/utils/stripIndent';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

async function enhancerAction({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as { message: string; model?: string };
  const message = body.message;
  const model = resolveLlmModelId(body.model);
  const actor = await resolveActor(request);
  const usageState = await checkUsageLimit(actor, 'enhancer');

  if (!usageState.allowed) {
    return json(
      {
        error: 'Daily prompt enhancer limit reached',
        limits: usageState,
      },
      { status: 429 },
    );
  }

  const requestId = randomUUID();
  const jobId = await enqueueLlmJob({
    actor,
    feature: 'enhancer',
    model,
    payload: {
      requestId,
      messageLength: message.length,
    },
  });

  try {
    const enhancerPrompt = stripIndents`
          Improve the user prompt wrapped in \`<original_prompt>\`.

          IMPORTANT: Respond only with the improved prompt text.

          <original_prompt>
            ${message}
          </original_prompt>
        `;

    if (shouldUseNonStreamingLlm(model)) {
      console.warn('Enhancer streaming is unavailable in current runtime, falling back to non-stream generation', {
        requestId,
        model,
        hasTransformStream: typeof TransformStream === 'function',
        hasTextDecoderStream: typeof TextDecoderStream === 'function',
      });

      const result = await generateText(
        [
          {
            role: 'user',
            content: enhancerPrompt,
          },
        ],
        { toolChoice: 'none' },
        model,
      );

      const content = result.text;
      const tokens = estimateTokensFromText(content);

      void Promise.all([
        recordUsageEvent({
          actor,
          feature: 'enhancer',
          requestId,
          tokens,
          model,
        }),
        recordBillingEvent(actor, 'enhancer', requestId, tokens, {
          finishReason: result.finishReason,
        }),
        completeLlmJob(jobId, {
          finishReason: result.finishReason,
          tokens,
        }),
      ]).catch((error) => {
        console.error('Enhancer post-processing failed in non-stream mode', error);
      });

      return new Response(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-litecode-request-id': requestId,
        },
      });
    }

    const result = await streamText(
      [
        {
          role: 'user',
          content: enhancerPrompt,
        },
      ],
      {
        onFinish: async ({ text: content, finishReason }) => {
          const tokens = estimateTokensFromText(content);
          void Promise.all([
            recordUsageEvent({
              actor,
              feature: 'enhancer',
              requestId,
              tokens,
              model,
            }),
            recordBillingEvent(actor, 'enhancer', requestId, tokens, {
              finishReason,
            }),
            completeLlmJob(jobId, {
              finishReason,
              tokens,
            }),
          ]).catch((error) => {
            console.error('Enhancer post-processing failed', error);
          });
        },
      },
      model,
    );

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const processedChunk = decoder
          .decode(chunk)
          .split('\n')
          .filter((line) => line !== '')
          .map(parseDataStreamPart)
          .map((part) => {
            if (part.type !== 'text') {
              return '';
            }

            return part.value;
          })
          .join('');

        controller.enqueue(encoder.encode(processedChunk));
      },
    });

    const transformedStream = result.toDataStream().pipeThrough(transformStream);

    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Enhancer request failed', {
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
