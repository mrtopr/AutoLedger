/**
 * Tally ERP 9 / TallyPrime Stock Summary & Inventory Report Auto-Parser
 * 
 * Specifically optimized for Indian Automobile, Spares & Wholesale distribution.
 * 
 * Features:
 * - Multi-tier header detection (e.g. Particulars on row 7, Closing Balance Quantity/Rate/Value on row 8/9)
 * - Auto-detects Group / Brand headings (e.g. ACCURA, AS, CASTROL) with valuation subtotals
 * - Auto-dissects items into Brand -> Category -> Subcategory -> Vehicle Models -> Color/Specs
 * - Correctly handles items where Rate & Quantity are missing (adds to inventory unassigned for billing)
 * - Handles negative stock balances (e.g. "-1 PCS") and unit normalization
 * - Robust column heuristics regardless of column sequence
 */

export interface TallyParsedItem {
  name: string;
  partNumber: string;
  brand: string;
  category: string;
  subcategory: string;
  models: string[];
  unit: string;
  stockQty: number;
  salePriceRupees: string;
  mrpRupees: string;
  purchasePriceRupees: string;
  amountRupees: string;
  groupHeading: string;
  hsnCode: string;
  gstRateBp: number;
  isValid: boolean;
  isUnpriced: boolean;
  warnings: string[];
}

export interface TallyParseResult {
  isTallyFormat: boolean;
  companyTitle?: string;
  dateRange?: string;
  groupsFound: string[];
  items: TallyParsedItem[];
  totalUnits: number;
  totalValuationRupees: number;
  unpricedCount: number;
}

// 1. KNOWN BRANDS & MANUFACTURERS DICTIONARY
const KNOWN_BRANDS: { pattern: RegExp; canonical: string }[] = [
  { pattern: /\b(accura|acr)\b/i, canonical: 'Accura' },
  { pattern: /\b(as\b|as\.)/i, canonical: 'AS Spares' },
  { pattern: /\b(honda|hmsi)\b/i, canonical: 'Honda Genuine' },
  { pattern: /\b(hero|hero\s*motocorp|hero\s*honda)\b/i, canonical: 'Hero MotoCorp' },
  { pattern: /\b(bajaj|bajaj\s*auto)\b/i, canonical: 'Bajaj Auto' },
  { pattern: /\b(tvs|tvs\s*motor)\b/i, canonical: 'TVS Motor' },
  { pattern: /\b(yamaha)\b/i, canonical: 'Yamaha' },
  { pattern: /\b(suzuki)\b/i, canonical: 'Suzuki' },
  { pattern: /\b(royal\s*enfield|bullet|re)\b/i, canonical: 'Royal Enfield' },
  { pattern: /\b(ktm)\b/i, canonical: 'KTM' },
  { pattern: /\b(castrol)\b/i, canonical: 'Castrol' },
  { pattern: /\b(motul)\b/i, canonical: 'Motul' },
  { pattern: /\b(gulf)\b/i, canonical: 'Gulf Oil' },
  { pattern: /\b(servo|ioc|indian\s*oil)\b/i, canonical: 'Servo' },
  { pattern: /\b(bosch)\b/i, canonical: 'Bosch' },
  { pattern: /\b(lumax)\b/i, canonical: 'Lumax' },
  { pattern: /\b(minda|uno\s*minda)\b/i, canonical: 'Uno Minda' },
  { pattern: /\b(endurance)\b/i, canonical: 'Endurance' },
  { pattern: /\b(varroc)\b/i, canonical: 'Varroc' },
  { pattern: /\b(bando)\b/i, canonical: 'Bando' },
  { pattern: /\b(ngk)\b/i, canonical: 'NGK' },
  { pattern: /\b(champion)\b/i, canonical: 'Champion' },
  { pattern: /\b(gabriel)\b/i, canonical: 'Gabriel' },
  { pattern: /\b(rico)\b/i, canonical: 'Rico Auto' },
  { pattern: /\b(skf)\b/i, canonical: 'SKF Bearings' },
  { pattern: /\b(nbc)\b/i, canonical: 'NBC Bearings' },
  { pattern: /\b(fenner)\b/i, canonical: 'Fenner' },
  { pattern: /\b(purolator)\b/i, canonical: 'Purolator' },
  { pattern: /\b(mak|bharat\s*petroleum)\b/i, canonical: 'MAK Lubricants' },
  { pattern: /\b(hp|hindustan\s*petroleum)\b/i, canonical: 'HP Lubricants' },
];

