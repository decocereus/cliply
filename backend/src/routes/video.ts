import { Router, Request, Response } from "express";
import multer from "multer";
import { exec } from "child_process";
import { promisify } from "util";
import {
  writeFile,
  unlink,
  mkdir,
  readFile,
  rmdir,
  readdir,
} from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { existsSync } from "fs";

const execAsync = promisify(exec);
const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
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

      if (!processingType || !startTimeNum || !endTimeNum) {
        return res.status(400).json({ error: "Missing required parameters" });
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

        const downloadPath = path.join(tempDir, "clip.%(ext)s");
        const ytDlpCommand = [
          "yt-dlp",
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
        await execAsync(optimizeCommand);

        finalVideoPath = outputPath!;
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

        const fileExtension =
          path.extname(videoFile.originalname || "") || ".mp4";
        inputPath = path.join(tempDir!, `input${fileExtension}`);
        outputPath = path.join(tempDir!, "output.mp4");

        await writeFile(inputPath, videoFile.buffer);

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

      const outputBuffer = await readFile(finalVideoPath);

      const startMinutes = Math.floor(startTimeNum / 60);
      const startSeconds = Math.floor(startTimeNum % 60);
      const endMinutes = Math.floor(endTimeNum / 60);
      const endSecondsRemainder = Math.floor(endTimeNum % 60);

      const filename = `${originalFilename}_clip_${startMinutes}m${startSeconds}s-${endMinutes}m${endSecondsRemainder}s.mp4`;

      console.log(
        `Successfully processed clip: ${filename} (${outputBuffer.length} bytes)`
      );

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", outputBuffer.length.toString());
      res.setHeader("Cache-Control", "no-cache");

      res.send(outputBuffer);
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

      return res.status(500).json({ error: errorMessage });
    } finally {
      // Cleanup temporary files
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
    }
  }
);

export { router as videoRoutes };
