function recommendSize(userText) {
  const weightMatch = userText.match(/(?:weight\s*is\s*|weight\s*|wt\s*|@\s*|^|\D)(\d{2,3})\s*(?:kg|kilo|k)\b/i) || userText.match(/\b(\d{2,3})\s*(?:kg|kilo)\b/i);
  const waistMatch = userText.match(/(?:waist|kamar)\s*(?:is\s*|of\s*|=|-|:)?\s*(\d{2})\b/i) || userText.match(/\b(\d{2})\s*(?:waist|kamar|inch|in)\b/i);

  if (weightMatch) {
    const kg = parseInt(weightMatch[1], 10);
    let teeSize = 'M (Medium)';
    let teeChest = '44"';
    let bottomSize = 'L (30-32" waist)';
    if (kg < 60) {
      teeSize = 'S (Small)'; teeChest = '42"'; bottomSize = 'M (28-30" waist)';
    } else if (kg <= 72) {
      teeSize = 'M (Medium)'; teeChest = '44"'; bottomSize = 'M or L (29-31" waist)';
    } else if (kg <= 84) {
      teeSize = 'L (Large)'; teeChest = '46"'; bottomSize = 'L or XL (31-33" waist)';
    } else if (kg <= 95) {
      teeSize = 'XL (Extra Large)'; teeChest = '48"'; bottomSize = 'XL or XXL (33-35" waist)';
    } else {
      teeSize = 'XXL (Double XL)'; teeChest = '50"'; bottomSize = 'XXL (35-37" waist)';
    }

    return `[11FIT SIZE & FIT RECOMMENDATION FOR WEIGHT ~${kg} KG]:\n` +
      `👕 Oversized T-Shirts: Recommended Size **${teeSize}** (Chest ${teeChest} | Premium Boxy Drop-Shoulder Fit)\n` +
      `🩳 Shorts & Track Pants: Recommended Size **${bottomSize}** (4-Way Lycra stretchable waistband with drawstring)\n` +
      `💡 Note: 11FIT tees already have a stylish drop-shoulder oversized streetwear cut — no need to size up for an oversized look!`;
  }

  if (waistMatch) {
    const waist = parseInt(waistMatch[1], 10);
    let bottomSize = 'M (Medium - 28-30")';
    if (waist >= 35) bottomSize = 'XXL (Double XL - 34-36"+)';
    else if (waist >= 33) bottomSize = 'XL (Extra Large - 32-34")';
    else if (waist >= 31) bottomSize = 'L (Large - 30-32")';

    return `[11FIT SIZE RECOMMENDATION FOR ~${waist}" WAIST]:\n` +
      `🩳 Recommended Bottom Size: **${bottomSize}** (4-Way Lycra stretchable waistband + adjustable drawstring for perfect comfort)\n` +
      `👕 For Oversized Tees: Choose based on chest/weight (M for 65-75kg, L for 75-85kg, XL for 85-95kg).`;
  }

  return `[11FIT GENERAL SIZE & FIT GUIDE]:\n` +
    `👕 Oversized T-Shirts (Combed Cotton Drop-Shoulder Boxy Fit):\n` +
    `   • S: Chest 42" (~50-63 kg)\n` +
    `   • M: Chest 44" (~63-73 kg)\n` +
    `   • L: Chest 46" (~74-84 kg)\n` +
    `   • XL: Chest 48" (~85-95 kg)\n` +
    `   • XXL: Chest 50" (~96-110 kg)\n` +
    `🩳 4-Way Lycra Shorts & Track Pants (Stretchable Waistband):\n` +
    `   • M (28-30"), L (30-32"), XL (32-34"), XXL (34-36"+)\n` +
    `💡 Advice: Our tees are already oversized streetwear fit — take your normal size!`;
}

console.log('=== TEST 1 (78kg) ===\n', recommendSize('mera weight 78kg hai, height 5 10'));
console.log('=== TEST 2 (34 waist) ===\n', recommendSize('what size for 34 waist'));
console.log('=== TEST 3 (size chart) ===\n', recommendSize('size chart batao'));