// 2. KNOWN VEHICLE MODELS DICTIONARY (Includes shorthand from Tally sheets)
const KNOWN_MODELS: { pattern: RegExp; modelName: string; defaultBrand?: string }[] = [
  // Discover Models
  { pattern: /\b(dis\s*100|dis-100|discover\s*100)\b/i, modelName: 'Bajaj Discover 100', defaultBrand: 'Bajaj Auto' },
  { pattern: /\b(dis\s*125|dis-125|discover\s*125|dis-125\s*o\/m|dis-125\s*st)\b/i, modelName: 'Bajaj Discover 125', defaultBrand: 'Bajaj Auto' },
  { pattern: /\b(discover)\b/i, modelName: 'Bajaj Discover', defaultBrand: 'Bajaj Auto' },

  // Honda Models
  { pattern: /\b(d-yuga|d\s*yuga|dream\s*yuga)\b/i, modelName: 'Honda Dream Yuga', defaultBrand: 'Honda Genuine' },
  { pattern: /\b(dream\s*neo|neo)\b/i, modelName: 'Honda Dream Neo', defaultBrand: 'Honda Genuine' },
  { pattern: /\b(shine\s*t[0-9]|shine\s*125|cb\s*shine|sp\s*125|shine)\b/i, modelName: 'Honda CB Shine / SP 125', defaultBrand: 'Honda Genuine' },
  { pattern: /\b(activa\s*6g|activa\s*5g|activa\s*4g|activa\s*3g|activa\s*125|activa)\b/i, modelName: 'Honda Activa', defaultBrand: 'Honda Genuine' },
  { pattern: /\b(dio\s*125|dio)\b/i, modelName: 'Honda Dio', defaultBrand: 'Honda Genuine' },
  { pattern: /\b(unicorn\s*160|unicorn\s*150|unicorn)\b/i, modelName: 'Honda Unicorn', defaultBrand: 'Honda Genuine' },
  { pattern: /\b(hornet|x-blade|xblade)\b/i, modelName: 'Honda Hornet / X-Blade', defaultBrand: 'Honda Genuine' },

  // Hero Models
  { pattern: /\b(s-spl\s*t[0-9]|s-spl|s\s*spl|spl\+|splendor\s*\+|splendor\s*pro|splendor\s*is3|splendor)\b/i, modelName: 'Hero Splendor / Splendor+', defaultBrand: 'Hero MotoCorp' },
  { pattern: /\b(spi-pro|spl-pro)\b/i, modelName: 'Hero Splendor Pro', defaultBrand: 'Hero MotoCorp' },
  { pattern: /\b(pasn\s*m\/w|pasn\+|pasn|passion\s*pro|passion\s*\+|passion\s*plus|passion\s*xpro|passion)\b/i, modelName: 'Hero Passion Pro', defaultBrand: 'Hero MotoCorp' },
  { pattern: /\b(p-pro\s*o\/m|p-pro-digi|p\s*pro\s*n\/m|p-pro|p\s*pro)\b/i, modelName: 'Hero Passion Pro', defaultBrand: 'Hero MotoCorp' },
  { pattern: /\b(glam\s*t[0-9]|glam|glm\s*n\/m|glm\s*dig|glamour\s*125|glamour\s*xtec|glamour)\b/i, modelName: 'Hero Glamour 125', defaultBrand: 'Hero MotoCorp' },
  { pattern: /\b(hf-dlx|hf\s*dlx|hf\s*deluxe|hf\s*100|dawn|cd\s*deluxe|cd-dlx|cd\s*dlx)\b/i, modelName: 'Hero HF Deluxe / CD Deluxe', defaultBrand: 'Hero MotoCorp' },
  { pattern: /\b(pleasure\s*\+|pleasure|maestro\s*edge|maestro|destini\s*125|destini)\b/i, modelName: 'Hero Pleasure / Maestro', defaultBrand: 'Hero MotoCorp' },
  { pattern: /\b(xpulse\s*200|xpulse|xtreme\s*160r|xtreme)\b/i, modelName: 'Hero XPulse / Xtreme', defaultBrand: 'Hero MotoCorp' },
  { pattern: /\b(x-pro|x\s*pro)\b/i, modelName: 'Hero Passion X-Pro', defaultBrand: 'Hero MotoCorp' },

  // Bajaj Models
  { pattern: /\b(pulsar\s*150|pulsar\s*180|pulsar\s*220|pulsar\s*ns200|pulsar\s*rs200|pulsar\s*125|pulsar)\b/i, modelName: 'Bajaj Pulsar (125/150/180/220)', defaultBrand: 'Bajaj Auto' },
  { pattern: /\b(platina\s*110|platina\s*100|platina\s*es|platina)\b/i, modelName: 'Bajaj Platina 100/110', defaultBrand: 'Bajaj Auto' },
  { pattern: /\b(ct\s*100|ct\s*110|ct100|ct110)\b/i, modelName: 'Bajaj CT 100/110', defaultBrand: 'Bajaj Auto' },
  { pattern: /\b(caliber)\b/i, modelName: 'Bajaj Caliber', defaultBrand: 'Bajaj Auto' },
  { pattern: /\b(avenger\s*160|avenger\s*220|avenger)\b/i, modelName: 'Bajaj Avenger', defaultBrand: 'Bajaj Auto' },

  // TVS & Others
  { pattern: /\b(jupiter\s*125|jupiter\s*110|jupiter)\b/i, modelName: 'TVS Jupiter', defaultBrand: 'TVS Motor' },
  { pattern: /\b(apache\s*rtr\s*160|apache\s*rtr\s*200|apache\s*160|apache\s*200|apache)\b/i, modelName: 'TVS Apache RTR', defaultBrand: 'TVS Motor' },
  { pattern: /\b(xl\s*100|xl\s*super|xl100|heavy\s*duty)\b/i, modelName: 'TVS XL 100 Heavy Duty', defaultBrand: 'TVS Motor' },
  { pattern: /\b(ntorq\s*125|ntorq)\b/i, modelName: 'TVS NTorq 125', defaultBrand: 'TVS Motor' },
  { pattern: /\b(victor\s*gl|victor)\b/i, modelName: 'TVS Victor', defaultBrand: 'TVS Motor' },
  { pattern: /\b(centra)\b/i, modelName: 'Kinetic Centra' },
  { pattern: /\b(access\s*125|access)\b/i, modelName: 'Suzuki Access 125', defaultBrand: 'Suzuki' },
  { pattern: /\b(fz-s|fz\s*v3|fz\s*v4|fzs|fz|r15|mt-15)\b/i, modelName: 'Yamaha FZ / R15', defaultBrand: 'Yamaha' },
  { pattern: /\b(classic\s*350|bullet\s*350|bullet|hunter\s*350)\b/i, modelName: 'Royal Enfield Bullet / Classic', defaultBrand: 'Royal Enfield' },
];

