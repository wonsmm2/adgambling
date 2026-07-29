import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prismaClient.js";
import { CONFIG } from "../config.js";
import { getJwtSecret } from "../auth/jwt.js";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "관리자 인증이 필요합니다." });
  }
  try {
    const token = authHeader.slice("Bearer ".length);
    const payload = jwt.verify(token, getJwtSecret()) as { role?: string };
    if (payload.role !== "admin") throw new Error("not admin");
    next();
  } catch {
    return res.status(401).json({ message: "관리자 인증이 유효하지 않습니다." });
  }
}

router.post("/login", (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ message: "서버에 ADMIN_PASSWORD가 설정되어 있지 않습니다." });
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password !== adminPassword) {
    return res.status(401).json({ message: "비밀번호가 올바르지 않습니다." });
  }
  const token = jwt.sign({ role: "admin" }, getJwtSecret(), { expiresIn: "12h" });
  return res.json({ token });
});

const userSelect = { id: true, username: true, chips: true, createdAt: true } as const;

router.get("/users", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: userSelect,
  });
  return res.json({ users });
});

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "아이디는 3자 이상이어야 합니다.")
    .max(20, "아이디는 20자 이하여야 합니다.")
    .regex(/^[a-zA-Z0-9_]+$/, "아이디는 영문/숫자/밑줄만 사용할 수 있습니다."),
  password: z.string().min(4, "비밀번호는 4자 이상이어야 합니다.").max(100),
  chips: z.number().int().min(0).max(1_000_000_000).optional(),
});

router.post("/users", requireAdmin, async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  const { username, password, chips } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return res.status(409).json({ message: "이미 사용 중인 아이디입니다." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, passwordHash, chips: chips ?? CONFIG.STARTING_CHIPS },
    select: userSelect,
  });
  return res.status(201).json({ user });
});

const updateChipsSchema = z.object({
  chips: z.number().int("정수만 입력할 수 있습니다.").min(0, "0 이상이어야 합니다.").max(1_000_000_000),
});

router.patch("/users/:id/chips", requireAdmin, async (req, res) => {
  const parsed = updateChipsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { chips: parsed.data.chips },
      select: userSelect,
    });
    return res.json({ user });
  } catch {
    return res.status(404).json({ message: "회원을 찾을 수 없습니다." });
  }
});

const resetPasswordSchema = z.object({
  password: z.string().min(4, "비밀번호는 4자 이상이어야 합니다.").max(100),
});

router.patch("/users/:id/password", requireAdmin, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash },
      select: userSelect,
    });
    return res.json({ user });
  } catch {
    return res.status(404).json({ message: "회원을 찾을 수 없습니다." });
  }
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ message: "회원을 찾을 수 없습니다." });
  }
});

export default router;
