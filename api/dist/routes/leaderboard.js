"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    const top = await prisma_1.prisma.user.findMany({
        orderBy: {
            coins: "desc",
        },
        take: 20,
        select: {
            telegramId: true,
            coins: true,
            level: true,
        },
    });
    res.json(top);
});
exports.default = router;
