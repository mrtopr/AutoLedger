import { z } from 'zod';
import { CreditStatus, CustomerType } from '@prisma/client';

export const CustomerTypeEnum = z.enum([
  'GARAGE',
  'WORKSHOP',
  'RETAILER',
  'DISTRIBUTOR',
  'WHOLESALER',
  'WALK_IN',
]);

export const CreditStatusEnum = z.enum([
  'GREEN',
  'YELLOW',
  'RED',
  'BLOCKED',
  'ALL',
]);

export const CreateCustomerSchema = z.object({
  name: z.string().trim().optional(),
  shopName: z.string().trim().optional(),
  phone: z.string().trim().min(3, 'Phone number required'),
  address: z.string().trim().optional().nullable(),
  gstin: z.string().trim().optional().nullable(),
  creditLimitPaise: z.union([z.number(), z.string(), z.bigint()]).optional(),
  creditLimitRupees: z.union([z.number(), z.string()]).optional(),
  paymentTermsDays: z.coerce.number().int().nonnegative().optional().default(15),
  customerType: z.string().optional().default('RETAILER'),
  openingBalancePaise: z.union([z.number(), z.string(), z.bigint()]).optional().default('0'),
  openingBalanceType: z.enum(['DUE', 'ADVANCE']).optional().default('DUE'),
  openingBalanceDate: z.string().optional().nullable(),
  openingBalanceNarration: z.string().optional().nullable(),
}).refine((data) => Boolean(data.name || data.shopName), {
  message: 'Customer name or shop name is required',
  path: ['name'],
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export interface CustomerDTO {
  id: string;
  name: string;
  shopName: string;
  phone: string;
  address?: string | null;
  gstin: string | null;
  customerType: string;
  balancePaise: string;
  creditLimitPaise: string;
  status: string;
  termsDays: number;
  overduePaise: string;
  lastOrderDaysAgo: number;
}