// 3. SUBCATEGORY & CATEGORY RULES DICTIONARY
interface SubcategoryPattern {
  pattern: RegExp;
  subcategory: string;
  category: string;
  hsn: string;
  gst: number;
}

const SUBCATEGORY_RULES: SubcategoryPattern[] = [
  // Visors / Fairings / Mudguards
  { pattern: /\b(hlv|h\.l\.v|headlight\s*visor|visor|mask|windshield|fairing)\b/i, subcategory: 'Head Light Visor (HLV)', category: 'Body Parts & Fairing', hsn: '8714', gst: 1800 },
  { pattern: /\b(mudguard|fender)\b/i, subcategory: 'Mudguard', category: 'Body Parts & Fairing', hsn: '8714', gst: 1800 },
  { pattern: /\b(body\s*cover|side\s*panel|tail\s*panel|cowl)\b/i, subcategory: 'Body Panels & Covers', category: 'Body Parts & Fairing', hsn: '8714', gst: 1800 },
  
  // Bearings & Cone Sets
  { pattern: /\b(bearing|ball\s*bearing)\b/i, subcategory: 'Bearings', category: 'Bearings & Hardware', hsn: '8482', gst: 1800 },
  { pattern: /\b(ball\s*racer|con\s*set|cone\s*set|handle\s*cone)\b/i, subcategory: 'Handle Cone Set / Ball Racer', category: 'Suspension & Steering', hsn: '8714', gst: 1800 },
  
  // Brakes
  { pattern: /\b(brake\s*shoe|drum\s*shoe)\b/i, subcategory: 'Brake Shoes', category: 'Brakes & Friction', hsn: '8714', gst: 1800 },
  { pattern: /\b(brake\s*pad|disc\s*pad)\b/i, subcategory: 'Brake Pads', category: 'Brakes & Friction', hsn: '8714', gst: 1800 },
  { pattern: /\b(disc\s*plate|rotor|caliper|master\s*cylinder)\b/i, subcategory: 'Disc Brake Components', category: 'Brakes & Friction', hsn: '8714', gst: 1800 },
  
  // Control Cables
  { pattern: /\b(clutch\s*cable)\b/i, subcategory: 'Clutch Cables', category: 'Control Cables', hsn: '8714', gst: 1800 },
  { pattern: /\b(brake\s*cable|front\s*brake\s*cable)\b/i, subcategory: 'Brake Cables', category: 'Control Cables', hsn: '8714', gst: 1800 },
  { pattern: /\b(acc\s*cable|accelerator\s*cable|throttle\s*cable)\b/i, subcategory: 'Accelerator Cables', category: 'Control Cables', hsn: '8714', gst: 1800 },
  { pattern: /\b(speedo\s*cable|speedometer\s*cable)\b/i, subcategory: 'Speedometer Cables', category: 'Control Cables', hsn: '8714', gst: 1800 },
  { pattern: /\b(cable)\b/i, subcategory: 'Control Cables', category: 'Control Cables', hsn: '8714', gst: 1800 },

  // Electricals & Lighting
  { pattern: /\b(spark\s*plug|plug)\b/i, subcategory: 'Spark Plugs', category: 'Electrical & Lighting', hsn: '8511', gst: 1800 },
  { pattern: /\b(headlight|tail\s*light|indicator|turn\s*signal|bulb|led)\b/i, subcategory: 'Lights & Indicators', category: 'Electrical & Lighting', hsn: '8512', gst: 1800 },
  { pattern: /\b(battery|horn|relay|switch|cdi|ignition|flasher|regulator|stator)\b/i, subcategory: 'Electrical Accessories', category: 'Electrical & Lighting', hsn: '8511', gst: 1800 },

  // Engine & Transmission
  { pattern: /\b(chain\s*sprocket|sprocket|drive\s*chain|chain\s*kit)\b/i, subcategory: 'Chain & Sprocket Kit', category: 'Engine & Transmission', hsn: '8714', gst: 1800 },
  { pattern: /\b(clutch\s*plate|friction\s*plate|pressure\s*plate|clutch\s*assembly)\b/i, subcategory: 'Clutch Assembly & Plates', category: 'Engine & Transmission', hsn: '8714', gst: 1800 },
  { pattern: /\b(v-belt|drive\s*belt|belt|roller|variator)\b/i, subcategory: 'Drive Belts & Variators', category: 'Engine & Transmission', hsn: '8714', gst: 1800 },
  { pattern: /\b(valve|piston|ring\s*set|cylinder|crankshaft|camshaft)\b/i, subcategory: 'Engine Internal Components', category: 'Engine & Transmission', hsn: '8409', gst: 1800 },

  // Suspension & Controls
  { pattern: /\b(shock\s*absorber|shocker|fork|fork\s*pipe|suspension|bush|swing\s*arm)\b/i, subcategory: 'Suspension & Shockers', category: 'Suspension & Steering', hsn: '8714', gst: 1800 },
  { pattern: /\b(mirror|side\s*mirror)\b/i, subcategory: 'Side Mirrors', category: 'Body & Controls', hsn: '8714', gst: 1800 },
  { pattern: /\b(lever|clutch\s*lever|brake\s*lever|yoke)\b/i, subcategory: 'Control Levers', category: 'Body & Controls', hsn: '8714', gst: 1800 },
  { pattern: /\b(grip|handle\s*grip|handle\s*bar)\b/i, subcategory: 'Handlebars & Grips', category: 'Body & Controls', hsn: '8714', gst: 1800 },

  // Filters & Lubricants
  { pattern: /\b(air\s*filter|filter\s*element)\b/i, subcategory: 'Air Filters', category: 'Filters & Elements', hsn: '8421', gst: 1800 },
  { pattern: /\b(oil\s*filter|fuel\s*filter|petrol\s*filter)\b/i, subcategory: 'Oil & Fuel Filters', category: 'Filters & Elements', hsn: '8421', gst: 1800 },
  { pattern: /\b(oil|engine\s*oil|4t|20w40|10w30|10w40|lubricant|grease|brake\s*fluid|coolant|fork\s*oil)\b/i, subcategory: 'Engine Oil & Lubricants', category: 'Lubricants & Oils', hsn: '2710', gst: 1800 },
  { pattern: /\b(tyre|tire|tube)\b/i, subcategory: 'Tyres & Tubes', category: 'Tyres & Tubes', hsn: '4011', gst: 2800 },
];

