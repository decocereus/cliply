export const isValidYouTubeUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;

  const youtubeRegex =
    /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  return youtubeRegex.test(url.trim());
};

export const validateYouTubeUrl = (
  url: string
): { isValid: boolean; error?: string; normalizedUrl?: string } => {
  if (!url || typeof url !== "string") {
    return { isValid: false, error: "URL is required" };
  }

  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return { isValid: false, error: "URL is required" };
  }

  try {
    new URL(
      trimmedUrl.startsWith("http") ? trimmedUrl : `https://${trimmedUrl}`
    );
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }

  if (!isValidYouTubeUrl(trimmedUrl)) {
    return { isValid: false, error: "Must be a valid YouTube URL" };
  }

  const videoId = extractVideoId(trimmedUrl);
  if (!videoId) {
    return { isValid: false, error: "Could not extract video ID from URL" };
  }

  const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return { isValid: true, normalizedUrl };
};

export const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const generateFileName = (
  title: string,
  startTime: number,
  endTime: number
): string => {
  const sanitizedTitle = title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_");
  const start = Math.floor(startTime);
  const end = Math.floor(endTime);
  return `${sanitizedTitle}_${start}s-${end}s.mp4`;
};

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import {
  proxyManager,
  loadProxiesFromConfig,
  ProxyManager,
} from "./proxy-manager";
import { proxyRefreshService } from "./proxy-refresh";
import { getSecureCookiePath } from "./cookie-security";

// Function to find yt-dlp executable path
const findYtDlpPath = (): string => {
  const possiblePaths = [
    "yt-dlp",
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "~/.local/bin/yt-dlp",
    "/opt/render/.local/bin/yt-dlp",
    "./yt-dlp", // For cases where we download it to the current directory
    path.join(process.cwd(), "yt-dlp"),
  ];

  // Check if yt-dlp exists in any of these paths
  for (const ytDlpPath of possiblePaths) {
    try {
      if (fs.existsSync(ytDlpPath)) {
        console.log(`Found yt-dlp at: ${ytDlpPath}`);
        return ytDlpPath;
      }
    } catch (error) {
      // Continue to next path
    }
  }

  // Default to 'yt-dlp' and let system PATH handle it
  console.log("Using default yt-dlp path");
  return "yt-dlp";
};

// Enhanced YouTube Request Queue with proxy rotation
class YouTubeRequestQueue {
  private queue: Array<{
    request: () => Promise<any>;
    retries: number;
    maxRetries: number;
  }> = [];
  private processing = false;
  private readonly delay = 2000; // 2 seconds between requests
  private readonly maxRetries = 3; // Maximum retry attempts per request

  async add<T>(
    request: () => Promise<T>,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        request: async () => {
          try {
            const result = await request();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
        retries: 0,
        maxRetries,
      });

      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      try {
        await item.request();
      } catch (error: any) {
        // If it's a rate limit or proxy error and we have retries left, retry with a different proxy
        if (item.retries < item.maxRetries && this.shouldRetry(error)) {
          item.retries++;
          console.log(
            `Retrying request (attempt ${item.retries}/${item.maxRetries})`
          );

          // Add delay before retry
          await new Promise((resolve) =>
            setTimeout(resolve, this.delay * item.retries)
          );

          // Push back to front of queue for immediate retry
          this.queue.unshift(item);
        } else {
          // Max retries exceeded or non-retryable error
          console.error(
            `Request failed after ${item.retries} retries:`,
            error.message
          );
        }
      }

      if (this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delay));
      }
    }

    this.processing = false;
  }

  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      "YouTube rate limit exceeded",
      "Access forbidden",
      "Network error",
      "Connection timeout",
      "Proxy error",
    ];

    return retryableErrors.some((errorType) =>
      error.message.toLowerCase().includes(errorType.toLowerCase())
    );
  }
}

// Global request queue instance
export const youtubeQueue = new YouTubeRequestQueue();

// Initialize proxy system
loadProxiesFromConfig();

// Start automatic proxy refresh service
console.log("🚀 Initializing automatic proxy refresh system...");
proxyRefreshService.start();

// Video info cache
const videoInfoCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

// Enhanced yt-dlp wrapper with proxy rotation
export const executeYtDlpWithProxy = async (
  args: string[],
  timeout: number = 30000
): Promise<{ stdout: string; stderr: string }> => {
  const proxy = proxyManager.getNextProxy();
  let ytDlpArgs = [...args];

  // Add proxy if available
  if (proxy) {
    const proxyUrl = proxyManager.getProxyUrl(proxy);
    ytDlpArgs.push("--proxy", proxyUrl);
    console.log(`Using proxy: ${proxy.host}:${proxy.port}`);
  }

  const ytDlpPath = findYtDlpPath();

  return new Promise((resolve, reject) => {
    const ytDlp = spawn(ytDlpPath, ytDlpArgs);

    let stdout = "";
    let stderr = "";

    ytDlp.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ytDlp.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timeoutHandle = setTimeout(() => {
      ytDlp.kill("SIGKILL");
      if (proxy) {
        proxyManager.reportFailure(proxy, new Error("yt-dlp timeout"));
      }
      reject(new Error("yt-dlp timeout"));
    }, timeout);

    ytDlp.on("close", (code) => {
      clearTimeout(timeoutHandle);

      if (code === 0) {
        if (proxy) {
          proxyManager.reportSuccess(proxy);
        }
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`yt-dlp failed: ${stderr || "Unknown error"}`);

        if (proxy) {
          // Check if it's a proxy-related error
          const isProxyError =
            stderr.includes("proxy") ||
            stderr.includes("connection") ||
            stderr.includes("timeout") ||
            stderr.includes("403") ||
            stderr.includes("429");

          if (isProxyError) {
            proxyManager.reportFailure(proxy, error);
          }
        }

        reject(error);
      }
    });

    ytDlp.on("error", (error) => {
      clearTimeout(timeoutHandle);
      if (proxy) {
        proxyManager.reportFailure(proxy, error);
      }
      reject(error);
    });
  });
};

