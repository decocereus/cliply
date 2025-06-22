import { Router, Request, Response } from "express";
import multer from "multer";
import { exec } from "child_process";
import { promisify } from "util";
import { unlink, mkdir, rmdir, readdir } from "fs/promises";
import { createReadStream, promises as fsPromises } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { existsSync } from "fs";

const execAsync = promisify(exec);

// Import the findYtDlpPath function from youtube utils
const findYtDlpPath = async (): Promise<string> => {
  // Check the paths in order of preference
  const possiblePaths = [
    path.resolve(__dirname, "../bin/yt-dlp"),
    path.join(process.cwd(), "bin/yt-dlp"),
    path.join(__dirname, "../yt-dlp"),
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "/opt/render/.local/bin/yt-dlp",
    "yt-dlp",
  ];

  for (const ytDlpPath of possiblePaths) {
    try {
      if (existsSync(ytDlpPath)) {
        console.log(`Found yt-dlp at: ${ytDlpPath}`);
        return ytDlpPath;
      }
    } catch (error) {
      console.error(`Error checking path ${ytDlpPath}:`, error);
    }
  }

  console.log("Using system PATH for yt-dlp");
  return "yt-dlp";
};
const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tempDir = path.join(process.cwd(), "temp");
      // Ensure temp directory exists
      require("fs").mkdirSync(tempDir, { recursive: true });
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      const sessionId = uuidv4();
      const ext = path.extname(file.originalname) || ".mp4";
      cb(null, `upload_${sessionId}${ext}`);
    },
  }),
  limits: {
    fileSize: 400 * 1024 * 1024, // 400MB limit - safe with disk storage
  },
});

