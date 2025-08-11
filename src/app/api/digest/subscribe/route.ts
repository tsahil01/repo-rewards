import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Digest subscription schema
const DigestSubscribeSchema = z.object({
    frequency: z.enum(['daily', 'weekly']).default('daily'),
    filters: z.object({
        languages: z.array(z.string()).optional(),
        labels: z.array(z.string()).optional(),
        minStars: z.number().min(0).optional(),
        orgs: z.array(z.string()).optional(),
        repos: z.array(z.string()).optional(),
    }).optional(),
});

export async function POST(request: NextRequest) {
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
        const validatedData = DigestSubscribeSchema.parse(body);

        // Set default filters if not provided
        const defaultFilters = {
            languages: [],
            labels: ['bounty', 'reward', 'help wanted', 'good first issue', 'bug'],
            minStars: 10,
            orgs: [],
            repos: [],
            ...validatedData.filters
        };

        // Create or update digest subscription
        const subscription = await prisma.digestSubscription.upsert({
            where: {
                userId: session.user.id
            },
            update: {
                frequency: validatedData.frequency,
                filters: defaultFilters,
                updatedAt: new Date()
            },
            create: {
                userId: session.user.id,
                frequency: validatedData.frequency,
                filters: defaultFilters
            }
        });

        return NextResponse.json({
            message: 'Digest subscription created/updated successfully',
            subscription
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid request data', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Digest subscribe error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
