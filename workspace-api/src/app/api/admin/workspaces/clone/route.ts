import { NextRequest, NextResponse } from 'next/server';
import { cloneWorkspace } from '@/services/workspace.service';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { source_id, new_name } = body;

    if (!source_id || !new_name) {
      return NextResponse.json(
        { success: false, error: 'Missing source_id or new_name' },
        { status: 400 }
      );
    }

    logger.info(`[API] Cloning workspace ${source_id} to ${new_name}`);
    
    // In a real app, you might want to get the user ID from the session
    const workspace = await cloneWorkspace(source_id, new_name);

    return NextResponse.json({
      success: true,
      data: workspace
    });
  } catch (error: any) {
    logger.error(`[API] Error cloning workspace: ${error.message}`);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
