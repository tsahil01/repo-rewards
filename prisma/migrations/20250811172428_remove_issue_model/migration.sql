/*
  Warnings:

  - You are about to drop the column `issueId` on the `user_issue` table. All the data in the column will be lost.
  - You are about to drop the `issue` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,githubIssueId]` on the table `user_issue` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `githubIssueId` to the `user_issue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `issueNumber` to the `user_issue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `repoFullName` to the `user_issue` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."user_issue" DROP CONSTRAINT "user_issue_issueId_fkey";

-- DropIndex
DROP INDEX "public"."user_issue_userId_issueId_key";

-- AlterTable
ALTER TABLE "public"."user_issue" DROP COLUMN "issueId",
ADD COLUMN     "githubIssueId" TEXT NOT NULL,
ADD COLUMN     "issueNumber" INTEGER NOT NULL,
ADD COLUMN     "repoFullName" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."issue";

-- CreateIndex
CREATE UNIQUE INDEX "user_issue_userId_githubIssueId_key" ON "public"."user_issue"("userId", "githubIssueId");
