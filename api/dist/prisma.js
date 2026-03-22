"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Один PrismaClient на процес (норма для dev/малих проектів)
exports.prisma = new client_1.PrismaClient();
