import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';



export async function GET(
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

        // Get user's GitHub access token
        const userAccounts = await prisma.account.findMany({
            where: {
                userId: session.user.id,
                providerId: 'github'
            }
        });
        
        const githubAccount = userAccounts[0];
        if (!githubAccount?.accessToken) {
            return NextResponse.json(
                { error: 'GitHub access token not found. Please reconnect your GitHub account.' },
                { status: 400 }
            );
        }

        // For now, we need the repository context to hit the GitHub API directly
        // The issue ID alone isn't enough - we need owner/repo
        // This is a limitation of GitHub's API design
        
        // Option 1: Frontend should pass repo info
        const { searchParams } = new URL(request.url);
        const repo = searchParams.get('repo'); // e.g., "owner/repo"
        
        if (!repo) {
            return NextResponse.json({
                error: 'Repository information required',
                message: 'Please provide repo parameter (e.g., ?repo=owner/repo)',
                example: `/api/issues/${params.id}?repo=facebook/react`
            }, { status: 400 });
        }
        
        // Now we can hit the actual GitHub API
        const githubResponse = await fetch(
            `https://api.github.com/repos/${repo}/issues/${params.id}`,
            {
                headers: {
                    'Authorization': `token ${githubAccount.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'RepoRewards'
                }
            }
        );

        if (!githubResponse.ok) {
            if (githubResponse.status === 404) {
                return NextResponse.json(
                    { error: 'Issue not found' },
                    { status: 404 }
                );
            }
            throw new Error(`GitHub API error: ${githubResponse.status} ${githubResponse.statusText}`);
        }

        const issue = await githubResponse.json();

        // Get user's status for this issue
        const userIssue = await prisma.userIssue.findUnique({
            where: {
                userId_githubIssueId: {
                    userId: session.user.id,
                    githubIssueId: params.id
                }
            },
            select: {
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });

        // Get user's profile to check if this matches their preferences
        const userProfile = await prisma.profile.findUnique({
            where: { userId: session.user.id }
        });

        let matchScore = 0;
        let matchReasons: string[] = [];

        if (userProfile) {
            // Language match
            if (userProfile.primaryLanguages.includes(issue.repository?.language || '')) {
                matchScore += 30;
                matchReasons.push('Language match');
            }

            // Note: Profile doesn't have labels field, so we skip label matching
            // In the future, we could add preferred labels to Profile model

            // Followed repo/org match
            if (userProfile.followedRepos.includes(issue.repository?.full_name || '')) {
                matchScore += 25;
                matchReasons.push('Followed repository');
            }
            if (userProfile.followedOrgs.includes(issue.repository?.owner?.login || '')) {
                matchScore += 25;
                matchReasons.push('Followed organization');
            }

            // Topic match (simple keyword matching)
            const issueText = `${issue.title} ${issue.body || ''}`.toLowerCase();
            const topicMatches = userProfile.topics.filter(topic => 
                issueText.includes(topic.toLowerCase())
            );
            if (topicMatches.length > 0) {
                matchScore += 10 * topicMatches.length;
                matchReasons.push(`${topicMatches.length} topic matches`);
            }
        }

        // Detect if issue has bounty
        const isBounty = issue.labels.some((label: any) => 
            ['bounty', 'reward', 'paid'].includes(label.name.toLowerCase())
        ) || 
        issue.title.toLowerCase().includes('bounty') ||
        issue.title.toLowerCase().includes('reward') ||
        issue.title.toLowerCase().includes('paid');

        // Calculate score
        let score = 0;
        if (isBounty) score += 50;
        if (issue.repository?.stargazers_count > 1000) score += 30;
        if (issue.repository?.stargazers_count > 100) score += 20;
        
        // Recency bonus
        const daysSinceUpdate = (Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 1) score += 20;
        else if (daysSinceUpdate < 7) score += 10;

        const processedIssue = {
            id: issue.id.toString(),
            githubId: issue.id,
            repoFullName: issue.repository?.full_name || 'unknown/repo',
            number: issue.number,
            title: issue.title,
            bodyExcerpt: issue.body ? issue.body.substring(0, 500) + '...' : '',
            htmlUrl: issue.html_url,
            labels: issue.labels.map((l: any) => l.name),
            language: issue.repository?.language || null,
            stars: issue.repository?.stargazers_count || 0,
            org: issue.repository?.owner?.type === 'Organization' ? issue.repository.owner.login : null,
            isBounty,
            bountyType: isBounty ? 'repo-label' : null,
            bountyUrl: null,
            bountyAmountMin: null,
            bountyAmountMax: null,
            currency: null,
            score,
            openedAt: issue.created_at,
            updatedAt: issue.updated_at,
            state: issue.state,
            assignee: issue.assignee,
            comments: issue.comments,
            repository: {
                name: issue.repository?.name,
                fullName: issue.repository?.full_name,
                description: issue.repository?.description,
                language: issue.repository?.language,
                stars: issue.repository?.stargazers_count,
                forks: issue.repository?.forks_count,
                openIssues: issue.repository?.open_issues_count,
                updatedAt: issue.repository?.updated_at
            }
        };

        return NextResponse.json({
            issue: {
                ...processedIssue,
                userStatus: userIssue?.status || null,
                userInteraction: userIssue ? {
                    status: userIssue.status,
                    savedAt: userIssue.createdAt,
                    lastUpdated: userIssue.updatedAt
                } : null
            },
            personalization: {
                matchScore,
                matchReasons,
                userProfile: userProfile ? {
                    hasProfile: true,
                    primaryLanguages: userProfile.primaryLanguages,
                    followedRepos: userProfile.followedRepos,
                    followedOrgs: userProfile.followedOrgs,
                    topics: userProfile.topics
                } : {
                    hasProfile: false
                }
            }
        });

    } catch (error) {
        console.error('Single issue error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