// yt-dlp wrapper functions
export const getVideoInfoWithYtDlp = async (url: string): Promise<any> => {
  const args = [
    "--dump-json",
    "--no-warnings",
    "--no-check-certificates",
    "--extractor-args",
    "youtube:player_client=ios,web",
    "--user-agent",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15",
  ];

  // Add secure cookies if available
  const secureCookiePath = getSecureCookiePath();
  if (secureCookiePath && fs.existsSync(secureCookiePath)) {
    args.push("--cookies", secureCookiePath);
  }

  // Add URL at the end
  args.push(url);

  try {
    const { stdout: jsonData, stderr: errorData } = await executeYtDlpWithProxy(
      args,
      30000
    );

    if (jsonData) {
      try {
        const lines = jsonData
          .trim()
          .split("\n")
          .filter((line) => line.trim());
        const lastLine = lines[lines.length - 1];
        const videoInfo = JSON.parse(lastLine);
        return videoInfo;
      } catch (e) {
        throw new Error("Failed to parse video info: " + e);
      }
    } else {
      // Parse common yt-dlp errors
      if (
        errorData.includes("429") ||
        errorData.includes("Too Many Requests")
      ) {
        throw new Error("YouTube rate limit exceeded");
      } else if (errorData.includes("403") || errorData.includes("Forbidden")) {
        throw new Error("Access forbidden - video may be restricted");
      } else if (errorData.includes("Video unavailable")) {
        throw new Error("Video unavailable");
      } else if (errorData.includes("Private video")) {
        throw new Error("Video is private");
      } else {
        throw new Error(`yt-dlp failed: ${errorData || "Unknown error"}`);
      }
    }
  } catch (error: any) {
    // Re-throw with better error messages
    if (error.message.includes("yt-dlp timeout")) {
      throw new Error("yt-dlp timeout");
    }
    throw error;
  }
};

export const getCachedVideoInfo = async (url: string): Promise<any> => {
  const cached = videoInfoCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const info = await youtubeQueue.add(() => getVideoInfoWithYtDlp(url));
  videoInfoCache.set(url, { data: info, timestamp: Date.now() });
  return info;
};

export const getVideoFormats = async (url: string): Promise<any[]> => {
  const info = await getCachedVideoInfo(url);

  // Filter and format the available formats
  const formats = (info.formats || [])
    .filter(
      (format: any) =>
        format.vcodec !== "none" &&
        format.acodec !== "none" &&
        format.ext === "mp4" &&
        format.height
    )
    .map((format: any) => ({
      quality: `${format.height}p`,
      format: format.ext,
      filesize: format.filesize || format.filesize_approx,
      format_id: format.format_id,
      fps: format.fps,
    }))
    .sort((a: any, b: any) => {
      const aHeight = parseInt(a.quality);
      const bHeight = parseInt(b.quality);
      return bHeight - aHeight; // Sort by quality descending
    });

  // Remove duplicates and limit to top 3
  const uniqueFormats = formats.filter(
    (format: any, index: number, arr: any[]) => {
      return arr.findIndex((f) => f.quality === format.quality) === index;
    }
  );

  return uniqueFormats.slice(0, 3);
};

export const downloadVideoStream = async (
  url: string,
  formatId?: string
): Promise<{ stream: any; filename: string }> => {
  try {
    const info = await getCachedVideoInfo(url);
    const proxy = proxyManager.getNextProxy();

    const args = [
      "--no-warnings",
      "--no-check-certificates",
      "--user-agent",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15",
      "-o",
      "-", // Output to stdout
    ];

    if (formatId) {
      args.push("-f", formatId);
    } else {
      args.push("-f", "best[ext=mp4][height<=1080]/best[ext=mp4]/best");
    }

    // Add secure cookies if available
    const secureCookiePath = getSecureCookiePath();
    if (secureCookiePath && fs.existsSync(secureCookiePath)) {
      args.push("--cookies", secureCookiePath);
    }

    // Add proxy if available
    if (proxy) {
      const proxyUrl = proxyManager.getProxyUrl(proxy);
      args.push("--proxy", proxyUrl);
      console.log(`Using proxy for download: ${proxy.host}:${proxy.port}`);
    }

    // Add URL at the end
    args.push(url);

    const ytDlp = spawn("yt-dlp", args);

    const filename = `${info.title
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")}.mp4`;

    // Handle proxy success/failure reporting
    ytDlp.on("exit", (code) => {
      if (proxy) {
        if (code === 0) {
          proxyManager.reportSuccess(proxy);
        } else {
          proxyManager.reportFailure(
            proxy,
            new Error(`Download failed with code ${code}`)
          );
        }
      }
    });

    ytDlp.stderr.on("data", (data) => {
      const errorOutput = data.toString();
      console.error("yt-dlp stderr:", errorOutput);

      // Check for proxy-related errors
      if (
        proxy &&
        (errorOutput.includes("proxy") || errorOutput.includes("connection"))
      ) {
        proxyManager.reportFailure(
          proxy,
          new Error("Proxy connection error during download")
        );
      }
    });

    ytDlp.on("error", (error) => {
      if (proxy) {
        proxyManager.reportFailure(proxy, error);
      }
      throw error;
    });

    return { stream: ytDlp.stdout, filename };
  } catch (error) {
    throw error;
  }
};
