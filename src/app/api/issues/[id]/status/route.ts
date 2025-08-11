import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Status update validation schema
const StatusUpdateSchema = z.object({
    status: z.enum(['saved', 'started', 'done']),
});

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const validatedData = StatusUpdateSchema.parse(body);

        // Update or create user issue record
        const userIssue = await prisma.userIssue.upsert({
            where: {
                userId_githubIssueId: {
                    userId: session.user.id,
                    githubIssueId: params.id
                }
            },
            update: {
                status: validatedData.status,
                updatedAt: new Date()
            },
            create: {
                userId: session.user.id,
                githubIssueId: params.id,
                repoFullName: 'unknown/repo', // Will be updated when we have repo context
                issueNumber: 0, // Will be updated when we have repo context
                status: validatedData.status
            }
        });

        return NextResponse.json({
            message: `Issue status updated to ${validatedData.status}`,
            userIssue
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid status value', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Update issue status error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
