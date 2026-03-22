"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    console.log("TELEGRAM ROUTER UPDATE:", req.body);
    res.sendStatus(200);
});
router.get("/", (_req, res) => {
    res.send("telegram webhook ok");
});
exports.default = router;
