"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.use((req, res, next) => {
    console.log("TELEGRAM HIT:", req.method, req.originalUrl);
    next();
});
router.post("/", (req, res) => {
    console.log("TELEGRAM BODY:", JSON.stringify(req.body));
    res.sendStatus(200);
});
router.get("/", (_req, res) => {
    res.send("telegram webhook ok");
});
exports.default = router;
