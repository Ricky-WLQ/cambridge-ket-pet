/**
 * For each GrammarTopic missing labelZh or examples, call DeepSeek to
 * generate both fields in one shot.
 *
 * Direct DeepSeek API call (not via the AI service) — labels + examples are
 * straightforward translations that don't need the agent retry loop or
 * structured-output validators.
 *
 * Idempotent — only updates rows where labelZh is empty or examples is empty.
 *
 * Loads env from BOTH apps/web/.env and services/ai/.env (DEEPSEEK_API_KEY
 * lives in the AI service env, but Prisma vars live in the web env).
 *
 * Usage:  pnpm tsx scripts/seed-grammar-glosses.ts
 */
import "dotenv/config";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Pull DEEPSEEK_API_KEY from services/ai/.env if not already in process.env.
dotenv.config({ path: path.resolve(__dirname, "../../../services/ai/.env") });

const prisma = new PrismaClient();

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

if (!DEEPSEEK_KEY) {
  throw new Error("DEEPSEEK_API_KEY env var is required");
}

interface GlossOutput {
  labelZh: string;
  examples: string[];
}

const SYSTEM = `你是一位为中国 K-12 学生编写剑桥 KET (A2) 和 PET (B1) 语法辅助资料的英语教师。
对于给定的语法主题（labelEn + spec），生成：
- labelZh: 简洁的中文主题名称（例如 "Present perfect simple" → "现在完成时"）
- examples: 3-5 句简短自然的英文例句，能很好地展示该语法点的核心用法。例句要求：
  1. 词汇全部不超过指定级别（KET=A2 / PET=B1）
  2. 内容贴近中国学生日常（学校、家庭、周末、爱好、食物、朋友等）
  3. 不使用西方文化特有的引用
  4. 句子简短自然，10-15 词

返回严格的 JSON：{"labelZh": "...", "examples": ["...", "...", ...]}`;

async function callDeepSeek(prompt: string): Promise<GlossOutput> {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek returned no content");
  const parsed = JSON.parse(content) as GlossOutput;
  if (!parsed.labelZh || !Array.isArray(parsed.examples)) {
    throw new Error(`malformed DeepSeek output: ${content.slice(0, 200)}`);
  }
  return parsed;
}

async function main() {
  const todo = await prisma.grammarTopic.findMany({
    where: { OR: [{ labelZh: "" }, { examples: { isEmpty: true } }] },
    select: { id: true, examType: true, topicId: true, labelEn: true, spec: true },
    orderBy: [{ examType: "asc" }, { topicId: "asc" }],
  });
  console.log(`[grammar/glosses] ${todo.length} topics missing labelZh or examples`);

  let updated = 0;
  let failed = 0;
  for (const t of todo) {
    const prompt = `等级: ${t.examType}\nlabelEn: ${t.labelEn}\nspec: ${t.spec}\n\n请生成 labelZh 和 examples (4 句)。`;
    try {
      console.log(`[${t.examType}/${t.topicId}] generating...`);
      const result = await callDeepSeek(prompt);
      await prisma.grammarTopic.update({
        where: { id: t.id },
        data: { labelZh: result.labelZh, examples: result.examples },
      });
      updated++;
    } catch (err) {
      console.error(`[${t.examType}/${t.topicId}] failed:`, err);
      failed++;
    }
  }
  console.log(`[grammar/glosses] DONE — updated ${updated}, failed ${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
