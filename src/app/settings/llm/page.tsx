"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Save, SlidersHorizontal, TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type ProviderKey = "openai" | "deepseek" | "zhipu" | "kimi" | "qwen" | "siliconflow" | "doubao" | "custom";

type ProviderDefaults = Record<ProviderKey, {
  baseURL: string;
  defaultModel: string;
  models: string[];
}>;

type LlmConfigResponse = {
  success: boolean;
  data?: {
    providerDefaults: ProviderDefaults;
    userConfig?: {
      provider: ProviderKey;
      model: string;
      baseURL: string;
      apiKeyConfigured: boolean;
      apiKeyMasked: string;
      temperature: number;
      maxTokens: number;
      enabled: boolean;
    } | null;
  };
};

const providerLabels: Record<ProviderKey, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  zhipu: "智谱 GLM",
  kimi: "Kimi",
  qwen: "通义千问",
  siliconflow: "SiliconFlow",
  doubao: "豆包",
  custom: "自定义兼容接口",
};

export default function LlmSettingsPage() {
  const [providerDefaults, setProviderDefaults] = useState<ProviderDefaults | null>(null);
  const [provider, setProvider] = useState<ProviderKey>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [baseURL, setBaseURL] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [enabled, setEnabled] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [testResult, setTestResult] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/config/llm");
        const data = (await response.json()) as LlmConfigResponse;
        const defaults = data.data?.providerDefaults || null;
        setProviderDefaults(defaults);

        const config = data.data?.userConfig;
        if (config) {
          setProvider(config.provider);
          setModel(config.model);
          setBaseURL(config.baseURL);
          setApiKeyMasked(config.apiKeyMasked);
          setTemperature(config.temperature);
          setMaxTokens(config.maxTokens);
          setEnabled(config.enabled);
        } else if (defaults?.openai) {
          setProvider("openai");
          setModel(defaults.openai.defaultModel);
          setBaseURL(defaults.openai.baseURL);
        }
      } catch (error) {
        console.error("Error loading LLM settings:", error);
        setMessage("加载模型配置失败");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const models = useMemo(() => providerDefaults?.[provider]?.models || [], [provider, providerDefaults]);

  const handleProviderChange = (value: string) => {
    const nextProvider = value as ProviderKey;
    setProvider(nextProvider);
    const defaults = providerDefaults?.[nextProvider];
    if (defaults) {
      setModel(defaults.defaultModel || "");
      setBaseURL(defaults.baseURL || "");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    setTestResult("");
    try {
      const response = await fetch("/api/config/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          baseURL,
          apiKey: apiKey.trim() || undefined,
          temperature,
          maxTokens,
          enabled,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(typeof data.error === "string" ? data.error : "保存失败，请检查配置");
        return;
      }
      setApiKey("");
      setApiKeyMasked(data.data?.apiKeyMasked || "");
      setMessage("模型配置已保存");
    } catch (error) {
      console.error("Error saving LLM settings:", error);
      setMessage("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage("");
    setTestResult("");
    try {
      const response = await fetch("/api/config/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "请用一句中文回复：模型配置测试成功。" }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setMessage(data.error || "模型测试失败");
        return;
      }
      setTestResult(data.data?.content || "模型配置测试成功");
    } catch (error) {
      console.error("Error testing LLM settings:", error);
      setMessage("模型测试失败，请稍后重试");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-slate-950">
      <header className="border-b border-slate-950/10 bg-[#fbf7ef]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 md:px-8">
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回工作台
            </Link>
          </Button>
          <Badge className="bg-slate-950 text-white hover:bg-slate-950">
            模型配置
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 md:px-8">
        <section className="rounded-2xl border border-slate-950/10 bg-white/80 p-6 shadow-sm md:p-8">
          <Badge className="mb-4 bg-[#f7c76b] text-slate-950 hover:bg-[#f7c76b]">
            BYOK
          </Badge>
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            使用自己的模型 API。
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            支持 OpenAI 兼容接口。你可以配置自己的 API Key、Base URL 和模型名，之后 AI 总结、测验、学习路径和图片理解会优先使用这套配置。
          </p>
        </section>

        <Card className="border-slate-950/10 bg-white/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              API 设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在加载配置...
              </div>
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>服务商</Label>
                    <Select value={provider} onValueChange={handleProviderChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(providerLabels) as ProviderKey[]).map((key) => (
                          <SelectItem key={key} value={key}>
                            {providerLabels[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>模型名</Label>
                    {models.length > 0 && provider !== "custom" ? (
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择模型" />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="例如 gpt-4o-mini" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input
                    value={baseURL}
                    onChange={(event) => setBaseURL(event.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={apiKeyMasked ? `已保存：${apiKeyMasked}，留空则不修改` : "sk-..."}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowKey((value) => !value)}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Temperature</Label>
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={temperature}
                      onChange={(event) => setTemperature(Number(event.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      min={256}
                      max={32000}
                      step={256}
                      value={maxTokens}
                      onChange={(event) => setMaxTokens(Number(event.target.value))}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-950/10 bg-slate-50 p-4">
                  <div>
                    <p className="font-bold">启用用户模型配置</p>
                    <p className="mt-1 text-sm text-slate-500">关闭后会回退到服务器 `.env.local` 中的默认配置。</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                {message && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    {message}
                  </div>
                )}
                {testResult && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <div className="mb-1 flex items-center gap-2 font-bold">
                      <CheckCircle2 className="h-4 w-4" />
                      测试成功
                    </div>
                    {testResult}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleSave} disabled={saving} className="bg-slate-950 text-white hover:bg-slate-800">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    保存配置
                  </Button>
                  <Button onClick={handleTest} disabled={testing || saving} variant="outline">
                    {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube2 className="mr-2 h-4 w-4" />}
                    测试连接
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