/**
 * Extracts clean numeric quantity (including negatives like "-1 PCS") and unit
 */
export function parseTallyQuantity(str: string): { qty: number; unit: string } {
  if (!str) return { qty: 0, unit: 'pcs' };
  const clean = str.trim();
  
  // Match optional minus, digits with decimal/comma, and optional trailing unit
  const match = clean.match(/^(-?[0-9,.]+)\s*([a-zA-Z]+)?/);
  if (!match) return { qty: 0, unit: 'pcs' };

  const numStr = match[1].replace(/,/g, '');
  const qty = parseFloat(numStr) || 0;
  let unit = (match[2] || 'pcs').toLowerCase();

  // Normalize common Tally units
  if (unit === 'nos' || unit === 'no') unit = 'pcs';
  if (unit === 'pkts' || unit === 'pkt') unit = 'pkt';
  if (unit === 'sets' || unit === 'set') unit = 'set';
  if (unit === 'ltrs' || unit === 'ltr' || unit === 'l') unit = 'ltr';
  if (unit === 'box' || unit === 'boxes') unit = 'box';
  if (unit === 'mtrs' || unit === 'mtr' || unit === 'm') unit = 'mtr';
  if (unit === 'kgs' || unit === 'kg') unit = 'kg';

  return { qty, unit };
}

