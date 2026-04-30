import { inflateRawSync } from "node:zlib";

type ZipEntry = {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);

  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  throw new Error("DOCX 文件结构无效：未找到 ZIP 中央目录");
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];

  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("DOCX 文件结构无效：中央目录损坏");
    }

    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf-8", offset + 46, offset + 46 + fileNameLength);

    entries.push({
      name,
      compression,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`DOCX 文件结构无效：无法读取 ${entry.name}`);
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compression === 0) {
    return compressed.toString("utf-8");
  }

  if (entry.compression === 8) {
    const inflated = inflateRawSync(compressed);
    if (entry.uncompressedSize > 0 && inflated.length !== entry.uncompressedSize) {
      return inflated.toString("utf-8");
    }
    return inflated.toString("utf-8");
  }

  throw new Error(`DOCX 文件使用了暂不支持的压缩方式：${entry.compression}`);
}

function decodeXmlEntities(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function xmlTextToPlainText(xml: string) {
  return xml
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<w:br\s*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => decodeXmlEntities(line).replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function isDocxFile(fileName: string, mimeType?: string | null) {
  const lowerName = fileName.toLowerCase();
  return (
    lowerName.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function isLegacyDocFile(fileName: string, mimeType?: string | null) {
  const lowerName = fileName.toLowerCase();
  return lowerName.endsWith(".doc") || mimeType === "application/msword";
}

export function parseDocx(buffer: Buffer): string {
  const entries = readZipEntries(buffer);
  const wantedNames = [
    "word/document.xml",
    "word/footnotes.xml",
    "word/endnotes.xml",
  ];

  const parts = wantedNames
    .map((name) => entries.find((entry) => entry.name === name))
    .filter((entry): entry is ZipEntry => Boolean(entry))
    .map((entry) => xmlTextToPlainText(readZipEntry(buffer, entry)))
    .filter(Boolean);

  const text = parts.join("\n\n").trim();
  if (!text) {
    throw new Error("DOCX 文件中没有提取到可读文本");
  }

  return text;
}
