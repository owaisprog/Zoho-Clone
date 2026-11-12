/**
 * This is a process liveness response, NOT a production readiness check.
 * Database, authentication, and tenant isolation have not been implemented.
 */
export interface HealthResponse {
  status: 'ok';
  service: 'business-os-api';
  checkedAt: string;
  database: 'not_configured';
}

export function createHealthResponse(now: Date = new Date()): HealthResponse {
  return {
    status: 'ok',
    service: 'business-os-api',
    checkedAt: now.toISOString(),
    database: 'not_configured'
  };
}
