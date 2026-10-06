'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'hi';

export interface Translations {
  [key: string]: {
    en: string;
    hi: string;
  };
}

export const dictionary: Translations = {
  // Brand & General
  'app.name': { en: 'AUTOLEDGER', hi: 'ऑटोलेजर' },
  'app.dealership': { en: 'Honda Dealership & Workshop ERP', hi: 'होंडा डीलरशिप एवं वर्कशॉप ईआरपी' },
  'app.system_online': { en: 'System Online', hi: 'सिस्टम ऑनलाइन' },
  'app.search_placeholder': { en: 'Search customer, invoice, part number, vehicle...', hi: 'ग्राहक, बिल नंबर, पार्ट नंबर, गाड़ी नंबर खोजें...' },
  'app.new_bill': { en: 'New Bill', hi: 'नया बिल' },
  'app.notifications': { en: 'Notifications', hi: 'सूचनाएं' },
  'app.sign_out': { en: 'Sign Out', hi: 'लॉग आउट' },
  'app.staff_roles': { en: 'Staff & Roles', hi: 'स्टाफ एवं अधिकार' },
  'app.dealership_settings': { en: 'Dealership Settings', hi: 'डीलरशिप सेटिंग्स' },
  'app.ctrl_k': { en: 'Ctrl K', hi: 'Ctrl K' },

  // Sidebar Nav Groups
  'nav.overview': { en: 'OVERVIEW', hi: 'अवलोकन' },
  'nav.operations': { en: 'OPERATIONS', hi: 'दैनिक कार्य' },
  'nav.finance': { en: 'FINANCE', hi: 'वित्तीय प्रबंधन' },
  'nav.management': { en: 'MANAGEMENT', hi: 'प्रबंधन' },

  // Nav Items
  'nav.dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड' },
  'nav.invoices': { en: 'Invoices', hi: 'बिल व चालान' },
  'nav.customers_khata': { en: 'Customers & Khata', hi: 'ग्राहक व खाता' },
  'nav.inventory': { en: 'Inventory', hi: 'इन्वेंट्री / स्टॉक' },
  'nav.products': { en: 'Products', hi: 'पार्ट्स व उत्पाद' },
  'nav.reports': { en: 'Reports', hi: 'रिपोर्ट्स' },
  'nav.staff': { en: 'Staff', hi: 'स्टाफ' },
  'nav.settings': { en: 'Settings', hi: 'सेटिंग्स' },
  'nav.home': { en: 'Home', hi: 'होम' },
  'nav.bills': { en: 'Bills', hi: 'बिल' },
  'nav.parts': { en: 'Parts', hi: 'पार्ट्स' },
  'nav.customers': { en: 'Customers', hi: 'ग्राहक' },
  'nav.more': { en: 'More', hi: 'अन्य' },

  // Dashboard Metrics
  'dash.today_billed_sales': { en: "Today's Billed Sales", hi: 'आज की कुल बिक्री' },
  'dash.bills_generated': { en: 'bills generated today', hi: 'बिल आज बने' },
  'dash.cash_upi_realized': { en: 'Cash & UPI Realized', hi: 'नकद व UPI प्राप्ति' },
  'dash.cash': { en: 'Cash', hi: 'नकद' },
  'dash.upi': { en: 'UPI', hi: 'UPI' },
  'dash.garage_khata_due': { en: 'Garage Khata Due', hi: 'गैराज उधार / बकाया' },
  'dash.across_workshops': { en: 'Across local repair workshops', hi: 'स्थानीय वर्कशॉप्स में बकाया' },
  'dash.low_stock_spares': { en: 'Low Stock Spares', hi: 'कम स्टॉक स्पेयर पार्ट्स' },
  'dash.parts_below_threshold': { en: 'Below critical reorder threshold', hi: 'रीऑर्डर सीमा से कम' },
  
  // Dashboard Chart
  'dash.trend_title': { en: 'Daily Sales & Cash/UPI Collections Trend', hi: 'दैनिक बिक्री एवं नकद/UPI कलेक्शन ट्रेंड' },
  'dash.trend_subtitle': { en: 'Hover over any day to inspect daily billing volume vs realized cash & UPI collections', hi: 'दैनिक बिक्री और नकद/UPI वसूली देखने के लिए किसी भी दिन पर जाएं' },
  'dash.gross_billed_sales': { en: 'Gross Billed Sales', hi: 'कुल बिल बिक्री' },
  'dash.collected_cash_upi': { en: 'Collected Cash/UPI', hi: 'प्राप्त नकद / UPI' },
  'dash.billed_sales_label': { en: 'Billed Sales:', hi: 'बिल बिक्री:' },
  'dash.collected_label': { en: 'Collected:', hi: 'प्राप्ति:' },
  'dash.invoices_label': { en: 'Invoices:', hi: 'बिल संख्या:' },

  // Dashboard Sections
  'dash.garage_khata_followup': { en: 'Garage Khata Collection Follow-up', hi: 'गैराज खाता बकाया वसूली' },
  'dash.garage_khata_subtitle': { en: 'Top overdue garage accounts requiring collection', hi: 'शीर्ष बकाया गैराज खाते जिनसे वसूली आवश्यक है' },
  'dash.view_all_khata': { en: 'View All Khata', hi: 'पूरा खाता देखें' },
  'dash.critical_low_stock': { en: 'Critical Low Stock Spares', hi: 'अति-आवश्यक कम स्टॉक पार्ट्स' },
  'dash.critical_low_stock_subtitle': { en: 'Fast-moving parts requiring restock', hi: 'जल्दी बिकने वाले पार्ट्स जिन्हें स्टॉक करना आवश्यक है' },
  'dash.days_overdue': { en: 'days overdue', hi: 'दिनों से बकाया' },
  'dash.left_min': { en: 'left (Min:', hi: 'बचे हैं (न्यूनतम:' },
  'dash.whatsapp_reminder': { en: 'WhatsApp', hi: 'व्हाट्सएप तकादा' },
  'dash.quick_actions': { en: 'Quick Actions', hi: 'त्वरित कार्य' },
  'dash.generate_bill_sub': { en: 'Create GST invoice or counter bill', hi: 'जीएसटी बिल या काउंटर पर्ची बनाएं' },
  'dash.manage_parts_sub': { en: 'Check inventory stock & OEM prices', hi: 'पार्ट्स स्टॉक और OEM दाम देखें' },
  'dash.record_payment_sub': { en: 'Settle garage credit & counter cash', hi: 'उधार खाता जमा व नकद भुगतान' },

  // POS / Billing Page
  'pos.title': { en: 'Counter POS & Billing', hi: 'बिलिंग एवं काउंटर पॉइंट ऑफ सेल' },
  'pos.customer_details': { en: 'Customer Details', hi: 'ग्राहक विवरण' },
  'pos.customer_name': { en: 'Customer Name', hi: 'ग्राहक का नाम' },
  'pos.phone_number': { en: 'Phone Number', hi: 'मोबाइल नंबर' },
  'pos.vehicle_number': { en: 'Vehicle Number', hi: 'गाड़ी नंबर' },
  'pos.vehicle_model': { en: 'Vehicle Model', hi: 'गाड़ी का मॉडल' },
  'pos.payment_type': { en: 'Payment Type', hi: 'भुगतान का प्रकार' },
  'pos.cash_payment': { en: 'Cash', hi: 'नकद (Cash)' },
  'pos.upi_payment': { en: 'UPI / QR', hi: 'UPI / क्यूआर' },
  'pos.credit_khata': { en: 'Credit / Khata', hi: 'उधार खाता (Khata)' },
  'pos.split_payment': { en: 'Split / Mixed', hi: 'मिश्रित भुगतान' },
  'pos.add_item': { en: 'Add Spare Part / Service', hi: 'पार्ट या सर्विस जोड़ें' },
  'pos.search_parts': { en: 'Search Part Name, SKU or OEM Code...', hi: 'पार्ट का नाम, कोड या OEM नंबर खोजें...' },
  'pos.item_name': { en: 'Item / Part Name', hi: 'पार्ट / सामग्री का नाम' },
  'pos.hsn_sac': { en: 'HSN / SAC', hi: 'HSN कोड' },
  'pos.quantity': { en: 'Qty', hi: 'मात्रा' },
  'pos.rate': { en: 'Rate (₹)', hi: 'दर (₹)' },
  'pos.discount': { en: 'Disc %', hi: 'छूट %' },
  'pos.gst_rate': { en: 'GST %', hi: 'जीएसटी %' },
  'pos.amount': { en: 'Amount (₹)', hi: 'कुल राशि (₹)' },
  'pos.subtotal': { en: 'Subtotal', hi: 'उप-योग' },
  'pos.total_tax': { en: 'Total GST (CGST + SGST)', hi: 'कुल जीएसटी' },
  'pos.grand_total': { en: 'Grand Total', hi: 'कुल देय राशि' },
  'pos.save_and_print': { en: 'Save & Print Invoice', hi: 'बिल सहेजें व प्रिंट करें' },
  'pos.save_only': { en: 'Save Invoice', hi: 'बिल सहेजें' },
  'pos.clear_bill': { en: 'Clear / New Bill', hi: 'नया बिल बनाएं' },
  'pos.print_format': { en: 'Print Format', hi: 'प्रिंट प्रारूप' },
  'pos.thermal_slip': { en: '3-inch Thermal Receipt', hi: '3-इंच थर्मल रसीद' },
  'pos.standard_a4': { en: 'Standard A4 / A5 Tax Invoice', hi: 'मानक A4 जीएसटी बिल' },

  // Inventory & Products
  'inv.title': { en: 'Inventory & Stock Management', hi: 'इन्वेंट्री एवं स्टॉक प्रबंधन' },
  'inv.subtitle': { en: 'Track spare parts stock, adjust levels (+/-), OEM metadata, and live Postgres sync', hi: 'स्पेयर पार्ट्स स्टॉक ट्रैक करें, मात्रा बढ़ाएं/घटाएं और लाइव डेटा सिंक रखें' },
  'inv.add_product': { en: 'Add Product', hi: '+ नया पार्ट जोड़ें' },
  'inv.search_placeholder': { en: 'Search part name, OEM code, category...', hi: 'पार्ट का नाम, OEM कोड, श्रेणी खोजें...' },
  'inv.all_categories': { en: 'All Categories', hi: 'सभी श्रेणियां' },
  'inv.sku_part_no': { en: 'Part Number / SKU', hi: 'पार्ट नंबर / SKU' },
  'inv.part_name': { en: 'Part Name', hi: 'पार्ट का नाम' },
  'inv.category': { en: 'Category', hi: 'श्रेणी' },
  'inv.mrp': { en: 'MRP', hi: 'एमआरपी (MRP)' },
  'inv.cost_price': { en: 'Buy Price', hi: 'खरीद मूल्य' },
  'inv.selling_price': { en: 'Sell Price', hi: 'बिक्री मूल्य' },
  'inv.stock_qty': { en: 'In Stock', hi: 'उपलब्ध स्टॉक' },
  'inv.min_stock': { en: 'Min Reorder', hi: 'न्यूनतम सीमा' },
  'inv.actions': { en: 'Actions', hi: 'कार्य' },
  'inv.adjust_stock': { en: 'Adjust Stock', hi: 'स्टॉक घटाएं/बढ़ाएं' },
  'inv.delete_confirm': { en: 'Are you sure you want to delete this part?', hi: 'क्या आप इस पार्ट को हटाना चाहते हैं?' },
  'inv.export_csv': { en: 'Export Stock', hi: 'स्टॉक डाउनलोड' },
  'inv.import_csv': { en: 'Import CSV', hi: 'CSV अपलोड' },
  'inv.in_stock_badge': { en: 'In Stock', hi: 'स्टॉक में' },
  'inv.low_stock_badge': { en: 'Low Stock', hi: 'कम स्टॉक' },
  'inv.out_of_stock_badge': { en: 'Out of Stock', hi: 'खत्म' },

  // Customers & Khata
  'khata.title': { en: 'Customers & Garage Khata Ledger', hi: 'ग्राहक एवं गैराज खाता बही' },
  'khata.subtitle': { en: 'Manage customer credit limits, outstanding balances, and WhatsApp payment reminders', hi: 'ग्राहकों का उधार, क्रेडिट लिमिट और व्हाट्सएप तकादा प्रबंधित करें' },
  'khata.add_customer': { en: 'Add Customer / Garage', hi: '+ नया ग्राहक / गैराज जोड़ें' },
  'khata.search_customer': { en: 'Search customer name, garage, phone...', hi: 'ग्राहक का नाम, गैराज, मोबाइल नंबर खोजें...' },
  'khata.customer_name': { en: 'Customer / Garage Name', hi: 'ग्राहक / गैराज का नाम' },
  'khata.type': { en: 'Type', hi: 'प्रकार' },
  'khata.phone': { en: 'Phone Number', hi: 'मोबाइल नंबर' },
  'khata.gstin': { en: 'GSTIN', hi: 'जीएसटी नंबर' },
  'khata.current_balance': { en: 'Due Balance', hi: 'बकाया राशि' },
  'khata.credit_limit': { en: 'Credit Limit', hi: 'क्रेडिट सीमा' },
  'khata.record_payment': { en: 'Receive Payment', hi: 'भुगतान प्राप्त करें' },
  'khata.view_ledger': { en: 'View Ledger', hi: 'खाता बही देखें' },
  'khata.whatsapp_alert': { en: 'Send Reminder', hi: 'तकादा भेजें' },
  'khata.settle_amount': { en: 'Payment Amount (₹)', hi: 'जमा राशि (₹)' },
  'khata.payment_mode': { en: 'Payment Mode', hi: 'भुगतान माध्यम' },

  // Invoices Page
  'invs.title': { en: 'Invoices & Billing History', hi: 'बिल एवं इनवॉइस इतिहास' },
  'invs.subtitle': { en: 'Inspect sales invoices, print tax duplicates, and review settlement status', hi: 'सभी बिक्री बिल देखें, प्रिंट निकालें और भुगतान स्थिति जांचें' },
  'invs.invoice_no': { en: 'Invoice #', hi: 'बिल नंबर' },
  'invs.date': { en: 'Date', hi: 'तारीख' },
  'invs.customer': { en: 'Customer', hi: 'ग्राहक' },
  'invs.items_count': { en: 'Items', hi: 'आइटम' },
  'invs.total_amount': { en: 'Total Amount', hi: 'कुल रकम' },
  'invs.status': { en: 'Status', hi: 'स्थिति' },
  'invs.paid': { en: 'PAID', hi: 'चुकाया गया' },
  'invs.unpaid': { en: 'UNPAID', hi: 'बकाया' },
  'invs.partial': { en: 'PARTIAL', hi: 'आंशिक' },
  'invs.view_print': { en: 'View & Print', hi: 'देखें व प्रिंट करें' },

  // Finance & Reports
  'fin.title': { en: 'Daily Financial Settlement & Cash Register', hi: 'दैनिक वित्तीय हिसाब व कैश रजिस्टर' },
  'fin.subtitle': { en: 'End of day counter reconciliation, cash vs UPI breakdown, and daily summary', hi: 'दुकान बंद करते समय कैश और UPI का मिलान' },
  'fin.closing_cash': { en: 'Counter Cash in Hand', hi: 'गल्ले में नकद राशि' },
  'fin.closing_upi': { en: 'Total UPI Collected', hi: 'कुल प्राप्त UPI' },
  'fin.khata_given': { en: 'Today Credit Given', hi: 'आज दिया गया उधार' },
  'fin.khata_recovered': { en: 'Today Khata Collected', hi: 'आज पुराना उधार वसूली' },
  'fin.daybook': { en: 'Daybook Entries', hi: 'दैनिक रोकड़ बही (Daybook)' },
  'fin.gstr1': { en: 'GSTR-1 Summary', hi: 'जीएसटीआर-1 सारांश' },
  'fin.gstr3b': { en: 'GSTR-3B Tax Report', hi: 'जीएसटीआर-3B टैक्स रिपोर्ट' },
  'fin.export_excel': { en: 'Export Excel Report', hi: 'एक्सेल में डाउनलोड करें' },

  // Settings Page
  'set.title': { en: 'Dealership & Workshop Settings', hi: 'डीलरशिप एवं वर्कशॉप सेटिंग्स' },
  'set.subtitle': { en: 'Configure business details, GSTIN, thermal printer preferences, and full database backups', hi: 'व्यापार का नाम, पता, जीएसटी, प्रिंटर और डेटाबेस बैकअप सेटिंग्स' },
  'set.shop_name': { en: 'Showroom / Shop Name', hi: 'दुकान / शोरूम का नाम' },
  'set.tagline': { en: 'Tagline / Dealership Line', hi: 'टैगलाइन / उप-नाम' },
  'set.phone': { en: 'Contact Phone', hi: 'संपर्क फोन' },
  'set.email': { en: 'Business Email', hi: 'ईमेल' },
  'set.address': { en: 'Shop Address', hi: 'दुकान का पता' },
  'set.state': { en: 'State', hi: 'राज्य' },
  'set.gstin': { en: 'GSTIN Number', hi: 'जीएसटी नंबर (GSTIN)' },
  'set.invoice_prefix': { en: 'Invoice Series Prefix', hi: 'बिल नंबर प्रीफिक्स (उदा: AP-)' },
  'set.save_settings': { en: 'Save Configuration', hi: 'सेटिंग्स सुरक्षित करें' },
  'set.backup_section': { en: 'Database Backup & Crash Recovery', hi: 'डेटा बैकअप एवं रिकवरी' },
  'set.backup_sub': { en: 'Download entire system database or restore from previously saved backup JSON file', hi: 'पूरा डेटा सुरक्षित डाउनलोड करें या पहले से मौजूद बैकअप फाइल रीस्टोर करें' },
  'set.download_backup': { en: 'Download Complete System Backup', hi: 'पूरा बैकअप डाउनलोड करें' },
  'set.restore_backup': { en: 'Restore Database from File', hi: 'बैकअप फाइल से डेटा रीस्टोर करें' },

  // Common UI words
  'common.save': { en: 'Save', hi: 'सहेजें' },
  'common.cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'common.delete': { en: 'Delete', hi: 'हटाएं' },
  'common.edit': { en: 'Edit', hi: 'संपादित करें' },
  'common.search': { en: 'Search', hi: 'खोजें' },
  'common.add': { en: 'Add', hi: 'जोड़ें' },
  'common.all': { en: 'All', hi: 'सभी' },
  'common.filter': { en: 'Filter', hi: 'फ़िल्टर' },
  'common.refresh': { en: 'Refresh', hi: 'ताज़ा करें' },
  'common.total': { en: 'Total', hi: 'कुल' },
  'common.success': { en: 'Success', hi: 'सफल' },
  'common.error': { en: 'Error', hi: 'त्रुटि' },
  'common.loading': { en: 'Loading...', hi: 'लोड हो रहा है...' },
  'common.no_data': { en: 'No data found', hi: 'कोई जानकारी नहीं मिली' },
  'common.language': { en: 'Language', hi: 'भाषा' },
  'common.english': { en: 'English', hi: 'अंग्रेज़ी' },
  'common.hindi': { en: 'हिन्दी', hi: 'हिन्दी' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, defaultFallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('autoledger_language') as Language;
      if (savedLang === 'hi' || savedLang === 'en') {
        setLanguageState(savedLang);
      }
    } catch (e) {
      console.warn('Could not read language from localStorage:', e);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('autoledger_language', lang);
    } catch (e) {
      console.warn('Could not save language to localStorage:', e);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
  };

  const t = (key: string, defaultFallback?: string): string => {
    const entry = dictionary[key];
    if (entry && entry[language]) {
      return entry[language];
    }
    return defaultFallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
