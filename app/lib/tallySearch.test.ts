import { describe, test, expect } from 'vitest';
import { searchTallyItems, scoreTallyItem, getHighlightedTallySegments } from './tallySearch';

describe('TallySearch Engine', () => {
  const sampleCatalog = [
    {
      id: '1',
      name: 'TVS.CDI, RTR-160 4V',
      partNumber: 'TL-TP-4175',
      brand: 'TVS',
      models: ['Apache RTR 160 4V'],
      stockQty: 1,
      salePricePaise: '189677',
    },
    {
      id: '2',
      name: 'TVS.CHOKE CAB, JUPITER',
      partNumber: 'TL-TP-4176',
      brand: 'TVS',
      models: ['Jupiter 110'],
      stockQty: 1,
      salePricePaise: '12773',
    },
    {
      id: '3',
      name: 'TVS. VISOR STICKER, S-SPL (BLACK-GREAY)',
      partNumber: 'TL-TP-4177',
      brand: 'TVS',
      models: ['Super Splendor'],
      stockQty: 0,
      salePricePaise: '0',
    },
    {
      id: '4',
      name: 'TVS. 13 NO. NUT',
      partNumber: 'TL-TVS-8261',
      brand: 'TVS',
      models: ['Universal'],
      stockQty: 39,
      salePricePaise: '104',
    },
  ];

  test('matches with trailing dot "TVS."', () => {
    const res = searchTallyItems(sampleCatalog, 'TVS.');
    expect(res.length).toBe(4);
    // 39 stock item should rank first among the TVS items!
    expect(res[0].partNumber).toBe('TL-TVS-8261');
  });

  test('matches order-independent tokens "RTR TVS" and "160 RTR"', () => {
    const res1 = searchTallyItems(sampleCatalog, 'RTR TVS');
    expect(res1.length).toBe(1);
    expect(res1[0].name).toContain('RTR-160');

    const res2 = searchTallyItems(sampleCatalog, '160 RTR');
    expect(res2.length).toBe(1);
    expect(res2[0].name).toContain('RTR-160');
  });

  test('matches condensed alphanumeric tokens "RTR160" and "SSPL"', () => {
    const res1 = searchTallyItems(sampleCatalog, 'RTR160');
    expect(res1.length).toBe(1);
    expect(res1[0].name).toContain('RTR-160');

    const res2 = searchTallyItems(sampleCatalog, 'SSPL');
    expect(res2.length).toBe(1);
    expect(res2[0].name).toContain('S-SPL');
  });

  test('matches inverted numbers and tokens "13 NUT" and "NUT 13"', () => {
    const res1 = searchTallyItems(sampleCatalog, '13 NUT');
    expect(res1.length).toBe(1);
    expect(res1[0].name).toContain('13 NO. NUT');

    const res2 = searchTallyItems(sampleCatalog, 'NUT 13');
    expect(res2.length).toBe(1);
    expect(res2[0].name).toContain('13 NO. NUT');
  });

  test('matches part number / SKU tokens "8261" or "TL-TP"', () => {
    const res1 = searchTallyItems(sampleCatalog, '8261');
    expect(res1.length).toBe(1);
    expect(res1[0].partNumber).toBe('TL-TVS-8261');

    const res2 = searchTallyItems(sampleCatalog, 'TL-TP');
    expect(res2.length).toBe(3);
  });

  test('highlighting splits tokens correctly', () => {
    const segments = getHighlightedTallySegments('TVS.CDI, RTR-160 4V', 'RTR 160');
    const matchedTokens = segments.filter(s => s.isMatch).map(s => s.text.toLowerCase());
    expect(matchedTokens).toContain('rtr');
    expect(matchedTokens).toContain('160');
  });
});
