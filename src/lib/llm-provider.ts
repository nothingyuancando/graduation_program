/**
 * 澶氭ā鍨?LLM 閫傞厤鍣? * 鏀寔锛歄penAI銆丏eepSeek銆佹櫤璋盇I(GLM)銆並imi銆侀€氫箟鍗冮棶銆佺鍩烘祦鍔ㄣ€佽眴鍖呯瓑
 * 
 * 浣跨敤鏂瑰紡锛? * 1. 鍦?.env.local 涓厤缃?API Key锛堣嚦灏戦厤缃竴涓級
 * 2. 璁剧疆 LLM_PROVIDER 鎸囧畾榛樿浣跨敤鐨勬ā鍨嬫彁渚涘晢
 * 3. 鎴栧湪浠ｇ爜涓€氳繃 options.model 鎸囧畾鍏蜂綋妯″瀷
 */

// ==================== 绫诲瀷瀹氫箟 ====================

/** 鏀寔鐨凩LM鎻愪緵鍟?*/
export type LLMProvider = 
  | 'openai' 
  | 'deepseek' 
  | 'zhipu' 
  | 'kimi' 
  | 'qwen'      // 閫氫箟鍗冮棶
  | 'siliconflow' 
  | 'doubao'
  | 'custom';

/** 娑堟伅瑙掕壊 */
export type MessageRole = 'system' | 'user' | 'assistant';

/** 鏂囨湰娑堟伅 */
export interface TextMessage {
  role: MessageRole;
  content: string;
}

/** 澶氭ā鎬佹秷鎭?*/
export interface MultimodalMessage {
  role: MessageRole;
  content: ContentPart[];
}

/** 鍐呭閮ㄥ垎 */
export interface ContentPart {
  type: 'text' | 'image_url' | 'video_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'high' | 'low';
  };
  video_url?: {
    url: string;
    fps?: number | null;
  };
}

/** 娑堟伅绫诲瀷 */
export type ChatMessage = TextMessage | MultimodalMessage;

/** LLM鍝嶅簲 */
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

/** LLM閰嶇疆閫夐」 */
export interface LLMConfigOptions {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  timeoutMs?: number;
  /** DeepSeek R1 绛夋€濊€冩ā鍨嬮渶瑕佸惎鐢?*/
  enableThinking?: boolean;
}

/** 鎻愪緵鍟嗛厤缃?*/

type ChatCompletionRequestBody = {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature: number;
  max_tokens?: number;
  top_p?: number;
};
export interface ProviderConfig {
  baseURL: string;
  defaultModel: string;
  models: string[];
  envKey: string;  // 鐜鍙橀噺鍚?}
}

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
    hints.push(`当前模型 "${input.model}" 在这个接口下不可用，请到服务商后台复制“精确模型名”。`);
    if (/^gpt\d/i.test(input.model)) {
      hints.push("如果你想填 OpenAI 风格模型名，通常需要连字符，例如 gpt-5.5，而不是 gpt5.5。");
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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = Number(process.env.LLM_REQUEST_TIMEOUT_MS || 30000)) {
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

// ==================== 鎻愪緵鍟嗛厤缃?====================

export const PROVIDER_CONFIGS: Record<LLMProvider, ProviderConfig> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o1-preview'],
    envKey: 'OPENAI_API_KEY',
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    envKey: 'DEEPSEEK_API_KEY',
  },
  zhipu: {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    models: ['glm-4-plus', 'glm-4-flash', 'glm-4-air', 'glm-4-long', 'glm-4v-plus'],
    envKey: 'ZHIPU_API_KEY',
  },
  kimi: {
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    envKey: 'KIMI_API_KEY',
  },
  qwen: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext', 'qwen-vl-plus', 'qwen-vl-max'],
    envKey: 'QWEN_API_KEY',
  },
  siliconflow: {
    baseURL: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    models: [
      'Qwen/Qwen2.5-7B-Instruct',
      'Qwen/Qwen2.5-72B-Instruct',
      'deepseek-ai/DeepSeek-V2.5',
      'THUDM/glm-4-9b-chat',
    ],
    envKey: 'SILICONFLOW_API_KEY',
  },
  doubao: {
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-seed-1-8-251228',
    models: [
      'doubao-seed-1-8-251228',
      'doubao-seed-2-0-pro-260215',
      'doubao-seed-2-0-lite-260215',
      'doubao-seed-1-6-vision-250815',
    ],
    envKey: 'DOUBAO_API_KEY',
  },
  custom: {
    baseURL: '',
    defaultModel: '',
    models: [],
    envKey: 'LLM_API_KEY',
  },
};

