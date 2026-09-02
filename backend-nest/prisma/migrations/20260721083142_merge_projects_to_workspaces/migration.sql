/*
  Warnings:

  - You are about to drop the column `projectId` on the `BoardStage` table. All the data in the column will be lost.
  - You are about to drop the column `invitationType` on the `Invitation` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `Invitation` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `IssueType` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `Note` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectMember` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `workspaceId` to the `BoardStage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkspaceStatus" ADD VALUE 'ON_HOLD';
ALTER TYPE "WorkspaceStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "WorkspaceStatus" ADD VALUE 'ARCHIVED';

-- DropForeignKey
ALTER TABLE "BoardStage" DROP CONSTRAINT "BoardStage_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_projectId_fkey";

-- DropForeignKey
ALTER TABLE "IssueType" DROP CONSTRAINT "IssueType_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_projectId_fkey";

-- DropIndex
DROP INDEX "Note_projectId_userId_idx";

-- DropIndex
DROP INDEX "Task_projectId_idx";

-- AlterTable
ALTER TABLE "BoardStage" DROP COLUMN "projectId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Invitation" DROP COLUMN "invitationType",
DROP COLUMN "projectId";

-- AlterTable
ALTER TABLE "IssueType" DROP COLUMN "projectId",
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "projectId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "projectId",
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "ProjectMember";

-- DropEnum
DROP TYPE "InvitationType";

-- DropEnum
DROP TYPE "ProjectRole";

-- DropEnum
DROP TYPE "ProjectStatus";

-- CreateIndex
CREATE INDEX "Note_workspaceId_userId_idx" ON "Note"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");

-- AddForeignKey
ALTER TABLE "BoardStage" ADD CONSTRAINT "BoardStage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueType" ADD CONSTRAINT "IssueType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
