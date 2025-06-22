import { Router, Request, Response } from "express";
import ytdl from "@distube/ytdl-core";
import { isValidYouTubeUrl, extractVideoId } from "../utils/youtube";

const router = Router();

// Configure ytdl with better error handling
const ytdlOptions = {
  requestOptions: {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  },
};

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

    const isValid = ytdl.validateURL(normalizedUrl);
    if (!isValid) {
      return res.status(400).json({ error: "Video is not available" });
    }

    let info;
    let retries = 3;

    while (retries > 0) {
      try {
        info = await ytdl.getInfo(normalizedUrl, ytdlOptions);
        break;
      } catch (error: any) {
        retries--;
        if (error.statusCode === 429 && retries > 0) {
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, (4 - retries) * 2000)
          );
          continue;
        }
        throw error;
      }
    }

    if (!info) {
      throw new Error("Failed to fetch video info after retries");
    }

    const videoDetails = info.videoDetails;

    const duration = parseInt(videoDetails.lengthSeconds);

    if (duration > 900) {
      return res
        .status(400)
        .json({ error: "Video duration exceeds 15 minutes limit" });
    }

    const isLongVideo = duration > 600;

    const formats = ytdl
      .filterFormats(info.formats, "videoandaudio")
      .filter((format) => format.container === "mp4")
      .map((format) => ({
        quality: format.qualityLabel || format.quality,
        format: format.container,
        url: format.url,
        filesize: format.contentLength,
      }))
      .sort((a, b) => {
        const qualityOrder = ["1080p", "720p", "480p", "360p", "240p"];
        const aIndex = qualityOrder.indexOf(a.quality);
        const bIndex = qualityOrder.indexOf(b.quality);
        return aIndex - bIndex;
      });

    return res.json({
      title: videoDetails.title,
      duration,
      thumbnail: videoDetails.thumbnails[0]?.url,
      formats: formats.slice(0, 3),
      videoId,
      warning: isLongVideo
        ? "This video is over 10 minutes long and may take longer to process"
        : null,
    });
  } catch (error: any) {
    console.error("YouTube info error:", error);

    if (error instanceof Error) {
      // Handle rate limiting
      if (
        error.message.includes("Status code: 429") ||
        (error as any).statusCode === 429
      ) {
        return res.status(429).json({
          error:
            "YouTube rate limit exceeded. Please wait a few minutes before trying again.",
        });
      }
      // Handle other YouTube API errors
      if (
        error.message.includes("Status code: 403") ||
        (error as any).statusCode === 403
      ) {
        return res.status(403).json({
          error:
            "Access to YouTube video is forbidden. This may be due to regional restrictions or YouTube's anti-bot measures.",
        });
      }
      if (error.message.includes("Could not extract functions")) {
        return res.status(400).json({
          error:
            "Unable to process this YouTube video. This may be due to YouTube's recent changes or regional restrictions. Please try a different video.",
        });
      }
      if (error.message.includes("Video unavailable")) {
        return res
          .status(400)
          .json({ error: "Video is unavailable or restricted" });
      }
      if (error.message.includes("private")) {
        return res.status(400).json({ error: "Video is private" });
      }
    }

    return res.status(500).json({ error: "Failed to fetch video information" });
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

    const isValid = ytdl.validateURL(normalizedUrl);
    if (!isValid) {
      return res.status(400).json({ error: "Video is not available" });
    }

    let info;
    let retries = 3;

    while (retries > 0) {
      try {
        info = await ytdl.getInfo(normalizedUrl, ytdlOptions);
        break;
      } catch (error: any) {
        retries--;
        if (error.statusCode === 429 && retries > 0) {
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, (4 - retries) * 2000)
          );
          continue;
        }
        throw error;
      }
    }

    if (!info) {
      throw new Error("Failed to fetch video info after retries");
    }

    const videoDetails = info.videoDetails;

    const duration = parseInt(videoDetails.lengthSeconds);
    if (duration > 900) {
      return res
        .status(400)
        .json({ error: "Video duration exceeds 15 minutes limit" });
    }

    let format;
    if (quality) {
      format = ytdl.chooseFormat(info.formats, {
        quality: quality,
        filter: "videoandaudio",
      });
    } else {
      format = ytdl.chooseFormat(info.formats, {
        quality: "highest",
        filter: "videoandaudio",
      });
    }

    if (!format) {
      return res.status(400).json({ error: "No suitable video format found" });
    }

    const videoStream = ytdl(normalizedUrl, { format, ...ytdlOptions });

    const filename = `${videoDetails.title
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")}.mp4`;

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");

    if (format.contentLength) {
      res.setHeader("Content-Length", format.contentLength);
    }

    videoStream.pipe(res);

    videoStream.on("error", (error) => {
      console.error("Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Stream error occurred" });
      }
    });
  } catch (error: any) {
    console.error("YouTube download error:", error);

    if (error instanceof Error) {
      // Handle rate limiting
      if (
        error.message.includes("Status code: 429") ||
        (error as any).statusCode === 429
      ) {
        return res.status(429).json({
          error:
            "YouTube rate limit exceeded. Please wait a few minutes before trying again.",
        });
      }
      // Handle other YouTube API errors
      if (
        error.message.includes("Status code: 403") ||
        (error as any).statusCode === 403
      ) {
        return res.status(403).json({
          error:
            "Access to YouTube video is forbidden. This may be due to regional restrictions or YouTube's anti-bot measures.",
        });
      }
      if (error.message.includes("Could not extract functions")) {
        return res.status(400).json({
          error:
            "Unable to process this YouTube video. This may be due to YouTube's recent changes or regional restrictions. Please try a different video.",
        });
      }
      if (error.message.includes("Video unavailable")) {
        return res
          .status(400)
          .json({ error: "Video is unavailable or restricted" });
      }
      if (error.message.includes("private")) {
        return res.status(400).json({ error: "Video is private" });
      }
    }

    return res.status(500).json({ error: "Failed to download video" });
  }
});

export { router as youtubeRoutes };
