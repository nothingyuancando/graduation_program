/**
 * Multi-provider LLM adapter.
 * DeepSeek is the default provider, while OpenAI-compatible providers can still
 * be selected through environment variables or per-call options.
 */

export type LLMProvider =
  | "openai"
  | "deepseek"
  | "zhipu"
  | "kimi"
  | "qwen"
  | "siliconflow"
  | "doubao"
  | "custom";

export type MessageRole = "system" | "user" | "assistant";

export interface TextMessage {
  role: MessageRole;
  content: string;
}

export interface MultimodalMessage {
  role: MessageRole;
  content: ContentPart[];
}

export interface ContentPart {
  type: "text" | "image_url" | "video_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "high" | "low";
  };
  video_url?: {
    url: string;
    fps?: number | null;
  };
}

export type ChatMessage = TextMessage | MultimodalMessage;

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  provider?: LLMProvider;
}

export interface LLMConfigOptions {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeoutMs?: number;
  enableThinking?: boolean;
}

type ChatCompletionRequestBody = {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
};

export interface ProviderConfig {
  baseURL: string;
  defaultModel: string;
  models: string[];
  envKey: string;
}

export const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig> = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini", "o1-preview"],
    envKey: "OPENAI_API_KEY",
  },
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    envKey: "DEEPSEEK_API_KEY",
  },
  zhipu: {
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    models: ["glm-4-plus", "glm-4-flash", "glm-4-air", "glm-4-long", "glm-4v-plus"],
    envKey: "ZHIPU_API_KEY",
  },
  kimi: {
    baseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    envKey: "KIMI_API_KEY",
  },
  qwen: {
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-turbo",
    models: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-max-longcontext", "qwen-vl-plus", "qwen-vl-max"],
    envKey: "QWEN_API_KEY",
  },
  siliconflow: {
    baseURL: "https://api.siliconflow.cn/v1",
    defaultModel: "Qwen/Qwen2.5-7B-Instruct",
    models: [
      "Qwen/Qwen2.5-7B-Instruct",
      "Qwen/Qwen2.5-72B-Instruct",
      "deepseek-ai/DeepSeek-V2.5",
      "THUDM/glm-4-9b-chat",
    ],
    envKey: "SILICONFLOW_API_KEY",
  },
  doubao: {
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-seed-1-8-251228",
    models: [
      "doubao-seed-1-8-251228",
      "doubao-seed-2-0-pro-260215",
      "doubao-seed-2-0-lite-260215",
      "doubao-seed-1-6-vision-250815",
    ],
    envKey: "DOUBAO_API_KEY",
  },
  custom: {
    baseURL: "",
    defaultModel: "",
    models: [],
    envKey: "LLM_API_KEY",
  },
};

