import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Digest subscription update schema
const DigestUpdateSchema = z.object({
    frequency: z.enum(['daily', 'weekly']).optional(),
    filters: z.object({
        languages: z.array(z.string()).optional(),
        labels: z.array(z.string()).optional(),
        minStars: z.number().min(0).optional(),
        orgs: z.array(z.string()).optional(),
        repos: z.array(z.string()).optional(),
    }).optional(),
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

        // Get user's digest subscription
        const subscription = await prisma.digestSubscription.findUnique({
            where: {
                userId: session.user.id
            }
        });

        if (!subscription) {
            return NextResponse.json(
                { error: 'No digest subscription found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            subscription
        });

    } catch (error) {
        console.error('Get digest subscription error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
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
        const validatedData = DigestUpdateSchema.parse(body);

        // Update digest subscription
        const subscription = await prisma.digestSubscription.update({
            where: {
                userId: session.user.id
            },
            data: {
                ...validatedData,
                updatedAt: new Date()
            }
        });

        return NextResponse.json({
            message: 'Digest subscription updated successfully',
            subscription
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid request data', details: error.issues },
                { status: 400 }
            );
        }

        if (error instanceof Error && error.message.includes('Record to update not found')) {
            return NextResponse.json(
                { error: 'No digest subscription found. Please subscribe first.' },
                { status: 404 }
            );
        }

        console.error('Update digest subscription error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
