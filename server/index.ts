import express, { Request, Response } from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import {
  createInitialState,
  getValidMoves,
  makeMove,
  calculateNextRound,
  PLAYER_1,
  PLAYER_2,
} from "../src/game/sungka-engine";
import type { GameState, Player } from "../src/game/sungka-engine";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? false : "*",
    methods: ["GET", "POST"],
  },
});

// ============ Room Management ============

interface Room {
  players: string[];
  state: GameState;
}

interface SocketWithRoom extends Socket {
  roomCode?: string;
  playerNumber?: Player;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on("connection", (baseSocket: Socket) => {
  const socket = baseSocket as SocketWithRoom;
  console.log(`[Sungka] Player connected: ${socket.id ?? "unknown"}`);

  socket.on("create-room", () => {
    let code = generateRoomCode();
    while (rooms.has(code)) {
      code = generateRoomCode();
    }

    const socketId = socket.id;
    if (!socketId) return;

    rooms.set(code, {
      players: [socketId],
      state: createInitialState(),
    });

    void socket.join(code);
    socket.roomCode = code;
    socket.playerNumber = PLAYER_1;

    socket.emit("room-created", { roomCode: code, player: PLAYER_1 });
    console.log(`[Sungka] Room ${code} created by ${socketId}`);
  });

  socket.on("join-room", ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit("error", { message: "Room is full" });
      return;
    }

    const socketId = socket.id;
    if (!socketId) return;

    room.players.push(socketId);
    void socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerNumber = PLAYER_2;

    socket.emit("room-joined", { roomCode, player: PLAYER_2 });

    // Start the game
    io.to(roomCode).emit("game-start", { state: room.state });
    console.log(`[Sungka] Player ${socketId} joined room ${roomCode}`);
  });

  socket.on(
    "make-move",
    ({ roomCode, pitIndex }: { roomCode: string; pitIndex: number }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      // Validate it's this player's turn
      if (room.state.currentPlayer !== socket.playerNumber) {
        socket.emit("error", { message: "Not your turn" });
        return;
      }

      const validMoves = getValidMoves(room.state);
      if (!validMoves.includes(pitIndex)) {
        socket.emit("error", { message: "Invalid move" });
        return;
      }

      const result = makeMove(room.state, pitIndex);
      if (!result) {
        socket.emit("error", { message: "Invalid move" });
        return;
      }

      room.state = result.state;
      io.to(roomCode).emit("move-made", {
        state: result.state,
        steps: result.steps,
      });
    },
  );

  socket.on("next-round", ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!room.state.roundOver) return;

    const nextState = calculateNextRound(room.state);

    room.state = nextState;
    io.to(roomCode).emit("game-start", { state: room.state });
  });

  socket.on("play-again", ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.state = createInitialState();
    io.to(roomCode).emit("game-start", { state: room.state });
  });

  socket.on("disconnect", () => {
    console.log(`[Sungka] Player disconnected: ${socket.id ?? "unknown"}`);
    if (socket.roomCode) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        socket.to(socket.roomCode).emit("opponent-disconnected");
        rooms.delete(socket.roomCode);
      }
    }
  });
});

// Serve static files from Vite build in production
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));

// Health check
app.get("/api/health", (_req: Request, _res: Response) => {
  _res.json({ status: "Sungka server running", rooms: rooms.size });
});

// SPA fallback — serve index.html for all non-API/non-static routes
app.get("*", (_req: Request, _res: Response) => {
  _res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Sungka] Server running on port ${PORT}`);
});
