import { auth } from '@/lib/auth';
import prisma from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Query parameter validation schema for issues feed
const IssuesQuerySchema = z.object({
    // Filter parameters
    languages: z.string().optional(), // Comma-separated languages
    labels: z.string().optional(),    // Comma-separated labels
    minStars: z.string().transform(Number).pipe(z.number().min(0)).optional(),
    maxStars: z.string().transform(Number).pipe(z.number().min(0)).optional(),
    bountyOnly: z.string().transform(val => val === 'true').optional(),
    followedOnly: z.string().transform(val => val === 'true').optional(),
    orgs: z.string().optional(),      // Comma-separated orgs
    repos: z.string().optional(),     // Comma-separated repos
    
    // Pagination
    page: z.string().transform(Number).pipe(z.number().min(1)).optional().default(() => 1),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default(() => 20),
    
    // Sorting
    sortBy: z.enum(['score', 'stars', 'openedAt', 'updatedAt']).optional().default('score'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// GitHub API helper function
async function fetchGitHubIssues(token: string, query: string, page: number = 1, perPage: number = 20) {
    const response = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&sort=updated&order=desc`,
        {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'RepoRewards'
            }
        }
    );

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// Build GitHub search query from filters
function buildGitHubQuery(filters: any) {
    let query = 'is:issue is:open';
    
    // Bounty filter
    if (filters.bountyOnly) {
        query += ' (label:bounty OR label:reward OR label:paid OR "bounty" OR "reward" OR "paid")';
    }
    
    // Labels filter
    if (filters.labels) {
        const labels = filters.labels.split(',').map((l: string) => l.trim());
        labels.forEach((label: string) => {
            query += ` label:"${label}"`;
        });
    }
    
    // Language filter (this will be post-filtered since GitHub doesn't support language in search)
    // We'll filter by language after fetching
    
    // Organization filter
    if (filters.orgs) {
        const orgs = filters.orgs.split(',').map((o: string) => o.trim());
        orgs.forEach((org: string) => {
            query += ` org:"${org}"`;
        });
    }
    
    // Repository filter
    if (filters.repos) {
        const repos = filters.repos.split(',').map((r: string) => r.trim());
        repos.forEach((repo: string) => {
            query += ` repo:"${repo}"`;
        });
    }
    
    return query;
}

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

        // Get user's GitHub access token from the database
        // According to Better Auth docs, accounts are stored in the account table
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

        // Parse and validate query parameters
        const { searchParams } = new URL(request.url);
        const queryData = Object.fromEntries(searchParams.entries());
        const validatedQuery = IssuesQuerySchema.parse(queryData);

        // Build GitHub search query
        const githubQuery = buildGitHubQuery(validatedQuery);
        
        // Fetch issues from GitHub
        const githubResponse = await fetchGitHubIssues(
            githubAccount.accessToken,
            githubQuery,
            validatedQuery.page,
            validatedQuery.limit
        );

        // Process and filter issues
        let issues = githubResponse.items || [];
        
        // Post-filter by language if specified (GitHub search doesn't support language filtering)
        if (validatedQuery.languages) {
            const targetLanguages = validatedQuery.languages.split(',').map((l: string) => l.trim().toLowerCase());
            issues = issues.filter((issue: any) => {
                // Extract language from repository name or try to infer from repo
                // This is a simplified approach - in production you might want to fetch repo details
                const repoName = issue.repository?.name || '';
                return targetLanguages.some(lang => 
                    repoName.toLowerCase().includes(lang) || 

        // Fetch repository details for all unique repositories referenced in the issues
        const uniqueRepoUrls = Array.from(new Set(issues.map((issue: any) => issue.repository_url)));
        const repoDetailsMap = await fetchRepositoriesDetails(uniqueRepoUrls, githubAccount.accessToken);

        // Attach repository details to each issue
        issues = issues.map((issue: any) => ({
            ...issue,
            repository: repoDetailsMap[issue.repository_url]
        }));
        
        // Post-filter by language if specified (GitHub search doesn't support language filtering)
        if (validatedQuery.languages) {
            const targetLanguages = validatedQuery.languages.split(',').map((l: string) => l.trim().toLowerCase());
            issues = issues.filter((issue: any) => {
                // Extract language from repository name or try to infer from repo
                const repoName = issue.repository_url.split('/').pop();
                return targetLanguages.some(lang => 
                    repoName.toLowerCase().includes(lang) || 
                    (issue.repository && issue.repository.language && issue.repository.language.toLowerCase() === lang)
                );
            });
        }

        // Post-filter by stars if specified
        if (validatedQuery.minStars || validatedQuery.maxStars) {
            issues = issues.filter((issue: any) => {
                const stars = issue.repository?.stargazers_count || 0;
                if (validatedQuery.minStars && stars < validatedQuery.minStars) return false;
                if (validatedQuery.maxStars && stars > validatedQuery.maxStars) return false;
                return true;
            });
        }

        // Add bounty detection and scoring
        const processedIssues = issues.map((issue: any) => {
            // Detect if issue has bounty
            const isBounty = issue.labels.some((label: any) => 
                ['bounty', 'reward', 'paid'].includes(label.name.toLowerCase())
            ) || 
            issue.title.toLowerCase().includes('bounty') ||
            issue.title.toLowerCase().includes('reward') ||
            issue.title.toLowerCase().includes('paid');

            // Simple scoring based on bounty status and recency
            let score = 0;
            if (isBounty) score += 50;
            if (issue.repository?.stargazers_count > 1000) score += 30;
            if (issue.repository?.stargazers_count > 100) score += 20;
            
            // Recency bonus
            const daysSinceUpdate = (Date.now() - new Date(issue.updated_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate < 1) score += 20;
            else if (daysSinceUpdate < 7) score += 10;

            return {
                id: issue.id.toString(),
                githubId: issue.id,
                repoFullName: issue.repository?.full_name || 'unknown/repo',
                number: issue.number,
                title: issue.title,
                bodyExcerpt: issue.body ? issue.body.substring(0, 200) + '...' : '',
                htmlUrl: issue.html_url,
                labels: issue.labels.map((l: any) => l.name),
                language: issue.repository?.language || null,
                stars: issue.repository?.stargazers_count || 0,
                org: issue.repository?.owner?.type === 'Organization' ? issue.repository.owner.login : null,
                isBounty,
                bountyType: isBounty ? 'repo-label' : null,
                bountyUrl: null, // Would need additional logic to detect bounty URLs
                bountyAmountMin: null, // Would need regex parsing of issue body
                bountyAmountMax: null,
                currency: null,
                score,
                openedAt: issue.created_at,
                updatedAt: issue.updated_at,
                // Add GitHub-specific fields
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
        });

        // Sort by score if requested
        if (validatedQuery.sortBy === 'score') {
            processedIssues.sort((a: any, b: any) => 
                validatedQuery.sortOrder === 'desc' ? b.score - a.score : a.score - b.score
            );
        }

        return NextResponse.json({
            issues: processedIssues,
            pagination: {
                page: validatedQuery.page,
                limit: validatedQuery.limit,
                total: githubResponse.total_count || 0,
                totalPages: Math.ceil((githubResponse.total_count || 0) / validatedQuery.limit)
            },
            filters: {
                languages: validatedQuery.languages?.split(',').map((l: string) => l.trim()) || [],
                labels: validatedQuery.labels?.split(',').map((l: string) => l.trim()) || [],
                minStars: validatedQuery.minStars,
                maxStars: validatedQuery.maxStars,
                bountyOnly: validatedQuery.bountyOnly,
                followedOnly: validatedQuery.followedOnly,
                orgs: validatedQuery.orgs?.split(',').map((o: string) => o.trim()) || [],
                repos: validatedQuery.repos?.split(',').map((r: string) => r.trim()) || [],
            },
            githubQuery // For debugging
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid query parameters', details: error.issues },
                { status: 400 }
            );
        }

        console.error('Issues feed error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
