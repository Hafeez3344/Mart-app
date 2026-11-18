/**
 * Pharmacy Packaging & Multi-tier Conversion Engine
 * Supports any packaging hierarchy (Strips, Packs, Boxes, Cartons, Bottles, Vials, Ampoules, etc.)
 */

/**
 * Normalizes packaging configuration for a medicine
 */
function normalizePackagingConfig(medicine) {
  if (!medicine) {
    return {
      baseUnit: 'Unit',
      defaultSaleUnit: 'Unit',
      allowFractional: false,
      tiers: []
    };
  }

  const baseUnit = (medicine.baseUnit || 'Tablet').trim();
  const defaultSaleUnit = (medicine.defaultSaleUnit || baseUnit).trim();
  const allowFractional = Boolean(medicine.allowFractional);

  let rawConfig = medicine.packagingConfig;
  if (typeof rawConfig === 'string') {
    try {
      rawConfig = JSON.parse(rawConfig);
    } catch {
      rawConfig = null;
    }
  }

  let tiers = [];
  if (rawConfig && Array.isArray(rawConfig.tiers)) {
    tiers = rawConfig.tiers;
  } else if (rawConfig && Array.isArray(rawConfig)) {
    tiers = rawConfig;
  } else if (rawConfig && Array.isArray(rawConfig.units)) {
    tiers = rawConfig.units;
  }

  // Ensure clean structure and sorted ascending by multiplier
  const cleanTiers = tiers
    .filter(t => t && t.unit && Number(t.multiplier) > 0)
    .map(t => ({
      unit: String(t.unit).trim(),
      multiplier: Number(t.multiplier),
      sellingPrice: t.sellingPrice !== undefined && t.sellingPrice !== null && t.sellingPrice !== '' ? Number(t.sellingPrice) : null,
      purchasePrice: t.purchasePrice !== undefined && t.purchasePrice !== null && t.purchasePrice !== '' ? Number(t.purchasePrice) : null,
      isDefaultSale: Boolean(t.isDefaultSale || t.unit.toLowerCase() === defaultSaleUnit.toLowerCase())
    }))
    .sort((a, b) => a.multiplier - b.multiplier);

  return {
    baseUnit,
    defaultSaleUnit,
    allowFractional,
    tiers: cleanTiers
  };
}

/**
 * Finds conversion multiplier from specified unit to base unit
 */
function getUnitMultiplier(medicine, unitName) {
  if (!unitName) return 1.0;
  const config = normalizePackagingConfig(medicine);
  const u = String(unitName).trim().toLowerCase();

  if (u === config.baseUnit.toLowerCase()) {
    return 1.0;
  }

  const match = config.tiers.find(t => t.unit.toLowerCase() === u);
  if (match) {
    return match.multiplier;
  }

  return 1.0;
}

/**
 * Resolves unit price (selling or purchase) for a specific packaging unit
 */
function getUnitPrice(medicine, unitName, priceType = 'selling') {
  const config = normalizePackagingConfig(medicine);
  const u = String(unitName || config.defaultSaleUnit).trim().toLowerCase();
  const mult = getUnitMultiplier(medicine, u);

  // If asking for base unit price
  if (u === config.baseUnit.toLowerCase()) {
    if (priceType === 'selling') {
      return Number(medicine.retailPrice || 0);
    }
    return Number(medicine.unitCost || 0);
  }

  // Check if explicit tier price exists
  const tier = config.tiers.find(t => t.unit.toLowerCase() === u);
  if (tier) {
    const field = priceType === 'selling' ? 'sellingPrice' : 'purchasePrice';
    if (tier[field] !== null && tier[field] !== undefined && !isNaN(tier[field])) {
      return Number(tier[field]);
    }
  }

  // Proportional fallback from base unit price
  const basePrice = priceType === 'selling' ? Number(medicine.retailPrice || 0) : Number(medicine.unitCost || 0);
  return Number((basePrice * mult).toFixed(2));
}

