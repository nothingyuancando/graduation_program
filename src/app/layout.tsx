import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/auth-context';
import { QuickCapture } from '@/components/QuickCapture';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI 个性化学习知识库',
    template: '%s | AI 个性化学习知识库',
  },
  description:
    '基于大语言模型的 AI 个性化学习知识库，支持结构化学习笔记、概念双链、复习卡片、测验反馈、薄弱点识别和学习路径生成。',
  keywords: ['AI个性化学习知识库', '学习知识库', 'AI学习助手', '知识管理', '双链笔记', '复习卡片', '学习路径'],
  authors: [{ name: 'AI 个性化学习知识库' }],
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="en">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        <AuthProvider>
          {children}
          <QuickCapture />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