// ==================== 宸ュ叿鍑芥暟 ====================

/**
 * 妫€娴嬫彁渚涘晢鏄惁宸查厤缃瓵PI Key
 */
export function isProviderConfigured(provider: LLMProvider): boolean {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) return false;
  
  const key = process.env[config.envKey];
  return !!key && key.length > 0;
}

/**
 * 鑾峰彇宸查厤缃殑鎻愪緵鍟嗗垪琛? */
export function getConfiguredProviders(): LLMProvider[] {
  return Object.keys(PROVIDER_CONFIGS).filter(
    (provider) => isProviderConfigured(provider as LLMProvider)
  ) as LLMProvider[];
}

/**
 * 鑾峰彇鎻愪緵鍟嗙殑鍙敤妯″瀷鍒楄〃
 */
export function getProviderModels(provider: LLMProvider): string[] {
  return PROVIDER_CONFIGS[provider]?.models || [];
}

/**
 * 鑾峰彇鎵€鏈夊彲鐢ㄦā鍨? */
export function getAllAvailableModels(): Array<{ provider: LLMProvider; models: string[]; configured: boolean }> {
  return Object.entries(PROVIDER_CONFIGS).map(([provider, config]) => ({
    provider: provider as LLMProvider,
    models: config.models,
    configured: isProviderConfigured(provider as LLMProvider),
  }));
}

/**
 * 鑾峰彇鎻愪緵鍟嗙殑API Key
 */
function getProviderApiKey(provider: LLMProvider): string {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  
  // 浼樺厛浣跨敤鐗瑰畾鎻愪緵鍟嗙殑 Key锛屽叾娆′娇鐢ㄩ€氱敤 Key
  const apiKey = process.env[config.envKey] || process.env.LLM_API_KEY || '';
  
  if (!apiKey) {
    throw new Error(
      `API Key not configured for provider "${provider}". ` +
      `Please set ${config.envKey} or LLM_API_KEY in your environment variables.`
    );
  }
  
  return apiKey;
}

/**
 * 鑾峰彇鎻愪緵鍟嗙殑 Base URL
 */
function getProviderBaseURL(provider: LLMProvider): string {
  const config = PROVIDER_CONFIGS[provider];
  
  // 鏀寔鑷畾涔?Base URL
  const customBaseURL = process.env[`${provider.toUpperCase()}_BASE_URL`];
  if (customBaseURL) return customBaseURL;
  
  // 閫氱敤鑷畾涔?Base URL
  if (process.env.LLM_BASE_URL) return process.env.LLM_BASE_URL;
  
  return config?.baseURL || '';
}

// ==================== LLM 瀹㈡埛绔?====================

/**
 * 澶氭ā鍨?LLM 瀹㈡埛绔? */
export class LLMClient {
  private defaultProvider: LLMProvider;
  private defaultModel: string;

  constructor(options?: { provider?: LLMProvider; model?: string; userId?: string }) {
    // 纭畾榛樿鎻愪緵鍟?
    const envProvider = process.env.LLM_PROVIDER as LLMProvider;
    
    if (options?.provider) {
      this.defaultProvider = options.provider;
    } else if (envProvider && PROVIDER_CONFIGS[envProvider]) {
      this.defaultProvider = envProvider;
    } else {
      // 鑷姩閫夋嫨绗竴涓凡閰嶇疆鐨勬彁渚涘晢
      const configured = getConfiguredProviders();
      if (configured.length > 0) {
        this.defaultProvider = configured[0];
      } else {
        this.defaultProvider = 'openai';
      }
    }
    
    this.defaultModel = options?.model || 
      process.env.LLM_MODEL || 
      PROVIDER_CONFIGS[this.defaultProvider]?.defaultModel || 
      'gpt-4o-mini';
  }

