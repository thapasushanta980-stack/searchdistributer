/** Render a topic's slides to PNG files for eyeballing: npx tsx prisma/content-preview.ts [topicId] [outDir] */
import fs from "node:fs";
import path from "node:path";
import { renderTopic } from "../src/modules/social/content/nurvexa.js";
import { getTopics } from "../src/modules/social/content/store.js";

const topic = getTopics().find((t) => t.id === process.argv[2]) ?? getTopics()[0]!;
const out = process.argv[3] ?? "content-preview";
fs.mkdirSync(out, { recursive: true });
(await renderTopic(topic)).forEach((png, i) => fs.writeFileSync(path.join(out, `${topic.id}-${i + 1}.png`), png));
console.log(`wrote ${3} slides to ${out}`);
process.exit(0);
