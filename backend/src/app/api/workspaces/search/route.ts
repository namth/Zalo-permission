import { NextRequest, NextResponse } from 'next/server';
import { searchWorkspacesByName } from '@/services/workspace.service';

/**
 * GET /api/workspaces/search - Search workspaces by name using trigram similarity
 *
 * Query Parameters:
 * - name (required): Workspace name to search
 * - limit (optional): Max results (default: 20, max: 100)
 * - threshold (optional): Similarity threshold (default: 0.3, range: 0-1)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const name = searchParams.get('name');

    // Validate required parameter
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_PARAM',
          message: 'Parameter "name" is required and cannot be empty'
        },
        { status: 400 }
      );
    }

    // Parse optional parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const threshold = parseFloat(searchParams.get('threshold') || '0.3');

    // Validate threshold
    if (threshold < 0 || threshold > 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_PARAM',
          message: 'Parameter "threshold" must be between 0 and 1'
        },
        { status: 400 }
      );
    }

    // Search workspaces
    const { workspaces, total } = await searchWorkspacesByName(name, limit, threshold);

    return NextResponse.json(
      {
        success: true,
        data: workspaces,
        pagination: {
          limit,
          total,
          hasMore: workspaces.length === limit
        },
        search: {
          query: name,
          threshold,
          method: 'trigram_similarity'
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error searching workspaces:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'SEARCH_FAILED',
        message: error.message || 'Failed to search workspaces'
      },
      { status: 500 }
    );
  }
}
