"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HP_PERIOD_MS = void 0;
exports.getCurrentHp = getCurrentHp;
// Animal health is independent from production cycles and feeding.
// One 3-hour period costs 5 HP, regardless of animal type.
exports.HP_PERIOD_MS = 3 * 60 * 60 * 1000;
function getCurrentHp(animal, at = new Date()) {
    const initial = Math.max(0, Math.min(100, Math.floor(animal.hp ?? 100)));
    const elapsed = Math.max(0, at.getTime() - new Date(animal.hpUpdatedAt).getTime());
    return Math.max(0, initial - Math.floor(elapsed / exports.HP_PERIOD_MS) * 5);
}
