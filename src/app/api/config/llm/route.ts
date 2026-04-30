import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { getApiClient } from "@/storage/database/supabase-client";
import {
  checkLLMConfig,
  createLLMClient,
  getAllAvailableModels,
  type LLMProvider,
  PROVIDER_CONFIGS,
} from "@/lib/llm-provider";

const llmConfigSchema = z.object({
  provider: z.enum(["openai", "deepseek", "zhipu", "kimi", "qwen", "siliconflow", "doubao", "custom"]),
  model: z.string().min(1, "模型名不能为空").max(200),
  baseURL: z.string().url("Base URL 必须是有效 URL").optional().or(z.literal("")),
  apiKey: z.string().min(1, "API Key 不能为空").optional(),
  temperature: z.coerce.number().min(0).max(2).default(0.3),
  maxTokens: z.coerce.number().int().min(256).max(32000).default(4096),
  enabled: z.boolean().default(true),
});

function maskKey(value?: string | null) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    const config = checkLLMConfig();
    const allModels = getAllAvailableModels();

    let userConfig = null;
    if (user) {
      const client = getApiClient();
      const { data } = await client
        .from("user_llm_configs")
        .select("provider, model, base_url, api_key, temperature, max_tokens, enabled, updated_at")
        .eq("user_id", user.id)
        .single();

      if (data) {
        userConfig = {
          provider: data.provider,
          model: data.model,
          baseURL: data.base_url || "",
          apiKeyConfigured: Boolean(data.api_key),
          apiKeyMasked: maskKey(data.api_key),
          temperature: Number(data.temperature ?? 0.3),
          maxTokens: Number(data.max_tokens ?? 4096),
          enabled: Boolean(data.enabled),
          updatedAt: data.updated_at,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        configured: Boolean(userConfig?.apiKeyConfigured) || config.configured,
        defaultProvider: userConfig?.provider || config.defaultProvider,
        providers: config.providers,
        availableModels: allModels,
        providerDefaults: PROVIDER_CONFIGS,
        userConfig,
        recommendations: config.recommendations,
      },
    });
  } catch (error) {
    console.error("Error checking LLM config:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check LLM configuration" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = llmConfigSchema.parse(body);
    const client = getApiClient();

    const { data: existing } = await client
      .from("user_llm_configs")
      .select("api_key")
      .eq("user_id", user.id)
      .single();

    const apiKey = parsed.apiKey?.trim() || existing?.api_key || "";
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "API Key 不能为空" }, { status: 400 });
    }

    const { data, error } = await client
      .from("user_llm_configs")
      .upsert(
        {
          user_id: user.id,
          provider: parsed.provider,
          model: parsed.model.trim(),
          base_url: parsed.baseURL?.trim() || PROVIDER_CONFIGS[parsed.provider as LLMProvider]?.baseURL || "",
          api_key: apiKey,
          temperature: parsed.temperature,
          max_tokens: parsed.maxTokens,
          enabled: parsed.enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("provider, model, base_url, api_key, temperature, max_tokens, enabled, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        provider: data.provider,
        model: data.model,
        baseURL: data.base_url || "",
        apiKeyConfigured: Boolean(data.api_key),
        apiKeyMasked: maskKey(data.api_key),
        temperature: Number(data.temperature ?? 0.3),
        maxTokens: Number(data.max_tokens ?? 4096),
        enabled: Boolean(data.enabled),
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 });
    }
    console.error("Error saving LLM config:", error);
    return NextResponse.json({ success: false, error: "保存模型配置失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const client = getApiClient();
    const { data } = await client
      .from("user_llm_configs")
      .select("provider, model, base_url, api_key, temperature, max_tokens, enabled")
      .eq("user_id", user.id)
      .eq("enabled", true)
      .single();

    if (!data?.api_key) {
      return NextResponse.json({ success: false, error: "还没有配置可用的 API Key" }, { status: 400 });
    }

    const llm = createLLMClient({
      userId: user.id,
      runtimeConfig: {
        provider: data.provider as LLMProvider,
        model: data.model,
        baseURL: data.base_url,
        apiKey: data.api_key,
        temperature: data.temperature,
        maxTokens: data.max_tokens,
        enabled: data.enabled,
      },
    });

    const response = await llm.invoke(
      [
        { role: "system", content: "你是模型连通性测试助手。" },
        { role: "user", content: body.prompt || "请用一句中文回复：模型配置测试成功。" },
      ],
      { temperature: 0.1, maxTokens: 120 }
    );

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("Error testing LLM config:", error);
    const message = error instanceof Error ? error.message : "模型测试失败";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
