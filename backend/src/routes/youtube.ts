import { Router, Request, Response } from "express";
import {
  isValidYouTubeUrl,
  extractVideoId,
  getCachedVideoInfo,
  getVideoFormats,
  downloadVideoStream,
} from "../utils/youtube";

const router = Router();

// YouTube video info endpoint
router.post("/info", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res
        .status(400)
        .json({ error: "Could not extract video ID from URL" });
    }

    const normalizedUrl = url.includes("/shorts/")
      ? `https://www.youtube.com/watch?v=${videoId}`
      : url;

    // Get video info using yt-dlp
    const info = await getCachedVideoInfo(normalizedUrl);

    if (!info) {
      return res
        .status(400)
        .json({ error: "Could not fetch video information" });
    }

    const duration = info.duration || 0;

    if (duration > 900) {
      return res
        .status(400)
        .json({ error: "Video duration exceeds 15 minutes limit" });
    }

    const isLongVideo = duration > 600;

    // Get available formats
    const formats = await getVideoFormats(normalizedUrl);

    return res.json({
      title: info.title || "Untitled",
      duration,
      thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
      formats: formats,
      videoId,
      warning: isLongVideo
        ? "This video is over 10 minutes long and may take longer to process"
        : null,
    });
  } catch (error: any) {
    console.error("YouTube info error:", error);

    // Handle specific yt-dlp errors
    if (error.message.includes("YouTube rate limit exceeded")) {
      return res.status(429).json({
        error:
          "YouTube rate limit exceeded. Please wait a few minutes before trying again.",
      });
    }

    if (error.message.includes("Access forbidden")) {
      return res.status(403).json({
        error:
          "Access to YouTube video is forbidden. This may be due to regional restrictions or YouTube's anti-bot measures.",
      });
    }

    if (error.message.includes("Video unavailable")) {
      return res.status(400).json({
        error: "Video is unavailable or restricted",
      });
    }

    if (error.message.includes("Video is private")) {
      return res.status(400).json({
        error: "Video is private",
      });
    }

    if (error.message.includes("yt-dlp timeout")) {
      return res.status(408).json({
        error: "Request timeout. The video may be taking too long to process.",
      });
    }

    return res.status(500).json({
      error: "Failed to fetch video information. Please try again later.",
    });
  }
});

// YouTube video formats endpoint
router.post("/formats", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res
        .status(400)
        .json({ error: "Could not extract video ID from URL" });
    }

    const normalizedUrl = url.includes("/shorts/")
      ? `https://www.youtube.com/watch?v=${videoId}`
      : url;

    // Get available formats
    const formats = await getVideoFormats(normalizedUrl);

    return res.json({
      formats: formats,
      videoId,
    });
  } catch (error: any) {
    console.error("YouTube formats error:", error);

    // Handle specific yt-dlp errors
    if (error.message.includes("YouTube rate limit exceeded")) {
      return res.status(429).json({
        error:
          "YouTube rate limit exceeded. Please wait a few minutes before trying again.",
      });
    }

    if (error.message.includes("Access forbidden")) {
      return res.status(403).json({
        error:
          "Access to YouTube video is forbidden. This may be due to regional restrictions or YouTube's anti-bot measures.",
      });
    }

    if (error.message.includes("Video unavailable")) {
      return res.status(400).json({
        error: "Video is unavailable or restricted",
      });
    }

    if (error.message.includes("Video is private")) {
      return res.status(400).json({
        error: "Video is private",
      });
    }

    if (error.message.includes("yt-dlp timeout")) {
      return res.status(408).json({
        error: "Request timeout. The video may be taking too long to process.",
      });
    }

    return res.status(500).json({
      error: "Failed to fetch video formats. Please try again later.",
    });
  }
});

// YouTube video download endpoint
router.post("/download", async (req: Request, res: Response) => {
  try {
    const { url, quality } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res
        .status(400)
        .json({ error: "Could not extract video ID from URL" });
    }

    const normalizedUrl = url.includes("/shorts/")
      ? `https://www.youtube.com/watch?v=${videoId}`
      : url;

    // First get video info to validate
    const info = await getCachedVideoInfo(normalizedUrl);

    if (!info) {
      return res.status(400).json({ error: "Video is not available" });
    }

    const duration = info.duration || 0;
    if (duration > 900) {
      return res
        .status(400)
        .json({ error: "Video duration exceeds 15 minutes limit" });
    }

    // Determine format ID based on quality
    let formatId: string | undefined;
    if (quality && quality !== "highest") {
      const formats = await getVideoFormats(normalizedUrl);
      const selectedFormat = formats.find((f) => f.quality === quality);
      formatId = selectedFormat?.format_id;
    }

    // Get download stream
    const { stream, filename } = await downloadVideoStream(
      normalizedUrl,
      formatId
    );

    // Set response headers
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");

    // Pipe the stream to response
    stream.pipe(res);

    stream.on("error", (error: any) => {
      console.error("Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Stream error occurred" });
      }
    });

    res.on("close", () => {
      if (stream && !stream.destroyed) {
        stream.destroy();
      }
    });
  } catch (error: any) {
    console.error("YouTube download error:", error);

    // Handle specific yt-dlp errors
    if (error.message.includes("YouTube rate limit exceeded")) {
      return res.status(429).json({
        error:
          "YouTube rate limit exceeded. Please wait a few minutes before trying again.",
      });
    }

    if (error.message.includes("Access forbidden")) {
      return res.status(403).json({
        error:
          "Access to YouTube video is forbidden. This may be due to regional restrictions or YouTube's anti-bot measures.",
      });
    }

    if (error.message.includes("Video unavailable")) {
      return res.status(400).json({
        error: "Video is unavailable or restricted",
      });
    }

    if (error.message.includes("Video is private")) {
      return res.status(400).json({
        error: "Video is private",
      });
    }

    if (error.message.includes("yt-dlp timeout")) {
      return res.status(408).json({
        error: "Request timeout. The video may be taking too long to process.",
      });
    }

    return res.status(500).json({
      error: "Failed to download video. Please try again later.",
    });
  }
});

export { router as youtubeRoutes };