  /**
   * 璋冪敤澶фā鍨嬶紙闈炴祦寮忥級
   */
  async invoke(
    messages: ChatMessage[],
    options?: LLMConfigOptions
  ): Promise<LLMResponse> {
    const provider = options?.provider || this.defaultProvider;
    const model = options?.model || this.defaultModel;
    
    // 楠岃瘉 API Key
    const apiKey = getProviderApiKey(provider);
    const baseURL = getProviderBaseURL(provider);
    const configuredMaxTokens = Number(process.env.LLM_MAX_TOKENS || 4096);
    const requestedMaxTokens = options?.maxTokens ? Number(options.maxTokens) : undefined;
    const maxTokens = requestedMaxTokens
      ? Math.min(requestedMaxTokens, configuredMaxTokens)
      : configuredMaxTokens;
    
    // 鏋勫缓璇锋眰
    const requestBody: ChatCompletionRequestBody = {
      model,
      messages,
      temperature: options?.temperature ?? Number(process.env.LLM_TEMPERATURE ?? 0.7),
      max_tokens: maxTokens,
    };
    
    // DeepSeek R1 绛夋€濊€冩ā鍨嬬壒娈婂鐞?
    if (options?.enableThinking || model.includes('reasoner')) {
      // 鎬濊€冩ā鍨嬩笉鏀寔鏌愪簺鍙傛暟
      delete requestBody.max_tokens;
    }
    
    // Top P
    if (options?.topP) {
      requestBody.top_p = options.topP;
    }
    
    // 鍙戦€佽姹?
    const response = await fetchWithTimeout(
      `${baseURL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
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
      content: data.choices[0]?.message?.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      model,
      provider,
    };
  }

  /**
   * 娴佸紡璋冪敤澶фā鍨?   */
  async *stream(
    messages: ChatMessage[],
    options?: LLMConfigOptions
  ): AsyncGenerator<string, void, unknown> {
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
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
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // 蹇界暐瑙ｆ瀽閿欒
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// ==================== 渚挎嵎鍑芥暟 ====================

// 鍏ㄥ眬瀹㈡埛绔疄渚?
let globalClient: LLMClient | null = null;

/**
 * 鑾峰彇鍏ㄥ眬 LLM 瀹㈡埛绔? */
export function getLLMClient(): LLMClient {
  if (!globalClient) {
    globalClient = new LLMClient();
  }
  return globalClient;
}

/**
 * 鍒涘缓鏂扮殑 LLM 瀹㈡埛绔紙鎺ㄨ崘锛? */
export function createLLMClient(options?: { provider?: LLMProvider; model?: string; userId?: string }): LLMClient {
  return new LLMClient(options);
}

/**
 * 娴佸紡鍝嶅簲鍔╂墜 - 鐢ㄤ簬 Next.js API 璺敱
 */
export function createStreamingResponse(
  stream: AsyncGenerator<string>,
  format: 'text' | 'sse' = 'sse'
): Response {
  const encoder = new TextEncoder();
  
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const data = format === 'sse' 
            ? `data: ${JSON.stringify({ content: chunk })}\n\n`
            : chunk;
          controller.enqueue(encoder.encode(data));
        }
        
        if (format === 'sse') {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
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
      'Content-Type': format === 'sse' ? 'text/event-stream' : 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ==================== 閰嶇疆妫€鏌?====================

/**
 * 妫€鏌?LLM 閰嶇疆鐘舵€? */
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
  
  const configured = providers.some(p => p.configured);
  const recommendations: string[] = [];
  
  if (!configured) {
    recommendations.push('璇峰湪 .env.local 鏂囦欢涓厤缃嚦灏戜竴涓?LLM 鎻愪緵鍟嗙殑 API Key');
    recommendations.push('渚嬪锛歄PENAI_API_KEY=sk-xxx 鎴?DEEPSEEK_API_KEY=sk-xxx');
  }
  
  return {
    configured,
    providers,
    defaultProvider: process.env.LLM_PROVIDER as LLMProvider || 'openai',
    recommendations,
  };
}

