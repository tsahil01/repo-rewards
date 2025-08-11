import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
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

        // Parse request body for additional data
        const body = await request.json();
        const { issueData } = body; // Expect issue data from frontend

        if (!issueData) {
            return NextResponse.json(
                { error: 'Issue data is required' },
                { status: 400 }
            );
        }

        // Create or update user issue record
        const userIssue = await prisma.userIssue.upsert({
            where: {
                userId_githubIssueId: {
                    userId: session.user.id,
                    githubIssueId: params.id
                }
            },
            update: {
                status: 'saved',
                updatedAt: new Date()
            },
            create: {
                userId: session.user.id,
                githubIssueId: params.id,
                repoFullName: issueData.repoFullName || 'unknown/repo',
                issueNumber: issueData.number || 0,
                status: 'saved'
            }
        });

        return NextResponse.json({
            message: 'Issue saved successfully',
            userIssue
        });

    } catch (error) {
        console.error('Save issue error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
