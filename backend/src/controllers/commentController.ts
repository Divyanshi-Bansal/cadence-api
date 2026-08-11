import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { formatUser } from "../lib/userFormat";

export const getTaskComments = async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId as string;

    const comments = await (prisma.comment as any).findMany({
      where: { taskId },
      include: {
        user: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const formattedComments = comments.map((c: any) => {
      let rawContent = c.content;
      if (typeof rawContent === "object" && rawContent !== null) {
        rawContent = rawContent.text || JSON.stringify(rawContent);
      }
      return {
        id: c.id,
        taskId: c.taskId,
        userId: c.userId,
        content: String(rawContent || ""),
        replyToId: c.replyToId || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        user: c.user ? formatUser(c.user) : null,
      };
    });

    res.json({ comments: formattedComments });
  } catch (error: any) {
    console.error("Get Comments Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch comments" });
  }
};

export const createComment = async (req: Request, res: Response) => {
  try {
    const taskId = req.params.taskId as string;
    const { content, replyToId } = req.body;
    const userId = (req as any).userId as string;

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    if (replyToId && typeof replyToId === "string") {
      const parentComment = await prisma.comment.findUnique({
        where: { id: replyToId },
      });
      if (!parentComment) {
        return res.status(404).json({ error: "Parent comment to reply to was not found" });
      }
    }

    const comment = await (prisma.comment as any).create({
      data: {
        taskId,
        userId,
        content: content.trim(),
        replyToId: replyToId || null,
      },
      include: {
        user: true,
      },
    });

    let rawContent = comment.content;
    if (typeof rawContent === "object" && rawContent !== null) {
      rawContent = rawContent.text || JSON.stringify(rawContent);
    }

    const formattedComment = {
      id: comment.id,
      taskId: comment.taskId,
      userId: comment.userId,
      content: String(rawContent || ""),
      replyToId: comment.replyToId || null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: comment.user ? formatUser(comment.user) : null,
    };

    res.status(201).json({ comment: formattedComment });
  } catch (error: any) {
    console.error("Create Comment Error:", error);
    res.status(500).json({ error: error.message || "Failed to create comment" });
  }
};

export const updateComment = async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const { content } = req.body;
    const userId = (req as any).userId as string;

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (existing.userId && existing.userId !== userId) {
      return res.status(403).json({ error: "You can only edit your own comments" });
    }

    const updated = await (prisma.comment as any).update({
      where: { id: commentId },
      data: { content: content.trim() },
      include: { user: true },
    });

    let rawContent = updated.content;
    if (typeof rawContent === "object" && rawContent !== null) {
      rawContent = rawContent.text || JSON.stringify(rawContent);
    }

    const formattedComment = {
      id: updated.id,
      taskId: updated.taskId,
      userId: updated.userId,
      content: String(rawContent || ""),
      replyToId: updated.replyToId || null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      user: updated.user ? formatUser(updated.user) : null,
    };

    res.json({ comment: formattedComment });
  } catch (error: any) {
    console.error("Update Comment Error:", error);
    res.status(500).json({ error: error.message || "Failed to update comment" });
  }
};

async function getAllDescendantCommentIds(commentId: string): Promise<string[]> {
  const children = await prisma.comment.findMany({
    where: { replyToId: commentId },
    select: { id: true },
  });

  let ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    const subIds = await getAllDescendantCommentIds(child.id);
    ids = ids.concat(subIds);
  }
  return ids;
}

export const deleteComment = async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId as string;
    const userId = (req as any).userId as string;

    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existing) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (existing.userId && existing.userId !== userId) {
      return res.status(403).json({ error: "You can only delete your own comments" });
    }

    const descendantIds = await getAllDescendantCommentIds(commentId);
    const idsToDelete = [commentId, ...descendantIds];

    await prisma.comment.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    res.json({ success: true, message: "Comment and nested replies deleted", deletedIds: idsToDelete });
  } catch (error: any) {
    console.error("Delete Comment Error:", error);
    res.status(500).json({ error: error.message || "Failed to delete comment" });
  }
};