/**
 * Converts a quantity in given unit into base units
 */
function convertToBaseQuantity(medicine, quantity, unitName) {
  const qty = Number(quantity);
  if (isNaN(qty)) return 0;
  const mult = getUnitMultiplier(medicine, unitName);
  return Number((qty * mult).toFixed(4));
}

/**
 * Validates sale quantity according to packaging rules and fractional settings
 */
function validateSaleQuantity(medicine, quantity, unitName) {
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    return { valid: false, message: 'Quantity must be greater than zero.' };
  }

  const config = normalizePackagingConfig(medicine);
  const baseQty = convertToBaseQuantity(medicine, qty, unitName);

  // If fractional quantities are disabled for this medicine (e.g. ampoules, vials, syringes)
  if (!config.allowFractional) {
    if (!Number.isInteger(qty)) {
      return {
        valid: false,
        message: `${medicine.name} (${unitName || config.defaultSaleUnit}) does not allow fractional quantities. Whole units only.`
      };
    }
  }

  // Verify that the resulting base quantity does not produce an impossible fraction of an indivisible base unit
  const discreteBaseUnits = ['tablet', 'capsule', 'ampoule', 'vial', 'tube', 'sachet', 'piece', 'glove', 'bottle', 'kit'];
  const isDiscrete = discreteBaseUnits.includes(config.baseUnit.toLowerCase());
  if (isDiscrete) {
    const isBaseInteger = Math.abs(Math.round(baseQty) - baseQty) < 1e-4;
    if (!isBaseInteger) {
      return {
        valid: false,
        message: `Quantity ${qty} ${unitName} results in ${baseQty} ${config.baseUnit}s. Fractional individual ${config.baseUnit}s cannot be dispensed.`
      };
    }
  }

  return { valid: true, baseQuantity: Math.round(baseQty * 10000) / 10000 };
}

function pluralize(unit, count) {
  if (count === 1) return unit;
  const lower = unit.toLowerCase();
  if (lower === 'box') return 'Boxes';
  if (lower.endsWith('s') || lower.endsWith('sh') || lower.endsWith('ch') || lower.endsWith('x') || lower.endsWith('z')) {
    return unit + 'es';
  }
  return unit + 's';
}

/**
 * Calculates human-readable dynamic breakdown of base stock into packaging tiers
 * e.g., 100 tablets -> "1 Box" (or "10 Strips")
 * 70 tablets -> "7 Strips"
 * 23 tablets -> "2 Strips, 3 Tablets"
 */
function formatStockBreakdown(stockInBase, medicine) {
  const total = Number(stockInBase);
  if (isNaN(total) || total <= 0) {
    const config = normalizePackagingConfig(medicine);
    return `0 ${pluralize(config.baseUnit, 0)}`;
  }

  const config = normalizePackagingConfig(medicine);
  if (!config.tiers || config.tiers.length === 0) {
    return `${total} ${pluralize(config.baseUnit, total)}`;
  }

  // Sort tiers descending to break down greedy from largest to smallest
  const descendingTiers = [...config.tiers].sort((a, b) => b.multiplier - a.multiplier);

  let remaining = total;
  const parts = [];

  for (const tier of descendingTiers) {
    if (tier.multiplier <= 0) continue;
    if (remaining >= tier.multiplier) {
      const count = Math.floor(remaining / tier.multiplier);
      if (count > 0) {
        parts.push(`${count} ${pluralize(tier.unit, count)}`);
        remaining = Number((remaining % tier.multiplier).toFixed(4));
      }
    }
  }

  if (remaining > 0 || parts.length === 0) {
    parts.push(`${remaining} ${pluralize(config.baseUnit, remaining)}`);
  }

  return parts.join(', ');
}

module.exports = {
  normalizePackagingConfig,
  getUnitMultiplier,
  getUnitPrice,
  convertToBaseQuantity,
  validateSaleQuantity,
  formatStockBreakdown
};
