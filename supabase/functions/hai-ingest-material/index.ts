import {
  assertHaiAccess,
  estimateTokens,
  handleCors,
  HttpError,
  jsonResponse,
  requireUser,
} from "../_shared/hai.ts";

type MaterialRow = {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  mime_type: string | null;
  storage_path: string;
  kind: string;
  status: string;
};

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  const startedAt = Date.now();
  let materialId = "";
  try {
    if (request.method !== "POST") throw new HttpError(405, "只支持 POST。");
    const auth = await requireUser(request);
    await assertHaiAccess(auth.userClient);

    const body = await request.json().catch(() => ({}));
    materialId = String(body.materialId || "").trim();
    if (!materialId) throw new HttpError(400, "缺少 materialId。");

    const { data: material, error: materialError } = await auth.admin
      .from("hai_materials")
      .select("*")
      .eq("id", materialId)
      .eq("user_id", auth.user.id)
      .single();
    if (materialError || !material) throw new HttpError(404, "素材不存在。");
    const row = material as MaterialRow;

    await auth.admin
      .from("hai_materials")
      .update({ status: "processing", error_message: null })
      .eq("id", row.id);

    const { data: blob, error: downloadError } = await auth.admin.storage
      .from("hai-user-materials")
      .download(row.storage_path);
    if (downloadError || !blob) throw new HttpError(500, downloadError?.message || "素材下载失败。");

    const parsed = await parseMaterial(blob, row);
    const chunks = chunkText(parsed.text, {
      title: row.title,
      parser: parsed.parser,
      mime_type: parsed.mimeType,
      file_name: row.file_name,
      material_kind: row.kind,
    });
    if (chunks.length === 0) throw new HttpError(422, "没有提取到可入库文本。");

    await auth.admin
      .from("hai_material_chunks")
      .delete()
      .eq("material_id", row.id)
      .eq("user_id", auth.user.id);

    const { error: insertError } = await auth.admin.from("hai_material_chunks").insert(
      chunks.map((chunk, index) => ({
        material_id: row.id,
        user_id: auth.user.id,
        chunk_index: index,
        content: chunk.content,
        token_count: estimateTokens(chunk.content),
        metadata: chunk.metadata,
        embedding: null,
      })),
    );
    if (insertError) throw new HttpError(500, insertError.message);

    await auth.admin
      .from("hai_materials")
      .update({ status: "processed_no_embedding", error_message: null })
      .eq("id", row.id);

    await auth.admin.from("hai_usage_events").insert({
      user_id: auth.user.id,
      event_type: "hai.material.ingested",
      route: "hai-ingest-material",
      status: "completed",
      entity_type: "material",
      entity_id: row.id,
      input_tokens: estimateTokens(parsed.text),
      output_tokens: 0,
      total_tokens: estimateTokens(parsed.text),
      duration_ms: Date.now() - startedAt,
      metadata: {
        chunks: chunks.length,
        parser: parsed.parser,
        mime_type: parsed.mimeType,
      },
    });

    return jsonResponse({
      materialId: row.id,
      status: "processed_no_embedding",
      chunks: chunks.length,
      parser: parsed.parser,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "素材解析失败。";
    try {
      const auth = await requireUser(request);
      if (materialId) {
        await auth.admin
          .from("hai_materials")
          .update({ status: "failed", error_message: message })
          .eq("id", materialId)
          .eq("user_id", auth.user.id);
      }
    } catch {
      // Ignore secondary failure updates.
    }
    return jsonResponse({ message }, status);
  }
});

async function parseMaterial(blob: Blob, material: MaterialRow): Promise<{
  text: string;
  parser: string;
  mimeType: string;
}> {
  const mimeType = normalizeMimeType(material.mime_type || blob.type, material.file_name);
  const buffer = await blob.arrayBuffer();

  if (isTextLike(mimeType, material.file_name)) {
    const raw = new TextDecoder().decode(buffer);
    const text = mimeType === "text/html" ? stripMarkup(raw) : raw.trim();
    return { text, parser: "direct-text", mimeType };
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("npm:mammoth@1.8.0");
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return { text: String(result.value || "").trim(), parser: "mammoth", mimeType };
  }

  if (mimeType === "application/pdf") {
    const { getDocument } = await import("npm:pdfjs-dist@4.9.124");
    const doc = await getDocument({ data: buffer, disableFontFace: true }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: unknown) => {
          if (typeof item === "object" && item && "str" in item) {
            return String((item as { str: string }).str);
          }
          return "";
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) pages.push(`## 第 ${pageNumber} 页\n${pageText}`);
    }
    const text = pages.join("\n\n").trim();
    if (!text) {
      throw new HttpError(422, "该 PDF 没有可提取文本层；扫描件 OCR 将在后续接入。");
    }
    return { text, parser: "pdfjs", mimeType };
  }

  throw new HttpError(422, `暂不支持该文件类型：${mimeType}。当前支持文本、Markdown、HTML、JSON、CSV、DOCX 和文字型 PDF。`);
}

function normalizeMimeType(mimeType: string, fileName: string) {
  const lower = mimeType.toLowerCase();
  if (lower && lower !== "application/octet-stream") return lower;
  const name = fileName.toLowerCase();
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "text/markdown";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".html") || name.endsWith(".htm")) return "text/html";
  if (name.endsWith(".json")) return "application/json";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".pdf")) return "application/pdf";
  return lower || "application/octet-stream";
}

function isTextLike(mimeType: string, fileName: string) {
  const name = fileName.toLowerCase();
  return mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".json");
}

function stripMarkup(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string, baseMetadata: Record<string, unknown>) {
  const clean = text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const size = 1700;
  const overlap = 160;
  const chunks: Array<{ content: string; metadata: Record<string, unknown> }> = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(clean.length, start + size);
    const content = clean.slice(start, end).trim();
    if (content) {
      chunks.push({
        content,
        metadata: {
          ...baseMetadata,
          chunk_level: "section",
          char_start: start,
          char_end: end,
        },
      });
    }
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

