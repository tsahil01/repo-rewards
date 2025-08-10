-- CreateTable
CREATE TABLE "public"."profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "primaryLanguages" TEXT[],
    "topics" TEXT[],
    "followedRepos" TEXT[],
    "followedOrgs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."issue" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "bodyExcerpt" TEXT,
    "htmlUrl" TEXT NOT NULL,
    "labels" TEXT[],
    "language" TEXT,
    "stars" INTEGER NOT NULL,
    "org" TEXT,
    "isBounty" BOOLEAN NOT NULL DEFAULT false,
    "bountyType" TEXT,
    "bountyUrl" TEXT,
    "bountyAmountMin" INTEGER,
    "bountyAmountMax" INTEGER,
    "currency" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    CONSTRAINT "issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_issue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."digest_subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digest_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."event_log" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_userId_key" ON "public"."profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "issue_githubId_key" ON "public"."issue"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "user_issue_userId_issueId_key" ON "public"."user_issue"("userId", "issueId");

-- CreateIndex
CREATE UNIQUE INDEX "digest_subscription_userId_key" ON "public"."digest_subscription"("userId");

-- AddForeignKey
ALTER TABLE "public"."profile" ADD CONSTRAINT "profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_issue" ADD CONSTRAINT "user_issue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_issue" ADD CONSTRAINT "user_issue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."digest_subscription" ADD CONSTRAINT "digest_subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
