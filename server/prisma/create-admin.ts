/**
 * Creates (or resets the password of) an admin user. Credentials come from the environment so a
 * password never appears as a CLI argument or in shell history:
 *   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD=... npm run admin:create -w server
 * Optional: ADMIN_ROLE=SUPER_ADMIN (default) or MODERATOR.
 */
import { PrismaClient, type AdminRole } from "@prisma/client";
import { hashPassword } from "../src/modules/admin/auth.js";

const prisma = new PrismaClient();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "Administrator";
const role = (process.env.ADMIN_ROLE ?? "SUPER_ADMIN") as AdminRole;

if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD.");
if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
if (role !== "SUPER_ADMIN" && role !== "MODERATOR") throw new Error("ADMIN_ROLE must be SUPER_ADMIN or MODERATOR.");

const passwordHash = await hashPassword(password);
await prisma.adminUser.upsert({ where: { email }, create: { email, name, passwordHash, role }, update: { name, passwordHash, role, isActive: true } });
// A reset must end any session opened with the old password.
const admin = await prisma.adminUser.findUniqueOrThrow({ where: { email }, select: { id: true } });
await prisma.adminSession.deleteMany({ where: { adminId: admin.id } });
console.log(`Admin ready: ${email} (${role})`);
await prisma.$disconnect();