/**
 * Parses numeric rate from strings like "180.70", "180.70/PCS", "₹ 180.70"
 */
export function parseTallyRate(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/[₹Rs./\s]/g, ' ').trim();
  const match = clean.match(/(-?[0-9,.]+)/);
  if (!match) return 0;
  const numStr = match[1].replace(/,/g, '');
  return parseFloat(numStr) || 0;
}

/**
 * Determines whether a given row represents a Group Heading in Tally Stock Summary
 * (e.g. "ACCURA" with total value 14905.81, or "AS" with 186223.51)
 * vs an individual product item that simply has missing rates or quantities.
 */
export function isTallyGroupHeading(
  particulars: string,
  rawQtyStr: string,
  rawRateStr: string,
  rawValueStr: string
): boolean {
  const p = (particulars ? String(particulars) : '').trim();
  if (!p) return false;

  // 1. If quantity or rate is present, it is definitely a product item
  if (rawQtyStr && /[0-9]/.test(rawQtyStr)) return false;
  if (rawRateStr && /[0-9]/.test(rawRateStr)) return false;

  // 2. Filter out grand totals or summary rows
  const lower = p.toLowerCase();
  if (
    lower.startsWith('total') ||
    lower.startsWith('grand total') ||
    lower.includes('carried forward') ||
    lower.includes('closing stock')
  ) {
    return false;
  }

  // 3. Product Item markers:
  // Items have numbers, specs, slashes, hyphens, commas, parentheses, or part nouns.
  // Genuine group headings (like ACCURA, AS, CASTROL, BATTERY) are pure short text without digits or dimensions.
  const hasDigits = /\d/.test(p);
  const hasComma = p.includes(',');
  const hasParentheses = /[()]/.test(p);
  const hasItemPrefix = /^[a-z0-9_-]+\.[a-z0-9_-]+/i.test(p);
  const hasSlashOrDash = /[/-]/.test(p);
  const hasOilSpecs = /\b(4t|20w|10w|5w|lube|oil|fluid|grease)\b/i.test(p);
  const hasColorSpecs = /\b(blk|red|grey|blue|s-red|w-red|gold|white|black|green)\b/i.test(p);
  const hasPartNouns = /\b(hlv|mudguard|bearing|ball\s*racer|cable|lever|mirror|filter|plug|shoe|pad|disc|sprocket|belt|shocker|bulb|tyre|tire|tube|cowl|stay|stoper)\b/i.test(p);

  // If any product indicators are present or length is too long for a group name, it is an item!
  if (hasDigits || hasComma || hasParentheses || hasItemPrefix || hasSlashOrDash || hasOilSpecs || hasColorSpecs || hasPartNouns || p.length > 28) {
    return false;
  }

  // 4. In Tally Stock Summary:
  // Group headings are short uppercase brand / category titles (e.g. "ACCURA", "AS", "CASTROL", "HERO")
  return true;
}

