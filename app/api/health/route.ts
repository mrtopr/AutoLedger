import { GET as getV1Health } from '@/app/api/v1/health/route';

export const dynamic = 'force-dynamic';

/**
 * Standard /api/health alias for cloud container orchestrators (Kubernetes, AWS ECS, GCP Cloud Run)
 * Delegates to the secure /api/v1/health handler.
 */
export async function GET() {
  return getV1Health();
}
