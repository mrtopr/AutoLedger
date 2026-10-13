/**
 * B2B Customer Credit Scoring Engine
 * Computes a standardized 300 - 900 credit score based on:
 * 1. Repayment history & overdue aging (35% weight)
 * 2. Credit limit utilization ratio (30% weight)
 * 3. Purchase & transaction volume (20% weight)
 * 4. Relationship tenure & on-time payment track record (15% weight)
 */

export interface CreditScoreDriver {
  text: string;
  type: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

export interface CreditScoreResult {
  score: number; // 300 to 900
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'HIGH_RISK';
  label: string;
  ratingLabel: string;
  color: 'emerald' | 'blue' | 'amber' | 'rose';
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  utilizationPct: number;
  factors: {
    positive: string[];
    negative: string[];
  };
  drivers: CreditScoreDriver[];
}

export interface CustomerCreditInput {
  balancePaise: string | bigint | number;
  creditLimitPaise?: string | bigint | number;
  overduePaise?: string | bigint | number;
  daysOverdue?: number;
  invoicesCount?: number;
  totalBilledPaise?: string | bigint | number;
  paidOnTimeRate?: number; // 0 to 100
  termsDays?: number;
}

export function calculateCustomerCreditScore(input: CustomerCreditInput): CreditScoreResult {
  const balance = BigInt(input.balancePaise || 0);
  const creditLimit = BigInt(input.creditLimitPaise || 5000000); // Default 50,000 INR
  const overdue = BigInt(input.overduePaise || 0);
  const daysOverdue = input.daysOverdue || 0;
  const invoicesCount = input.invoicesCount || 1;
  const onTimeRate = input.paidOnTimeRate !== undefined ? input.paidOnTimeRate : 90;

  // 1. Base Score starts at 650 (Standard Medium-Good baseline)
  let score = 650;
  const positive: string[] = [];
  const negative: string[] = [];

  // 2. Credit Limit Utilization (30% weight, max +/- 120 pts)
  let utilizationPct = 0;
  if (creditLimit > 0n) {
    if (balance <= 0n) {
      utilizationPct = 0;
      score += 80;
      positive.push('Zero debt: 0% credit limit utilized');
    } else {
      utilizationPct = Math.min(150, Math.round(Number((balance * 100n) / creditLimit)));
      if (utilizationPct < 30) {
        score += 70;
        positive.push(`Low credit utilization (${utilizationPct}%)`);
      } else if (utilizationPct <= 60) {
        score += 30;
        positive.push(`Healthy credit utilization (${utilizationPct}%)`);
      } else if (utilizationPct <= 85) {
        score -= 20;
        negative.push(`Moderate-high credit usage (${utilizationPct}%)`);
      } else if (utilizationPct <= 100) {
        score -= 60;
        negative.push(`Near credit limit limit (${utilizationPct}%)`);
      } else {
        score -= 110;
        negative.push(`Exceeded sanctioned credit limit (${utilizationPct}%)`);
      }
    }
  }

  // 3. Repayment & Overdue Aging (35% weight, max +/- 150 pts)
  if (balance <= 0n) {
    score += 50;
    positive.push('Advance / Nil outstanding balance');
  } else if (overdue > 0n || daysOverdue > 0) {
    if (daysOverdue > 60) {
      score -= 140;
      negative.push(`Severe payment delay (>60 days overdue)`);
    } else if (daysOverdue > 30) {
      score -= 90;
      negative.push(`Critical overdue payment (${daysOverdue} days past terms)`);
    } else if (daysOverdue > 15) {
      score -= 50;
      negative.push(`Payment delayed (${daysOverdue} days past due date)`);
    } else {
      score -= 20;
      negative.push(`Short-term balance due (${daysOverdue} days)`);
    }
  } else {
    score += 40;
    positive.push('Payment within terms (0 overdue days)');
  }

  // 4. On-Time Payment Rate (15% weight, max +/- 50 pts)
  if (onTimeRate >= 95) {
    score += 40;
    positive.push('Exceptional repayment reliability (95%+ on-time)');
  } else if (onTimeRate >= 80) {
    score += 20;
    positive.push('Consistent repayment track record');
  } else if (onTimeRate < 60) {
    score -= 40;
    negative.push('Frequent payment delays recorded');
  }

  // 5. Purchasing & Transaction Volume (20% weight, max +/- 40 pts)
  if (invoicesCount >= 20) {
    score += 35;
    positive.push('High-frequency repeat wholesale customer');
  } else if (invoicesCount >= 5) {
    score += 20;
    positive.push('Established order track record');
  }

  // Clamp score between 300 and 900
  score = Math.max(300, Math.min(900, Math.round(score)));

  const drivers: CreditScoreDriver[] = [
    ...positive.map((text) => ({ text, type: 'POSITIVE' as const })),
    ...negative.map((text) => ({ text, type: 'NEGATIVE' as const })),
  ];
  if (drivers.length === 0) {
    drivers.push({ text: 'Standard transaction profile', type: 'NEUTRAL' as const });
  }

  // Rating Bands
  if (score >= 750) {
    return {
      score,
      rating: 'EXCELLENT',
      color: 'emerald',
      ratingLabel: 'Prime (Low Risk)',
      label: 'Prime (Low Risk)',
      colorClass: 'text-emerald-700',
      badgeBg: 'bg-emerald-50 border-emerald-200',
      badgeText: 'text-emerald-700',
      utilizationPct,
      factors: { positive, negative },
      drivers,
    };
  }

  if (score >= 650) {
    return {
      score,
      rating: 'GOOD',
      color: 'blue',
      ratingLabel: 'Good (Healthy)',
      label: 'Good (Healthy)',
      colorClass: 'text-blue-700',
      badgeBg: 'bg-blue-50 border-blue-200',
      badgeText: 'text-blue-700',
      utilizationPct,
      factors: { positive, negative },
      drivers,
    };
  }

  if (score >= 550) {
    return {
      score,
      rating: 'FAIR',
      color: 'amber',
      ratingLabel: 'Fair (Watchlist)',
      label: 'Fair (Watchlist)',
      colorClass: 'text-amber-700',
      badgeBg: 'bg-amber-50 border-amber-200',
      badgeText: 'text-amber-700',
      utilizationPct,
      factors: { positive, negative },
      drivers,
    };
  }

  return {
    score,
    rating: 'HIGH_RISK',
    color: 'rose',
    ratingLabel: 'High Risk (Overdue / Restrict)',
    label: 'High Risk (Overdue / Restrict)',
    colorClass: 'text-rose-700',
    badgeBg: 'bg-rose-50 border-rose-200',
    badgeText: 'text-rose-700',
    utilizationPct,
    factors: { positive, negative },
    drivers,
  };
}
