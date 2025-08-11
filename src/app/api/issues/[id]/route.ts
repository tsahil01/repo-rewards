import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Implement single issue logic
    // - Get issue by ID
    // - Return issue details with bounty info
    
    return NextResponse.json({ message: 'Single issue endpoint', id: params.id });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