/**
 * Dissects raw item string into Name, Brand, Subcategory, Category, Models, HSN & GST
 */
export function dissectItemDescription(
  rawDesc: string,
  groupHeading: string = ''
): {
  cleanName: string;
  brand: string;
  category: string;
  subcategory: string;
  models: string[];
  hsnCode: string;
  gstRateBp: number;
} {
  let text = rawDesc.trim();

  // 1. Determine Brand
  let detectedBrand = 'Standard';
  // Check group heading first (e.g. "ACCURA" or "AS")
  if (groupHeading) {
    for (const b of KNOWN_BRANDS) {
      if (b.pattern.test(groupHeading)) {
        detectedBrand = b.canonical;
        break;
      }
    }
    if (detectedBrand === 'Standard' && groupHeading.length > 1 && groupHeading.length < 25) {
      detectedBrand = groupHeading.trim();
    }
  }

  // Check item prefix if not matched from group heading
  if (detectedBrand === 'Standard' || detectedBrand === 'Accura' || detectedBrand === 'AS Spares') {
    for (const b of KNOWN_BRANDS) {
      if (b.pattern.test(text)) {
        detectedBrand = b.canonical;
        break;
      }
    }
  }

  // 2. Determine Compatible Models
  const detectedModels: string[] = [];
  for (const m of KNOWN_MODELS) {
    if (m.pattern.test(text) || (groupHeading && m.pattern.test(groupHeading))) {
      detectedModels.push(m.modelName);
    }
  }
  if (detectedModels.length === 0) {
    detectedModels.push('Universal / Multi-Fit');
  }

  // 3. Determine Category & Subcategory
  let detectedCategory = 'General Automobile Spares';
  let detectedSubcategory = 'Spare Parts';
  let hsnCode = '8714';
  let gstRateBp = 1800; // 18% default

  // Match against known subcategories
  for (const rule of SUBCATEGORY_RULES) {
    if (rule.pattern.test(text) || (groupHeading && rule.pattern.test(groupHeading))) {
      detectedCategory = rule.category;
      detectedSubcategory = rule.subcategory;
      hsnCode = rule.hsn;
      gstRateBp = rule.gst;
      break;
    }
  }

  // Fallback: If no subcategory matched, extract noun structure from item prefix/tokens
  // e.g. "ACR.SIDE STAND, SPL" -> Subcategory: "Side Stand"
  if (detectedSubcategory === 'Spare Parts') {
    const textBeforeComma = text.split(',')[0] || '';
    const cleanToken = textBeforeComma.replace(/^[a-z0-9_-]+\./i, '').trim();
    if (cleanToken.length > 2 && cleanToken.length < 25) {
      detectedSubcategory = cleanToken;
    }
  }

  return {
    cleanName: text,
    brand: detectedBrand,
    category: detectedCategory,
    subcategory: detectedSubcategory,
    models: Array.from(new Set(detectedModels)),
    hsnCode,
    gstRateBp,
  };
}

/**
 * Master parser for Tally Stock Summary tables
 */
