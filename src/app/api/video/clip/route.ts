import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir, readFile, rmdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { existsSync } from "fs";

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
  let inputPath: string | null = null;
  let outputPath: string | null = null;
  let tempClipPath: string | null = null;

  try {
    const formData = await request.formData();
    const processingType = formData.get("type") as string;
    const startTime = parseFloat(formData.get("startTime") as string);
    const endTime = parseFloat(formData.get("endTime") as string);

    if (!processingType || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const sessionId = randomUUID();
    tempDir = path.join(process.cwd(), "temp", sessionId);
    await mkdir(tempDir, { recursive: true });

    let finalVideoPath: string;
    let originalFilename = "video";

    if (processingType === "youtube") {
      const youtubeUrl = formData.get("youtubeUrl") as string;
      if (!youtubeUrl) {
        return NextResponse.json(
          { error: "YouTube URL is required" },
          { status: 400 }
        );
      }

      console.log(`Processing YouTube video: ${youtubeUrl}`);
      console.log(`Time range: ${startTime}s - ${endTime}s`);

      const downloadPath = path.join(tempDir, "clip.%(ext)s");
      const ytDlpCommand = [
        "yt-dlp",
        `--download-sections "*${startTime}-${endTime}"`,
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

      finalVideoPath = outputPath;
      originalFilename = "youtube_clip";
    } else if (processingType === "upload") {
      const videoFile = formData.get("video") as File;
      if (!videoFile) {
        return NextResponse.json(
          { error: "Video file is required for upload processing" },
          { status: 400 }
        );
      }

      console.log(`Processing uploaded file: ${videoFile.name}`);
      console.log(`Time range: ${startTime}s - ${endTime}s`);

      const fileExtension = path.extname(videoFile.name) || ".mp4";
      inputPath = path.join(tempDir, `input${fileExtension}`);
      outputPath = path.join(tempDir, "output.mp4");

      const arrayBuffer = await videoFile.arrayBuffer();
      await writeFile(inputPath, new Uint8Array(arrayBuffer));

      const duration = endTime - startTime;
      const ffmpegCommand = [
        "ffmpeg",
        "-y",
        "-ss",
        startTime.toString(),
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

      finalVideoPath = outputPath;
      originalFilename = videoFile.name.replace(/\.[^/.]+$/, "");
    } else {
      return NextResponse.json(
        { error: "Invalid processing type" },
        { status: 400 }
      );
    }

    const outputBuffer = await readFile(finalVideoPath);

    const startMinutes = Math.floor(startTime / 60);
    const startSeconds = Math.floor(startTime % 60);
    const endMinutes = Math.floor(endTime / 60);
    const endSecondsRemainder = Math.floor(endTime % 60);

    const filename = `${originalFilename}_clip_${startMinutes}m${startSeconds}s-${endMinutes}m${endSecondsRemainder}s.mp4`;

    console.log(
      `Successfully processed clip: ${filename} (${outputBuffer.length} bytes)`
    );

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": outputBuffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
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

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    try {
      if (inputPath && existsSync(inputPath)) await unlink(inputPath);
      if (outputPath && existsSync(outputPath)) await unlink(outputPath);
      if (tempClipPath && existsSync(tempClipPath)) await unlink(tempClipPath);
      if (tempDir && existsSync(tempDir)) {
        const { readdir } = await import("fs/promises");
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
