/**
 * LangChain ChatOpenAI 适配层
 * 复用现有 llm-provider.ts 的多提供商配置，返回 LangChain ChatOpenAI 实例
 */

import { ChatOpenAI } from "@langchain/openai";
import {
  type LLMProvider,
  PROVIDER_CONFIGS,
  getConfiguredProviders,
} from "@/lib/llm-provider";

export async function getChatModel(options?: {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  streaming?: boolean;
  userId?: string;
}): Promise<ChatOpenAI> {
  // 按优先级确定提供商
  const envProvider = process.env.LLM_PROVIDER as LLMProvider | undefined;
  let provider: LLMProvider;

  if (options?.provider && PROVIDER_CONFIGS[options.provider]) {
    provider = options.provider;
  } else if (envProvider && PROVIDER_CONFIGS[envProvider]) {
    provider = envProvider;
  } else {
    const configured = getConfiguredProviders();
    provider = configured.length > 0 ? configured[0] : "openai";
  }

  const config = PROVIDER_CONFIGS[provider];
  const model =
    options?.model || process.env.LLM_MODEL || config.defaultModel;

  const apiKey =
    process.env[config.envKey] || process.env.LLM_API_KEY || "";

  const baseURL =
    process.env[`${provider.toUpperCase()}_BASE_URL`] ||
    process.env.LLM_BASE_URL ||
    config.baseURL;

  return new ChatOpenAI({
    model,
    temperature: options?.temperature ?? 0.3,
    streaming: options?.streaming ?? true,
    apiKey,
    configuration: { baseURL },
  });
}
