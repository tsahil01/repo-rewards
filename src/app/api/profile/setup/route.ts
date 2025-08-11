import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ProfileSetupSchema = z.object({
  primaryLanguages: z.array(z.string()).min(1).max(5),
  topics: z.array(z.string()).optional(),
  followedRepos: z.array(z.string()).optional(),
  followedOrgs: z.array(z.string()).optional(),
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

    const validatedData = ProfileSetupSchema.parse(body);

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

    return NextResponse.json({ message: 'Profile setup endpoint', profile });
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