export function parseTallyInventorySheet(inputRows: string[][]): TallyParseResult {
  if (!inputRows || inputRows.length < 2) {
    return {
      isTallyFormat: false,
      groupsFound: [],
      items: [],
      totalUnits: 0,
      totalValuationRupees: 0,
      unpricedCount: 0,
    };
  }

  // Sanitize all rows into dense 2D string matrix without holes or undefineds
  const rawRows: string[][] = inputRows
    .filter(row => Array.isArray(row) && row.length > 0)
    .map(row => Array.from(row, c => (c !== null && c !== undefined ? String(c).trim() : '')));

  let tableHeaderRowIndex = -1;
  let particularsCol = -1;
  let qtyCol = -1;
  let rateCol = -1;
  let valueCol = -1;
  let companyTitle = '';
  let dateRange = '';

  // 1. Multi-tier scan for Tally Table Headers
  // In Tally sheets, "Particulars" is often in Row 7, while "Quantity", "Rate", "Value" are in Row 8 or 9
  for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
    const rowRaw = rawRows[r] || [];
    const row = Array.from(rowRaw, c => (c ? String(c) : '').toLowerCase().trim());

    // Detect Company Title in top 6 rows
    if (r < 6 && !companyTitle) {
      const candidate = rowRaw.find(c => Boolean(c) && typeof c === 'string' && c.length > 5 && !c.toLowerCase().includes('stock summary') && !c.toLowerCase().includes('particular'));
      if (candidate) companyTitle = candidate;
    }

    // Detect Date range (e.g. "1-Apr-26 to 9-Oct-26")
    if (r < 8 && !dateRange) {
      const dateCell = rowRaw.find(c => Boolean(c) && typeof c === 'string' && /[0-9]+-[a-z]+-[0-9]+\s*to\s*[0-9]+-[a-z]+-[0-9]+/i.test(c));
      if (dateCell) dateRange = dateCell;
    }

    // Check for particulars column
    const pIdx = row.findIndex(c => Boolean(c) && typeof c === 'string' && (c.includes('particular') || c.includes('item name') || c.includes('description')));
    if (pIdx >= 0 && particularsCol === -1) {
      particularsCol = pIdx;
      tableHeaderRowIndex = Math.max(tableHeaderRowIndex, r);
    }

    // Check for quantity column
    const qIdx = row.findIndex(c => Boolean(c) && typeof c === 'string' && (c.includes('quantity') || c.includes('qty') || (c.includes('closing') && !c.includes('value'))));
    if (qIdx >= 0 && qtyCol === -1) {
      qtyCol = qIdx;
      tableHeaderRowIndex = Math.max(tableHeaderRowIndex, r);
    }

    // Check for rate column
    const rIdx = row.findIndex(c => Boolean(c) && typeof c === 'string' && (c.includes('rate') || c.includes('price')));
    if (rIdx >= 0 && rateCol === -1) {
      rateCol = rIdx;
      tableHeaderRowIndex = Math.max(tableHeaderRowIndex, r);
    }

    // Check for value/amount column
    const vIdx = row.findIndex(c => Boolean(c) && typeof c === 'string' && (c.includes('value') || c.includes('amount')));
    if (vIdx >= 0 && valueCol === -1) {
      valueCol = vIdx;
      tableHeaderRowIndex = Math.max(tableHeaderRowIndex, r);
    }
  }

  // Fallback defaults if explicit headers were partially named or absent
  if (particularsCol === -1) particularsCol = 0;
  if (qtyCol === -1 && rateCol !== -1 && rateCol > 0) qtyCol = rateCol - 1;
  if (qtyCol !== -1 && rateCol === -1) rateCol = qtyCol + 1;
  if (rateCol !== -1 && valueCol === -1) valueCol = rateCol + 1;

  // If still unfound, inspect first few data rows to infer column positions
  if (qtyCol === -1 || rateCol === -1 || valueCol === -1) {
    for (let r = Math.max(0, tableHeaderRowIndex); r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r];
      for (let c = 1; c < row.length; c++) {
        const val = row[c] || '';
        if (qtyCol === -1 && /[0-9]+\s*(nos|pcs|set|ltr|pkt)?/i.test(val)) {
          qtyCol = c;
        } else if (rateCol === -1 && /[0-9.]+\/[a-z]+/i.test(val)) {
          rateCol = c;
        } else if (valueCol === -1 && /[0-9,.]+/.test(val)) {
          valueCol = c;
        }
      }
    }
  }

  // Ensure default fallback offsets
  if (qtyCol === -1) qtyCol = 1;
  if (rateCol === -1) rateCol = 2;
  if (valueCol === -1) valueCol = 3;

  const items: TallyParsedItem[] = [];
  const groupsFound: string[] = [];
  let currentGroup = '';
  const startRow = tableHeaderRowIndex >= 0 ? tableHeaderRowIndex + 1 : 1;

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0 || row.every(c => !c || c.trim() === '')) continue;

    const rawParticulars = (row[particularsCol] || '').trim();
    if (!rawParticulars) continue;

    // Filter out Grand Total / Subtotal rows
    const lowerP = rawParticulars.toLowerCase();
    if (
      lowerP.startsWith('total') || 
      lowerP.startsWith('grand total') || 
      lowerP.includes('carried forward') || 
      lowerP.includes('opening balance') ||
      lowerP.includes('closing stock')
    ) {
      continue;
    }

    const rawQtyStr = qtyCol >= 0 && row[qtyCol] ? row[qtyCol].trim() : '';
    const rawRateStr = rateCol >= 0 && row[rateCol] ? row[rateCol].trim() : '';
    const rawValueStr = valueCol >= 0 && row[valueCol] ? row[valueCol].trim() : '';

    // A. CHECK IF GROUP HEADING (e.g. "ACCURA", "AS")
    if (isTallyGroupHeading(rawParticulars, rawQtyStr, rawRateStr, rawValueStr)) {
      currentGroup = rawParticulars;
      if (!groupsFound.includes(currentGroup)) {
        groupsFound.push(currentGroup);
      }
      continue; // Group headers are not inventory items
    }

    // B. PROCESS STOCK ITEM ROW
    const { qty, unit } = parseTallyQuantity(rawQtyStr);
    let rate = parseTallyRate(rawRateStr);
    let amount = parseTallyRate(rawValueStr);

    // If rate is missing but value & qty exist: calculate rate = amount / qty
    if (rate <= 0 && amount > 0 && qty > 0) {
      rate = Math.round((amount / qty) * 100) / 100;
    } else if (amount <= 0 && rate > 0 && qty !== 0) {
      amount = Math.round(rate * qty * 100) / 100;
    }

    // Check if Rate and Quantity are missing in the sheet
    // As per user requirement: Add to inventory without assigning rate or qty (to be assigned at billing)
    const isUnpriced = (rate <= 0 && amount <= 0 && (!rawRateStr || !rawRateStr.trim())) && (qty === 0 && !rawQtyStr);

    const { cleanName, brand, category, subcategory, models, hsnCode, gstRateBp } = dissectItemDescription(
      rawParticulars, 
      currentGroup
    );

    const brandPrefix = (brand.replace(/[^A-Za-z]/g, '').slice(0, 3) || 'TL').toUpperCase();
    const partNumber = `TL-${brandPrefix}-${(items.length + 1).toString().padStart(4, '0')}`;
    const rateRupeesStr = rate > 0 ? rate.toFixed(2) : '';
    const mrpRupeesStr = rate > 0 ? Math.round(rate * 1.25).toString() : '';
    const amountRupeesStr = amount !== 0 ? amount.toFixed(2) : '';

    const warnings: string[] = [];
    if (isUnpriced) {
      warnings.push('Rate & Qty missing — will be assigned during billing');
    } else {
      if (rate <= 0) warnings.push('Missing selling rate');
      if (qty <= 0) warnings.push('Zero or negative stock count');
    }

    items.push({
      name: cleanName,
      partNumber,
      brand,
      category,
      subcategory,
      models,
      unit: unit || 'pcs',
      stockQty: isUnpriced ? 0 : qty,
      salePriceRupees: rateRupeesStr,
      mrpRupees: mrpRupeesStr,
      purchasePriceRupees: rateRupeesStr,
      amountRupees: amountRupeesStr,
      groupHeading: currentGroup || 'General Inventory',
      hsnCode,
      gstRateBp,
      isValid: Boolean(cleanName && cleanName.length > 1),
      isUnpriced,
      warnings,
    });
  }

  const isTallyFormat = groupsFound.length > 0 || (items.length > 0 && items.some(i => i.unit !== 'pcs' || (Boolean(i.name) && i.name.includes('.'))));
  const totalUnits = items.reduce((sum, i) => sum + i.stockQty, 0);
  const totalValuationRupees = items.reduce((sum, i) => sum + (parseFloat(i.salePriceRupees || '0') * i.stockQty), 0);
  const unpricedCount = items.filter(i => i.isUnpriced).length;

  return {
    isTallyFormat,
    companyTitle,
    dateRange,
    groupsFound,
    items,
    totalUnits,
    totalValuationRupees,
    unpricedCount,
  };
}
