import { NextResponse } from 'next/server';
import { pingDatabases } from '@/lib/cron/keep-alive';

export const dynamic = 'force-dynamic';

export async function GET() {
  const report = await pingDatabases();
  const statusCode = report.status === 'healthy' ? 200 : report.status === 'degraded' ? 207 : 503;

  return NextResponse.json(report, { status: statusCode });
}

export async function POST() {
  return GET();
}
