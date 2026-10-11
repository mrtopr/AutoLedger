import { describe, it, expect } from 'vitest';
import { parseTallyInventorySheet } from './tallyParser';

describe('Tally Stock Summary Parser (tallyParser.ts)', () => {
  const sampleSheetData = [
    ['SRI VISHWAKARMA AUTO - 25-26', '', '', ''],
    ['MAIN ROAD RAJAULI', '', '', ''],
    ['BIHAR - 805125', '', '', ''],
    ['MOB NO : - 9934074966', '', '', ''],
    ['E-Mail : shreevishwskarmaauto.arun@gmail.com', '', '', ''],
    ['Stock Summary', '', '', ''],
    ['1-Apr-26 to 9-Oct-26', '', '', ''],
    ['Particulars', 'SRI VISHWAKARMA AUTO - 25-26', '', ''],
    ['', '1-Apr-26 to 9-Oct-26', '', ''],
    ['', 'Closing Balance', '', ''],
    ['', 'Quantity', 'Rate', 'Value'],
    // Group 1: ACCURA with subtotal
    ['ACCURA', '', '', '14905.81'],
    // Unpriced item (missing rate & qty)
    ['ACR.HLV,DIS 100 ( RED )', '', '', ''],
    // Priced items under ACCURA
    ['ACR.HLV, D-YUGA (BLK/GREY)', '1 PCS', '180.70', '180.70'],
    ['ACR.HLV,D-YUGA (BLK/RED)', '1 PCS', '180.71', '180.71'],
    ['ACR.HLV,GLAM T5 (BLK-GREY)', '', '', ''],
    ['ACR.HLV, HF-DLX (BLK/BLUE)', '2 PCS', '158.56', '317.11'],
    ['ACR.MUDGUARD,CALIBER (BLK)', '', '', ''],
    ['ACR.MUDGUARD,CD-DLX(BLK)', '1 PCS', '172.62', '172.62'],
    // Group 2: AS with subtotal
    ['AS', '', '', '186223.51'],
    ['AS. 6003 BEARING', '9 PCS', '33.50', '301.50'],
    ['AS. BALL RACER, ACTIVA', '10 PCS', '162.50', '1625.00'],
    ['AS. BALL RACER, GLAM', '-1 PCS', '149.50', '-149.50'],
  ];

  it('correctly detects company title and groups', () => {
    const result = parseTallyInventorySheet(sampleSheetData);
    expect(result.companyTitle).toContain('SRI VISHWAKARMA AUTO');
    expect(result.groupsFound).toContain('ACCURA');
    expect(result.groupsFound).toContain('AS');
  });

  it('distinguishes group headings from unpriced items', () => {
    const result = parseTallyInventorySheet(sampleSheetData);
    
    // Group headings should NOT be present in items list as products
    const groupItem = result.items.find(i => i.name === 'ACCURA' || i.name === 'AS');
    expect(groupItem).toBeUndefined();

    // Unpriced items like ACR.HLV,DIS 100 ( RED ) MUST be present as products
    const unpricedItem = result.items.find(i => i.name === 'ACR.HLV,DIS 100 ( RED )');
    expect(unpricedItem).toBeDefined();
    expect(unpricedItem?.isUnpriced).toBe(true);
    expect(unpricedItem?.stockQty).toBe(0);
    expect(unpricedItem?.salePriceRupees).toBe('');
    expect(unpricedItem?.brand).toBe('Accura');
    expect(unpricedItem?.subcategory).toBe('Head Light Visor (HLV)');
    expect(unpricedItem?.models).toContain('Bajaj Discover 100');
  });

  it('extracts prices, quantities and vehicle models for in-stock items', () => {
    const result = parseTallyInventorySheet(sampleSheetData);

    const dreamYugaItem = result.items.find(i => i.name.includes('D-YUGA (BLK/GREY)'));
    expect(dreamYugaItem).toBeDefined();
    expect(dreamYugaItem?.stockQty).toBe(1);
    expect(dreamYugaItem?.salePriceRupees).toBe('180.70');
    expect(dreamYugaItem?.unit).toBe('pcs');
    expect(dreamYugaItem?.models).toContain('Honda Dream Yuga');
    expect(dreamYugaItem?.subcategory).toBe('Head Light Visor (HLV)');

    const mudguardItem = result.items.find(i => i.name.includes('CD-DLX(BLK)'));
    expect(mudguardItem).toBeDefined();
    expect(mudguardItem?.subcategory).toBe('Mudguard');
    expect(mudguardItem?.models).toContain('Hero HF Deluxe / CD Deluxe');
  });

  it('handles negative stock and hardware parts under AS group', () => {
    const result = parseTallyInventorySheet(sampleSheetData);

    const bearingItem = result.items.find(i => i.name.includes('6003 BEARING'));
    expect(bearingItem).toBeDefined();
    expect(bearingItem?.stockQty).toBe(9);
    expect(bearingItem?.salePriceRupees).toBe('33.50');
    expect(bearingItem?.subcategory).toBe('Bearings');

    const ballRacerActiva = result.items.find(i => i.name.includes('BALL RACER, ACTIVA'));
    expect(ballRacerActiva).toBeDefined();
    expect(ballRacerActiva?.stockQty).toBe(10);
    expect(ballRacerActiva?.models).toContain('Honda Activa');
    expect(ballRacerActiva?.subcategory).toBe('Handle Cone Set / Ball Racer');

    const negativeStockItem = result.items.find(i => i.name.includes('BALL RACER, GLAM'));
    expect(negativeStockItem).toBeDefined();
    expect(negativeStockItem?.stockQty).toBe(-1);
    expect(negativeStockItem?.salePriceRupees).toBe('149.50');
  });

  it('safely handles sparse arrays with holes, nulls, and undefined cells without throwing', () => {
    // Array with holes and nulls
    const sparseData: any[][] = [];
    sparseData[0] = ['Particulars', undefined, null, 'Closing Balance'];
    sparseData[1] = [undefined, 'Quantity', 'Rate', 'Value'];
    sparseData[2] = ['ACCURA', undefined, undefined, '5000'];
    sparseData[3] = ['ACR.HLV,DIS 100 ( RED )']; // missing columns 1, 2, 3
    sparseData[4] = ['ACR.HLV, D-YUGA (BLK/GREY)', '2 PCS', '180.00', '360.00'];

    expect(() => {
      const res = parseTallyInventorySheet(sparseData);
      expect(res.items.length).toBeGreaterThan(0);
    }).not.toThrow();
  });
});
