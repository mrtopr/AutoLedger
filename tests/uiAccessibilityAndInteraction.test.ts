import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Fix 17: Visual Polish, Accessibility & Interaction QA', () => {
  const rootDir = process.cwd();

  it('verifies app/globals.css has prefers-reduced-motion and accessible :focus-visible tokens', () => {
    const cssPath = path.join(rootDir, 'app/globals.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Motion sensitivity & reduced motion accessibility
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation-duration: 0.01ms !important');
    expect(css).toContain('transition-duration: 0.01ms !important');

    // Keyboard focus indicators
    expect(css).toContain(':focus-visible');
    expect(css).toContain('outline: 2px solid #C81E1E');
    expect(css).toContain('outline-offset: 2px');

    // Single-page A4 print styles without misleading GST tax claims
    expect(css).toContain('SINGLE-PAGE A4 PROFESSIONAL SALES BILL & REPORT PRINT STYLES');
  });

  it('verifies InvoicePreviewModal has full dialog accessibility and Escape key handler', () => {
    const code = fs.readFileSync(path.join(rootDir, 'app/components/InvoicePreviewModal.tsx'), 'utf8');

    expect(code).toContain('role="dialog"');
    expect(code).toContain('aria-modal="true"');
    expect(code).toContain('aria-labelledby="invoice-preview-modal-title"');
    expect(code).toContain('id="invoice-preview-modal-title"');
    expect(code).toContain('aria-label="Close bill preview"');
    expect(code).toContain("e.key === 'Escape'");
  });

  it('verifies ZReportModal has dialog accessibility and Escape key handler', () => {
    const code = fs.readFileSync(path.join(rootDir, 'app/components/ZReportModal.tsx'), 'utf8');

    expect(code).toContain('role="dialog"');
    expect(code).toContain('aria-modal="true"');
    expect(code).toContain('aria-labelledby="zreport-modal-title"');
    expect(code).toContain('id="zreport-modal-title"');
    expect(code).toContain('aria-label="Close day-end report"');
    expect(code).toContain("e.key === 'Escape'");
  });

  it('verifies AddCustomerModal and EditCustomerModal accessibility and Escape handling', () => {
    const addCode = fs.readFileSync(path.join(rootDir, 'app/components/AddCustomerModal.tsx'), 'utf8');
    const editCode = fs.readFileSync(path.join(rootDir, 'app/components/EditCustomerModal.tsx'), 'utf8');

    expect(addCode).toContain('role="dialog"');
    expect(addCode).toContain('aria-modal="true"');
    expect(addCode).toContain('aria-labelledby="add-customer-modal-title"');
    expect(addCode).toContain('id="add-customer-modal-title"');
    expect(addCode).toContain('aria-label="Close add customer dialog"');
    expect(addCode).toContain("e.key === 'Escape'");

    expect(editCode).toContain('role="dialog"');
    expect(editCode).toContain('aria-modal="true"');
    expect(editCode).toContain('aria-labelledby="edit-customer-modal-title"');
    expect(editCode).toContain('id="edit-customer-modal-title"');
    expect(editCode).toContain('aria-label="Close edit customer dialog"');
    expect(editCode).toContain("e.key === 'Escape'");
    expect(editCode).toContain('rounded-2xl');
  });

  it('verifies RazorpayModal has dialog accessibility and Escape key handler', () => {
    const code = fs.readFileSync(path.join(rootDir, 'app/components/RazorpayModal.tsx'), 'utf8');

    expect(code).toContain('role="dialog"');
    expect(code).toContain('aria-modal="true"');
    expect(code).toContain('aria-labelledby="razorpay-modal-title"');
    expect(code).toContain('aria-label="Close payment gateway dialog"');
    expect(code).toContain("e.key === 'Escape'");
  });

  it('verifies AddLedgerEntryModal and BulkOpeningBalanceModal accessibility and Escape handling', () => {
    const ledgerCode = fs.readFileSync(path.join(rootDir, 'app/components/AddLedgerEntryModal.tsx'), 'utf8');
    const bulkCode = fs.readFileSync(path.join(rootDir, 'app/components/BulkOpeningBalanceModal.tsx'), 'utf8');

    expect(ledgerCode).toContain('role="dialog"');
    expect(ledgerCode).toContain('aria-modal="true"');
    expect(ledgerCode).toContain('aria-labelledby="add-ledger-entry-title"');
    expect(ledgerCode).toContain('id="add-ledger-entry-title"');
    expect(ledgerCode).toContain('aria-label="Close modal"');
    expect(ledgerCode).toContain("e.key === 'Escape'");

    expect(bulkCode).toContain('role="dialog"');
    expect(bulkCode).toContain('aria-modal="true"');
    expect(bulkCode).toContain('aria-labelledby="bulk-opening-balance-title"');
    expect(bulkCode).toContain('id="bulk-opening-balance-title"');
    expect(bulkCode).toContain('aria-label="Close modal"');
    expect(bulkCode).toContain("e.key === 'Escape'");
  });

  it('verifies BulkImportModal and CommandPalette accessibility and Escape handling', () => {
    const importCode = fs.readFileSync(path.join(rootDir, 'app/components/BulkImportModal.tsx'), 'utf8');
    const paletteCode = fs.readFileSync(path.join(rootDir, 'app/components/CommandPalette.tsx'), 'utf8');

    expect(importCode).toContain('role="dialog"');
    expect(importCode).toContain('aria-modal="true"');
    expect(importCode).toContain('aria-labelledby="bulk-import-modal-title"');
    expect(importCode).toContain('id="bulk-import-modal-title"');
    expect(importCode).toContain('aria-label="Close bulk import dialog"');
    expect(importCode).toContain("e.key === 'Escape'");

    expect(paletteCode).toContain('role="dialog"');
    expect(paletteCode).toContain('aria-modal="true"');
    expect(paletteCode).toContain('aria-label="Quick search and command palette"');
    expect(paletteCode).toContain("e.key === 'Escape'");
  });

  it('verifies InventoryPage modals have dialog accessibility and Escape key handler', () => {
    const code = fs.readFileSync(path.join(rootDir, 'app/inventory/page.tsx'), 'utf8');

    expect(code).toContain('role="dialog"');
    expect(code).toContain('aria-modal="true"');
    expect(code).toContain('aria-labelledby="add-part-title"');
    expect(code).toContain('aria-labelledby="adjust-stock-title"');
    expect(code).toContain('aria-labelledby="edit-part-title"');
    expect(code).toContain('aria-labelledby="delete-part-title"');
    expect(code).toContain('aria-labelledby="bulk-delete-title"');
    expect(code).toContain("e.key === 'Escape'");
  });

  it('verifies POS page success modal and search have Escape key handling and dialog accessibility', () => {
    const code = fs.readFileSync(path.join(rootDir, 'app/pos/page.tsx'), 'utf8');

    expect(code).toContain('role="dialog"');
    expect(code).toContain('aria-modal="true"');
    expect(code).toContain('aria-labelledby="pos-success-modal-title"');
    expect(code).toContain('id="pos-success-modal-title"');
    expect(code).toContain('aria-label="Close bill confirmation"');
    expect(code).toContain("e.key === 'Escape'");
  });

  it('verifies InvoicesPage cancellation modal has dialog accessibility and Escape key handler', () => {
    const code = fs.readFileSync(path.join(rootDir, 'app/invoices/page.tsx'), 'utf8');

    expect(code).toContain('role="dialog"');
    expect(code).toContain('aria-modal="true"');
    expect(code).toContain('aria-labelledby="cancel-invoice-title"');
    expect(code).toContain('id="cancel-invoice-title"');
    expect(code).toContain("e.key === 'Escape'");
  });

  it('verifies Sidebar mobile drawer handles Escape key and has accessible label', () => {
    const code = fs.readFileSync(path.join(rootDir, 'app/components/Sidebar.tsx'), 'utf8');

    expect(code).toContain('aria-label="Sidebar Navigation"');
    expect(code).toContain("e.key === 'Escape'");
  });

  it('verifies Settings page design token consistency (no rounded-none cards)', () => {
    const code = fs.readFileSync(path.join(rootDir, 'app/settings/page.tsx'), 'utf8');

    // Cards should not have rounded-none
    expect(code).not.toContain('rounded-none p-4');
    expect(code).not.toContain('rounded-none p-5');
  });
});
