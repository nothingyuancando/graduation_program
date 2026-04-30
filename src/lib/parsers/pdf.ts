import pdfParse from "pdf-parse";

/**
 * 解析 PDF Buffer，返回提取的文本内容
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text.trim();
}
