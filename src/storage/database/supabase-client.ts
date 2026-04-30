import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

let envLoaded = false;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
  serviceKey?: string;
}

function loadEnv(): void {
  if (envLoaded || (getSupabaseUrl() && getSupabaseAnonKey())) {
    return;
  }

  try {
    // 尝试加载 .env.local 文件
    config({ path: resolve(process.cwd(), '.env.local') });
    config({ path: resolve(process.cwd(), '.env') });
    
    envLoaded = true;
  } catch {
    // Silently fail
  }
}

/**
 * 获取 Supabase URL
 * 支持两种环境变量名：SUPABASE_URL 或 COZE_SUPABASE_URL
 */
function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.COZE_SUPABASE_URL;
}

/**
 * 获取 Supabase Anon Key
 * 支持两种环境变量名：SUPABASE_ANON_KEY 或 COZE_SUPABASE_ANON_KEY
 */
function getSupabaseAnonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY;
}

/**
 * 获取 Supabase Service Key
 * 支持两种环境变量名：SUPABASE_SERVICE_KEY 或 COZE_SUPABASE_SERVICE_KEY
 */
function getSupabaseServiceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_KEY || process.env.COZE_SUPABASE_SERVICE_KEY;
}

function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url) {
    throw new Error(
      'SUPABASE_URL is not set. Please create .env.local file with your Supabase credentials.\n' +
      'Example:\n' +
      '  SUPABASE_URL=https://your-project.supabase.co\n' +
      '  SUPABASE_ANON_KEY=your-anon-key\n' +
      '  SUPABASE_SERVICE_KEY=your-service-key'
    );
  }
  if (!anonKey) {
    throw new Error(
      'SUPABASE_ANON_KEY is not set. Please create .env.local file with your Supabase credentials.\n' +
      'Example:\n' +
      '  SUPABASE_URL=https://your-project.supabase.co\n' +
      '  SUPABASE_ANON_KEY=your-anon-key\n' +
      '  SUPABASE_SERVICE_KEY=your-service-key'
    );
  }

  return { 
    url, 
    anonKey,
    serviceKey: getSupabaseServiceKey(),
  };
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  if (token) {
    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      db: {
        timeout: 60000,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return createClient(url, anonKey, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 获取 Supabase 服务端客户端（使用 service_role key，绕过 RLS）
 * 用于后台任务和管理操作
 */
function getSupabaseServiceClient(): SupabaseClient {
  loadEnv();
  
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase service credentials not configured. Please set:\n' +
      '  SUPABASE_URL=https://your-project.supabase.co\n' +
      '  SUPABASE_SERVICE_KEY=your-service-key'
    );
  }

  return createClient(url, serviceKey, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 优先使用 service_role key（绕过 RLS），降级到 anon key
 * 用于所有 API 路由，避免未配置 SUPABASE_SERVICE_KEY 时抛出异常
 */
function getApiClient(): SupabaseClient {
  try {
    return getSupabaseServiceClient();
  } catch {
    return getSupabaseClient();
  }
}

export {
  loadEnv,
  getSupabaseCredentials,
  getSupabaseClient,
  getSupabaseServiceClient,
  getApiClient,
  getSupabaseUrl,
  getSupabaseAnonKey,
  getSupabaseServiceKey,
};
