/**
 * Next.js Instrumentation hook
 * Runs on server start to bootstrap background tasks like keep-alive.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startKeepAliveCron } = await import('@/lib/cron/keep-alive');
    // Ping every 10 minutes (prevents Neo4j Aura 3-day sleep and Supabase 7-day sleep)
    startKeepAliveCron(10);
  }
}
