import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export const getFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg && ffmpeg.loaded) {
    return ffmpeg;
  }

  ffmpeg = new FFmpeg();

  console.log("Loading FFmpeg...");

  // Load FFmpeg using the locally installed core package
  await ffmpeg.load();

  console.log("FFmpeg loaded successfully");
  return ffmpeg;
};

export const clipVideo = async (
  videoFile: File,
  startTime: number,
  endTime: number,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  const ffmpeg = await getFFmpeg();

  // Clear any existing files
  try {
    await ffmpeg.deleteFile("input.mp4");
    await ffmpeg.deleteFile("output.mp4");
  } catch (e) {
    // Files don't exist, ignore
  }

  // Write input file
  await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

  // Set up progress tracking
  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => {
      onProgress(Math.round(progress * 100));
    });
  }

  // Calculate duration
  const duration = endTime - startTime;

  // Run FFmpeg command to clip video
  // Using -c copy to maintain quality when possible
  await ffmpeg.exec([
    "-i",
    "input.mp4",
    "-ss",
    startTime.toString(),
    "-t",
    duration.toString(),
    "-c",
    "copy",
    "-avoid_negative_ts",
    "make_zero",
    "output.mp4",
  ]);

  // Read the output file
  const data = await ffmpeg.readFile("output.mp4");
  const videoBlob = new Blob([new Uint8Array(data as unknown as ArrayBuffer)], {
    type: "video/mp4",
  });

  // Cleanup
  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("output.mp4");

  return videoBlob;
};

export const getVideoMetadata = async (
  videoFile: File
): Promise<{
  duration: number;
  format: string;
}> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        format: videoFile.type,
      });
      URL.revokeObjectURL(video.src);
    };

    video.onerror = () => {
      reject(new Error("Failed to load video metadata"));
      URL.revokeObjectURL(video.src);
    };

    video.src = URL.createObjectURL(videoFile);
  });
};

export const validateVideoFile = (
  file: File
): { isValid: boolean; error?: string } => {
  const maxSize = 800 * 1024 * 1024; // 800MB
  const supportedTypes = [
    "video/mp4",
    "video/avi",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska", // MKV
    "video/webm",
  ];

  if (file.size > maxSize) {
    return { isValid: false, error: "File size exceeds 800MB limit" };
  }

  // Check MIME type first
  const isSupportedType = supportedTypes.includes(file.type);

  // Fallback to file extension check for formats with inconsistent MIME types
  let isSupportedExtension = false;
  if (!isSupportedType) {
    const extension = file.name.toLowerCase().split(".").pop();
    isSupportedExtension = Boolean(
      extension &&
        ["mp4", "avi", "mov", "mkv", "webm", "m4v"].includes(extension)
    );
  }

  if (!isSupportedType && !isSupportedExtension) {
    return {
      isValid: false,
      error: "Supported formats: MP4, AVI, MOV, MKV, WebM",
    };
  }

  return { isValid: true };
};

export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
};

export const parseTimeString = (timeString: string): number => {
  const [minutes, seconds] = timeString.split(":").map(Number);
  return (minutes || 0) * 60 + (seconds || 0);
};
