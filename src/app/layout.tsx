import type { Metadata } from "next";
import { AppProviders } from "@/components/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI 个性化学习笔记平台",
    template: "%s | AI 个性化学习笔记平台",
  },
  description:
    "一个以学习闭环为核心设计理念的 AI 个性化学习笔记平台，覆盖目标设定、知识摄入、深度理解、主动回忆、弱点补强和掌握度评估。",
  keywords: [
    "AI 个性化学习笔记",
    "学习闭环",
    "费曼复述",
    "主动回忆",
    "间隔重复",
    "掌握度评估",
    "知识图谱",
  ],
  authors: [{ name: "AI 个性化学习笔记平台" }],
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
