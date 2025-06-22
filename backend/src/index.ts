import dotenv from "dotenv";

// Load environment variables first
dotenv.config();

import express from "express";
import cors from "cors";
import { videoRoutes } from "./routes/video";
import { youtubeRoutes } from "./routes/youtube";
import proxyRoutes from "./routes/proxy";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  "http://localhost:3000",
  "https://www.cliply.fun",
  "https://cliply.fun",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");
      const normalizedAllowed = allowedOrigins.map((url) =>
        url?.replace(/\/$/, "")
      );

      if (normalizedAllowed.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/video", videoRoutes);
app.use("/api/youtube", youtubeRoutes);
app.use("/api/proxy", proxyRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
