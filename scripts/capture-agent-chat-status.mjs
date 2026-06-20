import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");
const outPath = path.join(root, "screenshots", "works-live-browser", "22-agent-chat-status.png");

const baseUrl = "http://127.0.0.1:5000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
await page.getByLabel("邮箱").fill("rag-learner-20260517@example.com");
await page.getByLabel("密码").fill("Test123456");
await page.getByRole("button", { name: /登录|登 录/ }).click();
await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });

await page.addInitScript(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    if (url.includes("/api/chat")) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"tool_start","data":"generate_quiz"}\n\n'));
          setTimeout(() => {
            controller.enqueue(
              encoder.encode('data: {"type":"token","data":"我会先检索与RAG相关的学习笔记，并调用练习题生成工具。"}\n\n')
            );
          }, 500);
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
        },
      });
    }
    return originalFetch(input, init);
  };
});

await page.goto(`${baseUrl}/chat`, { waitUntil: "networkidle" });
const input = page.getByPlaceholder(/试试/);
await input.fill("根据RAG检索增强生成这篇笔记给我生成一套练习题");
await input.press("Enter");

await page.getByText("正在生成练习题...").waitFor({ state: "visible", timeout: 10000 });
await page.waitForTimeout(700);
await page.screenshot({ path: outPath, fullPage: false });
await browser.close();

console.log(outPath);
