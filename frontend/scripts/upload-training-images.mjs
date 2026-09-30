import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imageDirectory = path.join(projectRoot, "public", "training-images");
const shouldApply = process.argv.includes("--apply");

const assets = [
  ["L1-식사-001", "L1-meal-001.png"],
  ["L2-식사-001", "L2-meal-001.png"],
  ["L3-식사-001", "L3-meal-001.png"],
  ["L1-집안-001", "L1-home-001.png"],
  ["L2-집안-001", "L2-home-001.png"],
  ["L3-집안-001", "L3-home-001.png"],
  ["L1-건강-001", "L1-health-001.png"],
  ["L2-건강-001", "L2-health-001.png"],
  ["L3-건강-001", "L3-health-001.png"],
  ["L1-이동-001", "L1-mobility-001.png"],
  ["L2-이동-001", "L2-mobility-001.png"],
  ["L3-이동-001", "L3-mobility-001.png"],
  ["L1-쇼핑-001", "L1-shopping-001.png"],
  ["L2-쇼핑-001", "L2-shopping-001.png"],
  ["L3-쇼핑-001", "L3-shopping-001.png"],
  ["L1-여가-001", "L1-leisure-001.png"],
  ["L2-여가-001", "L2-leisure-001.png"],
  ["L3-여가-001", "L3-leisure-001.png"],
];

const missingFiles = assets.filter(([, fileName]) => !existsSync(path.join(imageDirectory, fileName)));
if (missingFiles.length > 0) {
  throw new Error(`누락된 이미지: ${missingFiles.map(([, fileName]) => fileName).join(", ")}`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error(".env의 Supabase URL과 service role key를 확인해주세요.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const titles = assets.map(([title]) => title);
const { data: contents, error: contentError } = await supabase
  .from("training_contents")
  .select("id,title")
  .in("title", titles);
if (contentError) throw contentError;

const contentByTitle = new Map((contents ?? []).map((content) => [content.title, content]));
const missingContents = titles.filter((title) => !contentByTitle.has(title));
if (missingContents.length > 0) {
  throw new Error(
    `Supabase에 없는 콘텐츠: ${missingContents.join(", ")}\n먼저 202609280003_initial_training_content_drafts.sql을 실행해주세요.`,
  );
}

console.log(`이미지 ${assets.length}개와 콘텐츠 ${contents.length}개를 확인했습니다.`);
if (!shouldApply) {
  console.log("검사만 완료했습니다. 실제 업로드는 명령 끝에 -- --apply를 붙여 실행하세요.");
  process.exit(0);
}

for (const [title, fileName] of assets) {
  const storagePath = `mvp-v1/${fileName}`;
  const bytes = await readFile(path.join(imageDirectory, fileName));
  const { error: uploadError } = await supabase.storage
    .from("content-images")
    .upload(storagePath, bytes, { contentType: "image/png", upsert: true });
  if (uploadError) throw new Error(`${fileName} 업로드 실패: ${uploadError.message}`);

  const content = contentByTitle.get(title);
  const { error: updateError } = await supabase
    .from("training_contents")
    .update({ image_path: storagePath, updated_at: new Date().toISOString() })
    .eq("id", content.id);
  if (updateError) throw new Error(`${title} 연결 실패: ${updateError.message}`);
  console.log(`연결 완료: ${title} -> ${storagePath}`);
}

console.log("18개 이미지의 업로드와 콘텐츠 연결을 완료했습니다.");
