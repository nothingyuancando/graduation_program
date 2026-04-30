/**
 * 环境变量工具函数
 */

/** 对象存储端点 URL */
export function getBucketEndpointUrl(): string | undefined {
  return process.env.S3_BUCKET_ENDPOINT_URL;
}

/** 存储桶名称 */
export function getBucketName(): string | undefined {
  return process.env.S3_BUCKET_NAME;
}

/** 是否已配置对象存储 */
export function isStorageConfigured(): boolean {
  return !!(getBucketEndpointUrl() && getBucketName());
}

/** 获取对象存储配置，未配置则返回 null */
export function getStorageConfig(): { endpointUrl: string; bucketName: string } | null {
  const endpointUrl = getBucketEndpointUrl();
  const bucketName = getBucketName();
  if (!endpointUrl || !bucketName) return null;
  return { endpointUrl, bucketName };
}