function buildLLMErrorMessage(input: {
  provider: LLMProvider;
  status: number;
  rawError: string;
  model: string;
  baseURL: string;
}) {
  let providerMessage = input.rawError;
  let errorCode = "";

  try {
    const parsed = JSON.parse(input.rawError) as {
      error?: { code?: string; message?: string; type?: string };
      message?: string;
    };
    providerMessage = parsed.error?.message || parsed.message || input.rawError;
    errorCode = parsed.error?.code || "";
  } catch {
    // Keep the raw provider text when the response is not JSON.
  }

  const hints: string[] = [];
  if (errorCode === "model_not_found" || /model[_ -]?not[_ -]?found/i.test(providerMessage)) {
    hints.push(`当前模型 "${input.model}" 在这个接口下不可用，请到服务商后台复制精确模型名。`);
    if (/^gpt\d/i.test(input.model)) {
      hints.push("OpenAI 风格模型名通常需要连字符，例如 gpt-4o-mini。");
    }
    if (input.provider === "custom") {
      hints.push("自定义接口不会自动发现模型列表，Base URL、API Key 和模型名必须和网关渠道配置完全匹配。");
    }
  }

  return [
    `LLM API Error (${input.provider}): ${input.status}`,
    `模型：${input.model}`,
    `接口：${input.baseURL}`,
    `服务商返回：${providerMessage}`,
    ...hints.map((hint) => `建议：${hint}`),
  ].join("\n");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = Number(process.env.LLM_REQUEST_TIMEOUT_MS || 30000)
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`LLM request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function isProviderConfigured(provider: LLMProvider): boolean {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) return false;

  const key = process.env[config.envKey] || (provider === "deepseek" ? process.env.LLM_API_KEY : undefined);
  return !!key && key.length > 0;
}

export function getConfiguredProviders(): LLMProvider[] {
  return Object.keys(PROVIDER_CONFIGS).filter((provider) =>
    isProviderConfigured(provider as LLMProvider)
  ) as LLMProvider[];
}

export function getProviderModels(provider: LLMProvider): string[] {
  return PROVIDER_CONFIGS[provider]?.models || [];
}

export function getAllAvailableModels(): Array<{ provider: LLMProvider; models: string[]; configured: boolean }> {
  return Object.entries(PROVIDER_CONFIGS).map(([provider, config]) => ({
    provider: provider as LLMProvider,
    models: config.models,
    configured: isProviderConfigured(provider as LLMProvider),
  }));
}

function getProviderApiKey(provider: LLMProvider): string {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const apiKey = process.env[config.envKey] || process.env.LLM_API_KEY || "";

  if (!apiKey) {
    throw new Error(`请在 .env.local 中配置 ${config.envKey} 或 LLM_API_KEY。`);
  }

  return apiKey;
}

function getProviderBaseURL(provider: LLMProvider): string {
  const config = PROVIDER_CONFIGS[provider];
  const providerBaseURL = process.env[`${provider.toUpperCase()}_BASE_URL`];
  if (providerBaseURL) return providerBaseURL;
  if (process.env.LLM_BASE_URL) return process.env.LLM_BASE_URL;
  return config?.baseURL || "";
}

export class LLMClient {
  private defaultProvider: LLMProvider;
  private defaultModel: string;

  constructor(options?: { provider?: LLMProvider; model?: string; userId?: string }) {
    const envProvider = process.env.LLM_PROVIDER as LLMProvider;

    if (options?.provider) {
      this.defaultProvider = options.provider;
    } else if (envProvider && PROVIDER_CONFIGS[envProvider]) {
      this.defaultProvider = envProvider;
    } else {
      const configured = getConfiguredProviders();
      this.defaultProvider = configured.length > 0 ? configured[0] : "deepseek";
    }

    this.defaultModel =
      options?.model || process.env.LLM_MODEL || PROVIDER_CONFIGS[this.defaultProvider]?.defaultModel || "deepseek-chat";
  }

  async invoke(messages: ChatMessage[], options?: LLMConfigOptions): Promise<LLMResponse> {
    const provider = options?.provider || this.defaultProvider;
    const model = options?.model || this.defaultModel;
    const apiKey = getProviderApiKey(provider);
    const baseURL = getProviderBaseURL(provider);
    const configuredMaxTokens = Number(process.env.LLM_MAX_TOKENS || 4096);
    const requestedMaxTokens = options?.maxTokens ? Number(options.maxTokens) : undefined;
    const maxTokens = requestedMaxTokens ? Math.min(requestedMaxTokens, configuredMaxTokens) : configuredMaxTokens;

    const requestBody: ChatCompletionRequestBody = {
      model,
      messages,
      temperature: options?.temperature ?? Number(process.env.LLM_TEMPERATURE ?? 0.7),
      max_tokens: maxTokens,
    };

    if (options?.enableThinking || model.includes("reasoner")) {
      delete requestBody.max_tokens;
    }

    if (options?.topP) requestBody.top_p = options.topP;

    const response = await fetchWithTimeout(
      `${baseURL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
      options?.timeoutMs
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(buildLLMErrorMessage({ provider, status: response.status, rawError: error, model, baseURL }));
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || "",
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      model,
      provider,
    };
  }

  async *stream(messages: ChatMessage[], options?: LLMConfigOptions): AsyncGenerator<string, void, unknown> {
    const provider = options?.provider || this.defaultProvider;
    const model = options?.model || this.defaultModel;
    const apiKey = getProviderApiKey(provider);
    const baseURL = getProviderBaseURL(provider);

    const requestBody: ChatCompletionRequestBody = {
      model,
      messages,
      stream: true,
      temperature: options?.temperature ?? Number(process.env.LLM_TEMPERATURE ?? 0.7),
    };

    const response = await fetchWithTimeout(
      `${baseURL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
      options?.timeoutMs
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(buildLLMErrorMessage({ provider, status: response.status, rawError: error, model, baseURL }));
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Response body is not readable");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Ignore malformed stream fragments.
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

let globalClient: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!globalClient) {
    globalClient = new LLMClient();
  }
  return globalClient;
}

export function createLLMClient(options?: { provider?: LLMProvider; model?: string; userId?: string }): LLMClient {
  return new LLMClient(options);
}

export function createStreamingResponse(stream: AsyncGenerator<string>, format: "text" | "sse" = "sse"): Response {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const data = format === "sse" ? `data: ${JSON.stringify({ content: chunk })}\n\n` : chunk;
          controller.enqueue(encoder.encode(data));
        }

        if (format === "sse") {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": format === "sse" ? "text/event-stream" : "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export function checkLLMConfig(): {
  configured: boolean;
  providers: Array<{ name: LLMProvider; configured: boolean }>;
  defaultProvider: LLMProvider;
  recommendations: string[];
} {
  const providers = Object.keys(PROVIDER_CONFIGS).map((name) => ({
    name: name as LLMProvider,
    configured: isProviderConfigured(name as LLMProvider),
  }));

  const configured = providers.some((provider) => provider.configured);
  const recommendations: string[] = [];

  if (!configured) {
    recommendations.push("请在 .env.local 文件中配置至少一个 LLM 提供商的 API Key。");
    recommendations.push("例如：DEEPSEEK_API_KEY=sk-xxx，或使用通用 LLM_API_KEY。");
  }

  return {
    configured,
    providers,
    defaultProvider: (process.env.LLM_PROVIDER as LLMProvider) || "deepseek",
    recommendations,
  };
}
