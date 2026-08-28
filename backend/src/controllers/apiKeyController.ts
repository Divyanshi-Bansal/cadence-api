import { Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

export const apiKeyController = {
  createKey: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { name } = req.body;
      if (!name || typeof name !== "string") {
        res.status(400).json({ error: "Key name is required" });
        return;
      }

      const rawKey = `cadence_ak_${crypto.randomBytes(24).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

      const token = await prisma.personalAccessToken.create({
        data: {
          userId,
          keyHash,
          name,
        },
      });

      res.status(201).json({
        id: token.id,
        name: token.name,
        key: rawKey, // Only shown once!
        createdAt: token.createdAt,
      });
    } catch (err: any) {
      console.error("[apiKeyController.createKey]:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  listKeys: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const tokens = await prisma.personalAccessToken.findMany({
        where: {
          userId,
          revokedAt: null,
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(tokens);
    } catch (err: any) {
      console.error("[apiKeyController.listKeys]:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  revokeKey: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { id } = req.params;
    if (typeof id !== "string") { res.status(400).json({ error: "Invalid ID" }); return; }
      if (typeof id !== "string") {
        res.status(400).json({ error: "Invalid API key ID" });
        return;
      }

      const token = await prisma.personalAccessToken.findUnique({
        where: { id },
      });

      if (!token || token.userId !== userId) {
        res.status(404).json({ error: "Key not found" });
        return;
      }

      await prisma.personalAccessToken.update({
        where: { id },
        data: { revokedAt: new Date() },
      });

      res.json({ message: "Key revoked successfully" });
    } catch (err: any) {
      console.error("[apiKeyController.revokeKey]:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};
