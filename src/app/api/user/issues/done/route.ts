import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Query parameter validation schema
const DoneIssuesQuerySchema = z.object({
    page: z.string().transform(Number).pipe(z.number().min(1)).optional().default(() => 1),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).optional().default(() => 10),
});

export async function GET(request: NextRequest) {
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

        // Parse and validate query parameters
        const { searchParams } = new URL(request.url);
        const queryData = Object.fromEntries(searchParams.entries());
        const validatedQuery = DoneIssuesQuerySchema.parse(queryData);

        // Get completed issues with pagination
        const [doneIssues, total] = await Promise.all([
            prisma.userIssue.findMany({
                where: {
                    userId: session.user.id,
                    status: 'done'
                },
                include: {
                    issue: {
                        select: {
                            id: true,
                            title: true,
                            repoFullName: true,
                            htmlUrl: true,
                            labels: true,
                            language: true,
                            stars: true,
                            isBounty: true,
                            bountyAmountMin: true,
                            bountyAmountMax: true,
                            currency: true,
                            score: true,
                            openedAt: true,
                            updatedAt: true,
                        }
                    }
                },
                orderBy: {
                    updatedAt: 'desc'
                },
                skip: (validatedQuery.page - 1) * validatedQuery.limit,
                take: validatedQuery.limit,
            }),
            prisma.userIssue.count({
                where: {
                    userId: session.user.id,
                    status: 'done'
                }
            })
        ]);

        return NextResponse.json({
            doneIssues,
            pagination: {
                page: validatedQuery.page,
                limit: validatedQuery.limit,
                total,
                totalPages: Math.ceil(total / validatedQuery.limit)
            }
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid query parameters', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Done issues error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
