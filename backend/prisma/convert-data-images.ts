/**
 * One-off: move base64 `data:` images out of the database into WebP files
 * under UPLOAD_DIR (served from /api/uploads/<file>), like new uploads.
 * Lists repeat these images per row, so a 250 KB photo in the DB makes every
 * assignment of that model 250 KB heavier.
 *
 *   npm run db:convert-images -- --dry-run   # count only, change nothing
 *   npm run db:convert-images                # convert
 *
 * Back up the database first. Safe to re-run: only `data:` URLs are touched.
 */
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { toWebp, uploadDir, uploadUrl } from "../src/lib/uploads";

const db = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function saveDataUrl(dataUrl: string): Promise<string | null> {
  const match = /^data:image\/[a-z+.-]+;base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const webp = await toWebp(Buffer.from(match[1], "base64"));
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.webp`;
  await writeFile(path.join(dir, filename), webp, { flag: "wx" });
  return uploadUrl(filename);
}

async function main() {
  console.log(`Upload dir: ${uploadDir()}${dryRun ? " (dry run)" : ""}`);
  let converted = 0;
  let failed = 0;

  // Product images, a small batch at a time to keep memory low.
  const imageIds = await db.productImage.findMany({
    where: { url: { startsWith: "data:" } },
    select: { id: true },
  });
  console.log(`Product images with data URLs: ${imageIds.length}`);
  for (const { id } of dryRun ? [] : imageIds) {
    const image = await db.productImage.findUnique({
      where: { id },
      select: { url: true },
    });
    try {
      const url = image && (await saveDataUrl(image.url));
      if (!url) throw new Error("not a base64 image");
      await db.productImage.update({ where: { id }, data: { url } });
      converted++;
    } catch (error) {
      failed++;
      console.error(`ProductImage ${id}:`, (error as Error).message);
    }
  }

  const modelIds = await db.modelProfile.findMany({
    where: { photoUrl: { startsWith: "data:" } },
    select: { id: true },
  });
  console.log(`Model photos with data URLs: ${modelIds.length}`);
  for (const { id } of dryRun ? [] : modelIds) {
    const model = await db.modelProfile.findUnique({
      where: { id },
      select: { photoUrl: true },
    });
    try {
      const url = model?.photoUrl && (await saveDataUrl(model.photoUrl));
      if (!url) throw new Error("not a base64 image");
      await db.modelProfile.update({ where: { id }, data: { photoUrl: url } });
      converted++;
    } catch (error) {
      failed++;
      console.error(`ModelProfile ${id}:`, (error as Error).message);
    }
  }

  console.log(dryRun ? "Dry run, nothing changed." : `Converted ${converted}, failed ${failed}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
