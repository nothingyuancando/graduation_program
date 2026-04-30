# 智能笔记系统 - 本地部署指南

## 目录
- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [详细安装步骤](#详细安装步骤)
- [配置说明](#配置说明)
- [大模型配置](#大模型配置)
- [数据库配置](#数据库配置)
- [启动与运行](#启动与运行)
- [常见问题](#常见问题)

---

## 系统要求

### 必需环境
- **Node.js**: v18.0.0 或更高版本（推荐 v20+）
- **包管理器**: pnpm（推荐）、npm 或 yarn
- **操作系统**: Windows 10/11、macOS 10.15+、Linux

### 检查环境
```bash
# 检查 Node.js 版本
node --version

# 检查 pnpm 是否已安装
pnpm --version

# 如果没有安装 pnpm，使用以下命令安装
npm install -g pnpm
```

---

## 快速开始

### 1. 克隆项目
```bash
git clone <your-repo-url>
cd intelligent-notes
```

### 2. 安装依赖
```bash
pnpm install
```

### 3. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑 .env.local，配置至少一个 LLM API Key
```

### 4. 启动开发服务器
```bash
pnpm dev
```

### 5. 访问应用
打开浏览器访问: http://localhost:5000

---

## 详细安装步骤

### Windows 环境

#### 步骤 1: 安装 Node.js
1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 LTS 版本（推荐 v20.x）
3. 运行安装程序，按提示完成安装
4. 打开 PowerShell 验证安装：
   ```powershell
   node --version
   npm --version
   ```

#### 步骤 2: 安装 pnpm
```powershell
npm install -g pnpm
```

#### 步骤 3: 克隆项目并安装依赖
```powershell
# 克隆项目
git clone <your-repo-url>

# 进入项目目录
cd intelligent-notes

# 安装依赖
pnpm install
```

#### 步骤 4: 配置环境变量
```powershell
# 复制模板文件
copy .env.example .env.local

# 使用记事本或 VS Code 编辑
notepad .env.local
# 或
code .env.local
```

#### 步骤 5: 启动应用
```powershell
pnpm dev
```

### macOS 环境

```bash
# 安装 Homebrew（如果未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Node.js
brew install node

# 安装 pnpm
npm install -g pnpm

# 克隆项目
git clone <your-repo-url>
cd intelligent-notes

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
nano .env.local  # 或使用其他编辑器

# 启动应用
pnpm dev
```

### Linux 环境

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 安装 pnpm
npm install -g pnpm

# 克隆项目
git clone <your-repo-url>
cd intelligent-notes

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
vim .env.local

# 启动应用
pnpm dev
```

---

## 配置说明

### 环境变量文件结构

项目使用 `.env.local` 文件存储敏感配置，该文件不会被提交到 Git。

```
intelligent-notes/
├── .env.example    # 配置模板（提交到 Git）
├── .env.local      # 实际配置（不提交到 Git）
└── ...
```

### 最小配置

要运行应用，至少需要配置以下内容：

```env
# 必需：至少配置一个 LLM API Key
OPENAI_API_KEY=sk-your-key-here

# 必需：Supabase 数据库配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# 可选：对象存储配置（用于文件上传处理）
# 如不配置，文件将以Base64格式临时存储
# S3_BUCKET_ENDPOINT_URL=https://your-bucket.s3.amazonaws.com
# S3_BUCKET_NAME=your-bucket-name
```

---

## 大模型配置

本系统支持多种大语言模型，您可以配置一个或多个。

### 支持的模型提供商

| 提供商 | 配置 Key | 默认模型 | 特点 |
|--------|----------|----------|------|
| OpenAI | `OPENAI_API_KEY` | gpt-4o-mini | 综合能力强，支持多模态 |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat | 性价比高，中文友好 |
| 智谱AI | `ZHIPU_API_KEY` | glm-4-flash | 国产模型，中文优秀 |
| Kimi | `KIMI_API_KEY` | moonshot-v1-8k | 长上下文支持 |
| 通义千问 | `QWEN_API_KEY` | qwen-turbo | 阿里云，稳定可靠 |
| 硅基流动 | `SILICONFLOW_API_KEY` | Qwen/Qwen2.5-7B-Instruct | 模型丰富 |
| 豆包 | `DOUBAO_API_KEY` | doubao-seed-1-8-251228 | 字节跳动，多模态 |

### 配置示例

#### 方案一：只使用 OpenAI
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
```

#### 方案二：只使用 DeepSeek（性价比高）
```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-your-deepseek-key
```

#### 方案三：只使用通义千问
```env
LLM_PROVIDER=qwen
QWEN_API_KEY=sk-your-qwen-key
```

#### 方案四：配置多个提供商（自动选择）
```env
# 不设置 LLM_PROVIDER，系统会自动使用第一个已配置的提供商
OPENAI_API_KEY=sk-your-openai-key
DEEPSEEK_API_KEY=sk-your-deepseek-key
QWEN_API_KEY=sk-your-qwen-key
```

### 获取 API Key

#### OpenAI
1. 访问 https://platform.openai.com/
2. 注册/登录账号
3. 进入 API Keys 页面
4. 点击 "Create new secret key"
5. 复制 Key 到配置文件

#### DeepSeek
1. 访问 https://platform.deepseek.com/
2. 注册/登录账号
3. 进入 API Keys 页面
4. 创建新的 API Key
5. 复制 Key 到配置文件

#### 智谱 AI (GLM)
1. 访问 https://open.bigmodel.cn/
2. 注册/登录账号
3. 进入 API Keys 管理页面
4. 创建新的 API Key
5. 复制 Key 到配置文件

#### 通义千问
1. 访问 https://dashscope.console.aliyun.com/
2. 使用阿里云账号登录
3. 开通 DashScope 服务
4. 创建 API Key
5. 复制 Key 到配置文件

#### Kimi (月之暗面)
1. 访问 https://platform.moonshot.cn/
2. 注册/登录账号
3. 进入 API Key 管理
4. 创建新的 API Key
5. 复制 Key 到配置文件

### 高级配置

```env
# 自定义模型
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o  # 指定具体模型

# 调整温度参数（影响输出随机性，0-2）
LLM_TEMPERATURE=0.7

# 最大输出 Token 数
LLM_MAX_TOKENS=4096

# 自定义 API 端点（用于代理或私有部署）
OPENAI_BASE_URL=https://your-proxy.com/v1
```

---

## 数据库配置

本项目使用 Supabase（基于 PostgreSQL）作为数据库。

### 创建 Supabase 项目

1. 访问 https://supabase.com/
2. 点击 "Start your project"
3. 使用 GitHub 账号登录
4. 创建新组织（如果还没有）
5. 创建新项目：
   - 填写项目名称
   - 设置数据库密码（请记住此密码）
   - 选择最近的区域
6. 等待项目创建完成（约 2 分钟）

### 获取配置信息

1. 进入项目仪表板
2. 点击左侧菜单 "Settings" (齿轮图标)
3. 点击 "API"
4. 复制以下信息：
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY`（点击 "Reveal" 显示）

### 创建数据表

在 Supabase 控制台的 SQL Editor 中执行以下 SQL：

```sql
-- 上传会话表
CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL DEFAULT '未整理笔记',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文件处理队列表
CREATE TABLE IF NOT EXISTS file_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES upload_sessions(id) ON DELETE CASCADE,
  original_file_name VARCHAR(500) NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  file_key TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  extracted_text TEXT,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 笔记表
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) NOT NULL DEFAULT 'text',
  summary TEXT,
  tags JSONB,
  source_type VARCHAR(50) NOT NULL DEFAULT 'text',
  source_url TEXT,
  session_id UUID REFERENCES upload_sessions(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  themes JSONB,
  key_points JSONB,
  structure JSONB,
  entities JSONB,
  metrics JSONB,
  tasks JSONB,
  timeline JSONB,
  mind_map JSONB,
  flashcards JSONB,
  comparisons JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  parent_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS upload_sessions_status_idx ON upload_sessions(status);
CREATE INDEX IF NOT EXISTS upload_sessions_created_at_idx ON upload_sessions(created_at);
CREATE INDEX IF NOT EXISTS file_queue_session_id_idx ON file_processing_queue(session_id);
CREATE INDEX IF NOT EXISTS file_queue_status_idx ON file_processing_queue(status);
CREATE INDEX IF NOT EXISTS notes_status_idx ON notes(status);
CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes(created_at);
CREATE INDEX IF NOT EXISTS notes_session_id_idx ON notes(session_id);
```

---

## 启动与运行

### 开发模式

```bash
pnpm dev
```

应用将在 http://localhost:5000 启动，支持热更新。

### 生产模式

```bash
# 构建
pnpm build

# 启动
pnpm start
```

### 指定端口

```bash
# 开发模式
PORT=3000 pnpm dev

# 生产模式
PORT=3000 pnpm start
```

### Windows 后台运行

```powershell
# 使用 PM2 后台运行
npm install -g pm2
pm2 start pnpm --name "intelligent-notes" -- start

# 查看日志
pm2 logs intelligent-notes

# 停止服务
pm2 stop intelligent-notes
```

### Linux/macOS 后台运行

```bash
# 使用 PM2
pm2 start pnpm --name "intelligent-notes" -- start

# 或使用 nohup
nohup pnpm start > output.log 2>&1 &
```

---

## 常见问题

### Q: 启动时报错 "LLM_API_KEY is not set"

**A**: 检查 `.env.local` 文件是否正确配置了至少一个 LLM API Key。

```bash
# 验证配置文件存在
ls -la .env.local

# 检查文件内容
cat .env.local | grep API_KEY
```

### Q: 数据库连接失败

**A**: 检查 Supabase 配置是否正确：

1. 确认 SUPABASE_URL 格式正确（https://xxx.supabase.co）
2. 确认 API Keys 没有多余空格
3. 检查 Supabase 项目是否暂停（免费项目一周不活动会暂停）

### Q: 端口被占用

**A**: 更换端口或关闭占用端口的程序：

```bash
# 查找占用端口的进程（Windows）
netstat -ano | findstr :5000

# 查找占用端口的进程（Linux/macOS）
lsof -i :5000

# 使用其他端口启动
PORT=3000 pnpm dev
```

### Q: npm install 失败

**A**: 尝试以下方法：

```bash
# 清除缓存
pnpm store prune

# 删除 node_modules 重新安装
rm -rf node_modules
pnpm install

# 如果是网络问题，设置国内镜像
pnpm config set registry https://registry.npmmirror.com
```

### Q: Windows PowerShell 执行策略错误

**A**: 以管理员身份运行 PowerShell，执行：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Q: 如何更新模型

**A**: 编辑 `.env.local` 文件中的 `LLM_MODEL` 变量，或使用不同的提供商：

```env
# 使用 GPT-4o
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o

# 或使用 DeepSeek
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
```

---

## 项目结构

```
intelligent-notes/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API 路由
│   │   │   ├── config/         # 配置 API
│   │   │   ├── notes/          # 笔记 API
│   │   │   └── upload/         # 上传 API
│   │   ├── notes/              # 笔记页面
│   │   └── upload/             # 上传页面
│   ├── components/             # React 组件
│   │   └── ui/                 # shadcn/ui 组件
│   ├── lib/                    # 工具库
│   │   └── llm-provider.ts     # LLM 适配器
│   └── storage/                # 存储层
│       └── database/           # 数据库配置
├── public/                     # 静态资源
├── .env.example                # 环境变量模板
├── .env.local                  # 实际环境变量（不提交）
├── package.json                # 项目配置
└── README.md                   # 项目说明
```

---

## 技术支持

如有问题，请：
1. 查看本文档的常见问题部分
2. 检查 GitHub Issues
3. 提交新的 Issue（请附上错误日志）

---

**祝您使用愉快！** 🎉
