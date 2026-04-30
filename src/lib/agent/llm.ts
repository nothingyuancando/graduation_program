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
import { getApiClient } from "@/storage/database/supabase-client";

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

  let config = PROVIDER_CONFIGS[provider];
  let model =
    options?.model || process.env.LLM_MODEL || config.defaultModel;

  let apiKey =
    process.env[config.envKey] || process.env.LLM_API_KEY || "";

  let baseURL =
    process.env[`${provider.toUpperCase()}_BASE_URL`] ||
    process.env.LLM_BASE_URL ||
    config.baseURL;

  if (options?.userId) {
    const client = getApiClient();
    const { data } = await client
      .from("user_llm_configs")
      .select("provider, model, base_url, api_key, enabled")
      .eq("user_id", options.userId)
      .eq("enabled", true)
      .single();

    if (data?.api_key) {
      provider = data.provider as LLMProvider;
      config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.custom;
      model = data.model || model;
      apiKey = data.api_key;
      baseURL = data.base_url || config.baseURL;
    }
  }

  return new ChatOpenAI({
    model,
    temperature: options?.temperature ?? 0.3,
    streaming: options?.streaming ?? true,
    openAIApiKey: apiKey,
    configuration: { baseURL },
  });
}
