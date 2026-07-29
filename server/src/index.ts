import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import authRoutes from "./auth/routes.js";
import adminRoutes from "./admin/routes.js";
import { socketAuthMiddleware } from "./auth/socketAuth.js";
import { registerSocketHandlers } from "./socket/handlers.js";

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", authRoutes);
app.use("/api/admin", adminRoutes);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: clientOrigin },
});

io.use(socketAuthMiddleware);
registerSocketHandlers(io);

const port = Number(process.env.PORT ?? 4000);
httpServer.listen(port, () => {
  console.log(`섯다 서버가 http://localhost:${port} 에서 실행 중입니다.`);
});
