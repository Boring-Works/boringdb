interface Env {
    AI: Ai;
    ASSETS: Fetcher;
    AI_MODEL: string;
    AI_DIAGRAM_MODEL: string;
}

// Map client model names to Workers AI model paths
const MODEL_MAP: Record<string, string> = {
    'gpt-oss-120b': '@cf/openai/gpt-oss-120b',
    'qwen2.5-coder-32b-instruct': '@cf/qwen/qwen2.5-coder-32b-instruct',
};

function resolveModel(requestedModel: string | undefined, env: Env): string {
    if (requestedModel && MODEL_MAP[requestedModel]) {
        return MODEL_MAP[requestedModel];
    }
    // Default to the general-purpose model
    return `@cf/openai/${env.AI_MODEL}`;
}

const ALLOWED_ORIGINS = [
    'https://db.getboring.io',
    'https://chartdb.codyboring.workers.dev',
    'http://localhost:5173',
];

/**
 * Normalize a Workers AI SSE stream into strict OpenAI format.
 * Workers AI has two streaming formats depending on the model:
 *   - OpenAI-compat models (@cf/openai/*): {"choices":[{"delta":{"content":"..."}}]}
 *   - Legacy models (@cf/qwen/*, etc): {"response":"..."} or {"response":"","usage":{...}}
 * The AI SDK requires the OpenAI format with a 'choices' array.
 * This transform converts legacy events and drops usage-only events.
 */
function normalizeAIStream(aiStream: ReadableStream | Response) {
    const reader =
        aiStream instanceof ReadableStream
            ? aiStream.getReader()
            : aiStream?.body?.getReader();

    if (!reader) {
        return new ReadableStream({
            start(controller) {
                controller.enqueue(
                    new TextEncoder().encode('data: [DONE]\n\n'),
                );
                controller.close();
            },
        });
    }

    let buffer = '';
    let chunkIndex = 0;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    return new ReadableStream({
        async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
                controller.close();
                return;
            }

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':')) continue;

                if (trimmed === 'data: [DONE]') {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    continue;
                }

                if (trimmed.startsWith('data: ')) {
                    try {
                        const parsed = JSON.parse(trimmed.slice(6));

                        // Already OpenAI format — pass through
                        if (parsed.choices && Array.isArray(parsed.choices)) {
                            controller.enqueue(
                                encoder.encode(trimmed + '\n\n'),
                            );
                            continue;
                        }

                        // Legacy Workers AI format — convert to OpenAI
                        if ('response' in parsed && parsed.response !== '') {
                            const openaiChunk = {
                                id: `chatcmpl-stream-${chunkIndex++}`,
                                object: 'chat.completion.chunk',
                                choices: [
                                    {
                                        index: 0,
                                        delta: {
                                            content: parsed.response,
                                        },
                                        finish_reason: null,
                                    },
                                ],
                            };
                            controller.enqueue(
                                encoder.encode(
                                    `data: ${JSON.stringify(openaiChunk)}\n\n`,
                                ),
                            );
                            continue;
                        }

                        // Drop empty response / usage-only events
                    } catch {
                        // Drop unparseable events
                    }
                }
            }
        },
        cancel() {
            reader.cancel?.();
        },
    });
}

export default {
    async fetch(request: Request, env: Env) {
        const url = new URL(request.url);

        // Only handle /api/v1/* requests — everything else goes to static assets
        if (!url.pathname.startsWith('/api/v1/')) {
            return env.ASSETS.fetch(request);
        }

        const origin = request.headers.get('Origin') || '';
        const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '';
        const corsHeaders = {
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // Only allow POST
        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        // Reject unknown origins
        if (origin && !ALLOWED_ORIGINS.includes(origin)) {
            return new Response('Forbidden', { status: 403 });
        }

        // Handle chat completions via Workers AI
        if (url.pathname === '/api/v1/chat/completions') {
            try {
                const body = await request.json();
                console.log('REQUEST:', JSON.stringify({
                    method: request.method,
                    origin,
                    hasMessages: !!body.messages?.length,
                    stream: body.stream,
                    model: body.model,
                    keys: Object.keys(body),
                }));
                let messages = body.messages || [];

                // AI SDK sends 'prompt' — convert to messages format
                if (messages.length === 0 && body.prompt) {
                    messages = [{ role: 'user', content: body.prompt }];
                }

                // AI SDK for reasoning models sends max_completion_tokens instead of max_tokens
                const maxTokens =
                    body.max_tokens || body.max_completion_tokens || 16384;

                const aiOptions = {
                    messages,
                    max_tokens: maxTokens,
                    // Workers AI handles temperature natively; AI SDK strips it
                    // for reasoning models, so default to 0.3 for deterministic SQL output
                    temperature: body.temperature ?? 0.3,
                };

                const resolvedModel = resolveModel(body.model, env);

                if (body.stream) {
                    const aiStream = await env.AI.run(resolvedModel, {
                        ...aiOptions,
                        stream: true,
                    });

                    // Normalize stream: convert legacy Workers AI format to OpenAI format
                    const cleanStream = normalizeAIStream(aiStream);

                    return new Response(cleanStream, {
                        headers: {
                            ...corsHeaders,
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-cache',
                            Connection: 'keep-alive',
                        },
                    });
                }

                const result = await env.AI.run(resolvedModel, aiOptions);

                // Handle different response shapes from Workers AI:
                // OpenAI-compat format: { choices: [{ message: { content } }] }
                // Legacy format: { response: "text" } or plain string
                const content =
                    result?.choices?.[0]?.message?.content ||
                    result.response ||
                    (typeof result === 'string' ? result : '');

                return Response.json(
                    {
                        id: `chatcmpl-${crypto.randomUUID()}`,
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: resolvedModel,
                        choices: [
                            {
                                index: 0,
                                message: {
                                    role: 'assistant',
                                    content,
                                },
                                finish_reason: 'stop',
                            },
                        ],
                        usage: result?.usage ?? {
                            prompt_tokens: 0,
                            completion_tokens: 0,
                            total_tokens: 0,
                        },
                    },
                    { headers: corsHeaders },
                );
            } catch (error) {
                console.error('Workers AI error:', error);
                return Response.json(
                    {
                        error: {
                            message:
                                'AI service temporarily unavailable. Please try again.',
                            type: 'server_error',
                        },
                    },
                    { status: 500, headers: corsHeaders },
                );
            }
        }

        return new Response('Not found', { status: 404 });
    },
};
