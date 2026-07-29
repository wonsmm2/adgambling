import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prismaClient.js";
import { getJwtSecret } from "./jwt.js";

const router = Router();

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "아이디는 3자 이상이어야 합니다.")
    .max(20, "아이디는 20자 이하여야 합니다.")
    .regex(/^[a-zA-Z0-9_]+$/, "아이디는 영문/숫자/밑줄만 사용할 수 있습니다."),
  password: z.string().min(4, "비밀번호는 4자 이상이어야 합니다.").max(100),
});

function signToken(userId: string, username: string): string {
  return jwt.sign({ sub: userId, username }, getJwtSecret(), {
    expiresIn: "7d",
  });
}

router.post("/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return res
      .status(401)
      .json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res
      .status(401)
      .json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." });
  }

  const token = signToken(user.id, user.username);
  return res.json({
    token,
    user: { id: user.id, username: user.username, chips: user.chips },
  });
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "인증이 필요합니다." });
  }
  try {
    const token = authHeader.slice("Bearer ".length);
    const payload = jwt.verify(token, getJwtSecret()) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ message: "인증이 필요합니다." });
    return res.json({
      user: { id: user.id, username: user.username, chips: user.chips },
    });
  } catch {
    return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
  }
});

export default router;