router.post(
  "/clip",
  upload.single("video"),
  async (req: Request, res: Response) => {
    let tempDir: string | null = null;
    let inputPath: string | null = null;
    let outputPath: string | null = null;
    let tempClipPath: string | null = null;

    try {
      const { type: processingType, startTime, endTime, youtubeUrl } = req.body;
      const startTimeNum = parseFloat(startTime);
      const endTimeNum = parseFloat(endTime);

      if (
        !processingType ||
        startTime === undefined ||
        endTime === undefined ||
        isNaN(startTimeNum) ||
        isNaN(endTimeNum)
      ) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      if (startTimeNum < 0 || endTimeNum < 0 || startTimeNum >= endTimeNum) {
        return res.status(400).json({ error: "Invalid time range" });
      }

      const sessionId = uuidv4();
      tempDir = path.join(process.cwd(), "temp", sessionId);
      await mkdir(tempDir, { recursive: true });

      let finalVideoPath: string;
      let originalFilename = "video";

      if (processingType === "youtube") {
        if (!youtubeUrl) {
          return res.status(400).json({ error: "YouTube URL is required" });
        }

        console.log(`Processing YouTube video: ${youtubeUrl}`);
        console.log(`Time range: ${startTimeNum}s - ${endTimeNum}s`);

        const ytDlpPath = await findYtDlpPath();
        const downloadPath = path.join(tempDir, "clip.%(ext)s");
        const ytDlpCommand = [
          `"${ytDlpPath}"`,
          `--download-sections "*${startTimeNum}-${endTimeNum}"`,
          `"${youtubeUrl}"`,
          "-o",
          `"${downloadPath}"`,
          "--format",
          "best[ext=mp4]/best",
          "--no-playlist",
        ].join(" ");

        console.log("Stage 1 - yt-dlp command:", ytDlpCommand);
        await execAsync(ytDlpCommand);

        const possibleExtensions = [".mp4", ".webm", ".mkv"];
        let downloadedFile: string | null = null;

        for (const ext of possibleExtensions) {
          const testPath = path.join(tempDir, `clip${ext}`);
          if (existsSync(testPath)) {
            downloadedFile = testPath;
            break;
          }
        }

        if (!downloadedFile) {
          throw new Error("Downloaded file not found after yt-dlp processing");
        }

        tempClipPath = downloadedFile;
        outputPath = path.join(tempDir, "optimized.mp4");

        const optimizeCommand = [
          "ffmpeg",
          "-y",
          "-i",
          `"${tempClipPath}"`,
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-movflags",
          "+faststart",
          `"${outputPath}"`,
        ].join(" ");

        console.log("Stage 2 - FFmpeg optimization:", optimizeCommand);

        try {
          await execAsync(optimizeCommand);

          // Check if optimized file was actually created
          if (existsSync(outputPath)) {
            finalVideoPath = outputPath;
            console.log("✅ FFmpeg optimization successful");
          } else {
            console.log("⚠️ FFmpeg optimization failed - using original clip");
            finalVideoPath = tempClipPath;
          }
        } catch (ffmpegError) {
          console.error("❌ FFmpeg optimization failed:", ffmpegError);
          console.log("🔄 Using original clip instead");
          finalVideoPath = tempClipPath;
        }

        originalFilename = "youtube_clip";
      } else if (processingType === "upload") {
        const videoFile = req.file;
        if (!videoFile) {
          return res
            .status(400)
            .json({ error: "Video file is required for upload processing" });
        }

        console.log(`Processing uploaded file: ${videoFile.originalname}`);
        console.log(`Time range: ${startTimeNum}s - ${endTimeNum}s`);

        // File is already on disk thanks to multer.diskStorage
        inputPath = videoFile.path;
        outputPath = path.join(tempDir!, "output.mp4");

        const duration = endTimeNum - startTimeNum;
        const ffmpegCommand = [
          "ffmpeg",
          "-y",
          "-ss",
          startTimeNum.toString(),
          "-i",
          `"${inputPath}"`,
          "-t",
          duration.toString(),
          "-c",
          "copy",
          "-avoid_negative_ts",
          "make_zero",
          "-movflags",
          "+faststart",
          `"${outputPath}"`,
        ].join(" ");

        console.log("FFmpeg command:", ffmpegCommand);
        await execAsync(ffmpegCommand);

        finalVideoPath = outputPath!;
        originalFilename = (videoFile.originalname || "video").replace(
          /\.[^/.]+$/,
          ""
        );
      } else {
        return res.status(400).json({ error: "Invalid processing type" });
      }

      // Stream the file instead of loading it into memory
      const stat = await fsPromises.stat(finalVideoPath);

      const startMinutes = Math.floor(startTimeNum / 60);
      const startSeconds = Math.floor(startTimeNum % 60);
      const endMinutes = Math.floor(endTimeNum / 60);
      const endSecondsRemainder = Math.floor(endTimeNum % 60);

      const filename = `${originalFilename}_clip_${startMinutes}m${startSeconds}s-${endMinutes}m${endSecondsRemainder}s.mp4`;

      console.log(
        `Successfully processed clip: ${filename} (${stat.size} bytes)`
      );

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", stat.size.toString());
      res.setHeader("Cache-Control", "no-cache");

      // Stream the file instead of loading into memory
      const readStream = createReadStream(finalVideoPath);

      // Handle cleanup after streaming is complete
      const cleanup = async () => {
        try {
          if (inputPath && existsSync(inputPath)) await unlink(inputPath);
          if (outputPath && existsSync(outputPath)) await unlink(outputPath);
          if (tempClipPath && existsSync(tempClipPath))
            await unlink(tempClipPath);
          if (tempDir && existsSync(tempDir)) {
            const files = await readdir(tempDir);
            for (const file of files) {
              await unlink(path.join(tempDir, file));
            }
            await rmdir(tempDir);
          }
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        }
      };

      // Cleanup when stream ends or errors
      readStream.on("end", cleanup);
      readStream.on("close", cleanup);
      readStream.on("error", cleanup);

      // Also cleanup if response ends unexpectedly
      res.on("close", cleanup);

      readStream.pipe(res);
    } catch (error) {
      console.error("Video clipping error:", error);

      let errorMessage = "Failed to process video clip";
      if (error instanceof Error) {
        if (error.message.includes("yt-dlp")) {
          errorMessage =
            "Failed to download YouTube video. Please check the URL and try again.";
        } else if (error.message.includes("ffmpeg")) {
          errorMessage =
            "Failed to process video. Please check the file format and try again.";
        } else {
          errorMessage = error.message;
        }
      }

      // Cleanup on error
      try {
        if (inputPath && existsSync(inputPath)) await unlink(inputPath);
        if (outputPath && existsSync(outputPath)) await unlink(outputPath);
        if (tempClipPath && existsSync(tempClipPath))
          await unlink(tempClipPath);
        if (tempDir && existsSync(tempDir)) {
          const files = await readdir(tempDir);
          for (const file of files) {
            await unlink(path.join(tempDir, file));
          }
          await rmdir(tempDir);
        }
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }

      return res.status(500).json({ error: errorMessage });
    }
  }
);

export { router as videoRoutes };
