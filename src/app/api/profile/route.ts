import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(request: NextRequest) {
    try {
        // TODO: Implement get profile logic
        // - Get user from session
        // - Return user profile data

        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const profile = await prisma.profile.findUnique({
            where: {
                userId: session.user.id
            }
        });

        if (!profile) {
            return NextResponse.json(
                { error: 'Profile not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ message: 'Get profile endpoint', profile });
    } catch (error) {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

const ProfileUpdateSchema = z.object({
    primaryLanguages: z.array(z.string()).min(1).max(5),
    topics: z.array(z.string()).optional(),
    followedRepos: z.array(z.string()).optional(),
    followedOrgs: z.array(z.string()).optional(),
});

export async function PUT(request: NextRequest) {
    try {
        // TODO: Implement update profile logic
        // - Validate request body
        // - Get user from session
        // - Update profile preferences

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

        const validatedData = ProfileUpdateSchema.parse(body);

        const profile = await prisma.profile.upsert({
            where: {
                userId: session.user.id
            },
            update: validatedData,
            create: {
                userId: session.user.id,
                ...validatedData
            }
        });

        return NextResponse.json({
            message: 'Profile updated successfully',
            profile
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.issues },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
