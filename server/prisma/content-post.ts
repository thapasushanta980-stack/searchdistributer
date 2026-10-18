/** Post a Nurvexa carousel now: npx tsx prisma/content-post.ts <draft|publish> [topicId] */
import { prisma } from "../src/db.js";
import { pickNextTopic, postTopic } from "../src/modules/social/content/nurvexa.js";
import { getTopics } from "../src/modules/social/content/store.js";

const mode = process.argv[2] === "publish" ? "publish" : "draft";
const topic = getTopics().find((t) => t.id === process.argv[3]) ?? (await pickNextTopic());
console.log(`posting "${topic.id}" as ${mode}`);
const r = await postTopic(topic, mode);
console.log(JSON.stringify(r.post?.platforms ?? r, null, 1), "failed:", r.partialFailure);
await prisma.$disconnect();
process.exit(r.partialFailure ? 1 : 0);
