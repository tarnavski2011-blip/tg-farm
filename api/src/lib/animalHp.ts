// Animal health is independent from production cycles and feeding.
// One 3-hour period costs 5 HP, regardless of animal type.
export const HP_PERIOD_MS = 3 * 60 * 60 * 1000;
export function getCurrentHp(
  animal: { hp: number | null; hpUpdatedAt: Date },
  at = new Date(),
): number {
  const initial = Math.max(0, Math.min(100, Math.floor(animal.hp ?? 100)));
  const elapsed = Math.max(
    0,
    at.getTime() - new Date(animal.hpUpdatedAt).getTime(),
  );
  return Math.max(0, initial - Math.floor(elapsed / HP_PERIOD_MS) * 5);
}
