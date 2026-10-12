import { NextRequest, NextResponse } from 'next/server';
import { prisma, isPostgresAvailable } from '@/server/lib/prisma';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { localStore } from '@/server/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const tenantId = authUser?.tenantId || localStore.getTenants()[0]?.id || 'tenant-default';

    const notifications: Array<{
      id: string;
      type: 'LOW_STOCK' | 'OVERDUE' | 'INVOICE' | 'SETTLEMENT';
      title: string;
      message: string;
      timestamp: string;
      timeAgo: string;
      actionUrl: string;
      actionLabel: string;
      severity: 'warning' | 'danger' | 'info' | 'success';
      read: boolean;
    }> = [];

    // 1. Fetch low-stock products from localStore or Postgres
    const products = localStore.getProducts(tenantId);
    const lowStockItems = products
      .filter((p) => Number(p.stockQty || 0) <= Number(p.reorderLevel || 5))
      .slice(0, 3);

    lowStockItems.forEach((p, idx) => {
      notifications.push({
        id: `notif-stock-${p.id || idx}`,
        type: 'LOW_STOCK',
        title: `Low Stock: ${p.name}`,
        message: `Only ${p.stockQty} ${p.unit || 'pcs'} left in inventory. Reorder threshold is ${p.reorderLevel}.`,
        timestamp: p.createdAt || new Date().toISOString(),
        timeAgo: 'Attention Needed',
        actionUrl: '/inventory',
        actionLabel: 'Reorder Stock',
        severity: 'danger',
        read: false,
      });
    });

    // 2. Fetch overdue customer accounts
    const customers = localStore.getCustomers(tenantId);
    const overdueCustomers = customers
      .filter((c) => BigInt(c.overduePaise || '0') > 0n || BigInt(c.balancePaise || '0') > 500000n)
      .slice(0, 3);

    overdueCustomers.forEach((c, idx) => {
      const balanceRupees = Math.round(Number(c.balancePaise || '0') / 100);
      notifications.push({
        id: `notif-overdue-${c.id || idx}`,
        type: 'OVERDUE',
        title: `Khata Due: ${c.shopName || c.name}`,
        message: `Pending credit balance of ₹${balanceRupees.toLocaleString('en-IN')} is awaiting collection.`,
        timestamp: c.createdAt || new Date().toISOString(),
        timeAgo: `${c.termsDays || 15}d Terms`,
        actionUrl: '/customers',
        actionLabel: 'View Statement',
        severity: 'warning',
        read: false,
      });
    });

    // 3. Fetch latest invoices
    const invoices = localStore.getInvoices(tenantId).slice(0, 2);
    invoices.forEach((inv, idx) => {
      const totalRupees = Math.round(Number(inv.grandTotalPaise || '0') / 100);
      notifications.push({
        id: `notif-inv-${inv.id || idx}`,
        type: 'INVOICE',
        title: `Invoice #${inv.invoiceNumber} Generated`,
        message: `Sale total ₹${totalRupees.toLocaleString('en-IN')} processed successfully.`,
        timestamp: inv.createdAt || new Date().toISOString(),
        timeAgo: 'Recent Sale',
        actionUrl: '/invoices',
        actionLabel: 'View Invoice',
        severity: 'info',
        read: true,
      });
    });

    // 4. Day-end settlement reminder
    notifications.push({
      id: 'notif-settle-daily',
      type: 'SETTLEMENT',
      title: 'Daily Cash Drawer Reconciliation',
      message: 'Remember to verify UPI collections and count physical cash at shift close.',
      timestamp: new Date().toISOString(),
      timeAgo: 'Daily Task',
      actionUrl: '/settlement',
      actionLabel: 'Close Register',
      severity: 'warning',
      read: false,
    });

    return NextResponse.json({
      success: true,
      unreadCount: notifications.filter((n) => !n.read).length,
      notifications,
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({
      success: false,
      unreadCount: 0,
      notifications: [],
    });
  }
}
