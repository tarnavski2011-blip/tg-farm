import { PrismaClient } from "@prisma/client";

// Один PrismaClient на процес (норма для dev/малих проектів)
export const prisma = new PrismaClient();
