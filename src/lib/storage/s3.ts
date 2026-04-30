import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface S3Config {
  endpointUrl: string;
  bucketName: string;
  region?: string;
}

export function createS3Client(config: S3Config) {
  const client = new S3Client({
    endpoint: config.endpointUrl,
    region: config.region || "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });

  return {
    /** 上传文件，返回对象 key */
    async uploadFile(params: {
      fileContent: Buffer;
      fileName: string;
      contentType: string;
    }): Promise<string> {
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: params.fileName,
        Body: params.fileContent,
        ContentType: params.contentType,
      });
      await client.send(command);
      return params.fileName;
    },

    /** 生成预签名下载 URL */
    async generatePresignedUrl(params: {
      key: string;
      expireTime: number;
    }): Promise<string> {
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: params.key,
      });
      return getSignedUrl(
        client as unknown as Parameters<typeof getSignedUrl>[0],
        command as unknown as Parameters<typeof getSignedUrl>[1],
        { expiresIn: params.expireTime }
      );
    },

    /** 下载文件内容为 Buffer */
    async downloadFile(key: string): Promise<Buffer> {
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });
      const response = await client.send(command);
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    },
  };
}

export type S3ClientInstance = ReturnType<typeof createS3Client>;
