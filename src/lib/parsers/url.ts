import * as cheerio from "cheerio";

interface FetchResult {
  title: string;
  text: string;
}

/**
 * 抓取网页内容并提取纯文本
 * 注意：只支持静态 HTML，动态渲染的 SPA 页面可能内容不完整
 */
export async function fetchUrlContent(url: string): Promise<FetchResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // 移除无关节点
  $("script, style, nav, footer, header, aside, .ad, iframe, noscript").remove();

  const title =
    $("title").text().trim() || $("h1").first().text().trim() || "从URL导入";

  // 提取正文，压缩空白
  const text = $("body").text().replace(/\s+/g, " ").trim();

  return { title, text };
}
