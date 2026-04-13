export function chipUrlForBank(bankAmount: number): string {
  if (bankAmount < 750) return "/assets/images/chip-chip.png";

  const tier = Math.floor((bankAmount - 750) / 250);

  const tierImages = [
    "/assets/images/chip-750.png",
    "/assets/images/chip-1000.png",
    "/assets/images/chip-1250.png",
    "/assets/images/chip-1500.png",
    "/assets/images/chip-1750.png",
    "/assets/images/chip-2000.png",
    "/assets/images/chip-2250.png",
  ];

  return tierImages[Math.min(tier, tierImages.length - 1)];
}

export function chipUrlForTableTotal(total: number): string {
  if (total >= 100) return "/assets/images/bet-100.png";
  if (total >= 25) return "/assets/images/bet-25.png";
  return "/assets/images/bet-5.png";
}