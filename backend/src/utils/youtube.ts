import { spawn, exec } from "child_process";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import {
  proxyManager,
  loadProxiesFromConfig,
  ProxyManager,
} from "./proxy-manager";
import { proxyRefreshService } from "./proxy-refresh";
import { getSecureCookiePath } from "./cookie-security";

const execAsync = promisify(exec);

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

const downloadYtDlp = async (): Promise<boolean> => {
  try {
    console.log("🔄 Downloading yt-dlp binary at runtime...");
    const binDir = path.join(process.cwd(), "bin");
    const ytDlpPath = path.join(binDir, "yt-dlp");

    // Create bin directory if it doesn't exist
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    await execAsync(
      `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${ytDlpPath} && chmod +x ${ytDlpPath}`
    );

    if (fs.existsSync(ytDlpPath)) {
      console.log("✅ yt-dlp downloaded successfully");
      return true;
    }
  } catch (error) {
    console.error("❌ Failed to download yt-dlp:", error);
  }
  return false;
};

// Function to find yt-dlp executable path
const findYtDlpPath = async (): Promise<string> => {
  // Check the paths in order of preference
  const possiblePaths = [
    path.resolve(__dirname, "../../bin/yt-dlp"),
    path.join(process.cwd(), "yt-dlp"),
    path.join(__dirname, "../yt-dlp"),
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    "/opt/render/.local/bin/yt-dlp",
    "yt-dlp",
  ];

  for (const ytDlpPath of possiblePaths) {
    try {
      if (fs.existsSync(ytDlpPath)) {
        console.log(`Found yt-dlp at: ${ytDlpPath}`);
        return ytDlpPath;
      }
    } catch (error) {
      console.error(`Error checking path ${ytDlpPath}:`, error);
    }
  }

  const downloaded = await downloadYtDlp();
  if (downloaded) {
    return path.join(process.cwd(), "bin", "yt-dlp");
  }

  console.log("Using system PATH for yt-dlp");
  return "yt-dlp";
};

class YouTubeRequestQueue {
  private queue: Array<{
    request: () => Promise<any>;
    retries: number;
    maxRetries: number;
  }> = [];
  private processing = false;
  private readonly delay = 2000;
  private readonly maxRetries = 3;

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
        if (item.retries < item.maxRetries && this.shouldRetry(error)) {
          item.retries++;
          console.log(
            `Retrying request (attempt ${item.retries}/${item.maxRetries})`
          );

          await new Promise((resolve) =>
            setTimeout(resolve, this.delay * item.retries)
          );

          this.queue.unshift(item);
        } else {
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

export const youtubeQueue = new YouTubeRequestQueue();

loadProxiesFromConfig();

console.log("🚀 Initializing automatic proxy refresh system...");
proxyRefreshService.start();

const videoInfoCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 3600000;

export const executeYtDlpWithProxy = async (
  args: string[],
  timeout: number = 30000
): Promise<{ stdout: string; stderr: string }> => {
  const proxy = null; // Disabled per user request
  let ytDlpArgs = [...args];

  console.log("🚫 Proxy disabled - running yt-dlp without proxy");

  const ytDlpPath = await findYtDlpPath();
  console.log(`🔧 Using yt-dlp at: ${ytDlpPath}`);
  console.log(`🔧 Full command: ${ytDlpPath} ${ytDlpArgs.join(" ")}`);

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
      reject(new Error("yt-dlp timeout"));
    }, timeout);

    ytDlp.on("close", (code) => {
      clearTimeout(timeoutHandle);

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`yt-dlp failed: ${stderr || "Unknown error"}`);
        reject(error);
      }
    });

    ytDlp.on("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });
  });
};

export const getVideoInfoWithYtDlp = async (url: string): Promise<any> => {
  const strategies = [
    {
      name: "iOS + Web (with geo-bypass)",
      args: [
        "--dump-json",
        "--no-warnings",
        "--no-check-certificates",
        "--geo-bypass",
        "--geo-bypass-country",
        "US",
        "--extractor-args",
        "youtube:player_client=ios,web",
        "--user-agent",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        "--add-header",
        "Accept-Language:en-US,en;q=0.9",
        "--add-header",
        "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ],
    },
    {
      name: "Android + Web (with geo-bypass)",
      args: [
        "--dump-json",
        "--no-warnings",
        "--no-check-certificates",
        "--geo-bypass",
        "--geo-bypass-country",
        "US",
        "--extractor-args",
        "youtube:player_client=android,web",
        "--user-agent",
        "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "--add-header",
        "Accept-Language:en-US,en;q=0.9",
      ],
    },
    {
      name: "Web (latest Chrome with geo-bypass)",
      args: [
        "--dump-json",
        "--no-warnings",
        "--no-check-certificates",
        "--geo-bypass",
        "--geo-bypass-country",
        "US",
        "--extractor-args",
        "youtube:player_client=web",
        "--user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--add-header",
        "Accept-Language:en-US,en;q=0.9",
        "--add-header",
        "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      ],
    },
    {
      name: "Mobile Web (fallback)",
      args: [
        "--dump-json",
        "--no-warnings",
        "--no-check-certificates",
        "--geo-bypass",
        "--extractor-args",
        "youtube:player_client=mweb",
        "--user-agent",
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "--add-header",
        "Accept-Language:en-US,en;q=0.9",
      ],
    },
  ];

  let lastError: Error | null = null;

  for (const strategy of strategies) {
    try {
      console.log(`🎯 Trying extraction strategy: ${strategy.name}`);

      const args = [...strategy.args];

      const secureCookiePath = getSecureCookiePath();
      if (secureCookiePath && fs.existsSync(secureCookiePath)) {
        args.push("--cookies", secureCookiePath);
      }

      args.push(url);

      const { stdout: jsonData, stderr: errorData } =
        await executeYtDlpWithProxy(args, 45000); // Increased timeout for geo-bypass

      if (jsonData) {
        try {
          const lines = jsonData
            .trim()
            .split("\n")
            .filter((line) => line.trim());
          const lastLine = lines[lines.length - 1];
          const videoInfo = JSON.parse(lastLine);
          console.log(`✅ Successfully extracted with: ${strategy.name}`);
          return videoInfo;
        } catch (e) {
          throw new Error("Failed to parse video info: " + e);
        }
      } else {
        if (
          errorData.includes("429") ||
          errorData.includes("Too Many Requests")
        ) {
          throw new Error("YouTube rate limit exceeded");
        } else if (
          errorData.includes("403") ||
          errorData.includes("Forbidden")
        ) {
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
      console.log(`❌ Strategy ${strategy.name} failed: ${error.message}`);
      lastError = error;

      if (
        error.message.includes("rate limit") ||
        error.message.includes("Access forbidden")
      ) {
        throw error;
      }

      continue;
    }
  }

  throw lastError || new Error("All extraction strategies failed");
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
      return bHeight - aHeight;
    });

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
      "--extractor-args",
      "youtube:player_client=ios,web,android,mweb",
      "--user-agent",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "--add-header",
      "Accept-Language:en-US,en;q=0.9",
      "-o",
      "-",
    ];

    if (formatId) {
      args.push("-f", formatId);
    } else {
      args.push("-f", "best[ext=mp4][height<=1080]/best[ext=mp4]/best");
    }

    const secureCookiePath = getSecureCookiePath();
    if (secureCookiePath && fs.existsSync(secureCookiePath)) {
      args.push("--cookies", secureCookiePath);
    }

    if (proxy) {
      const proxyUrl = proxyManager.getProxyUrl(proxy);
      args.push("--proxy", proxyUrl);
      console.log(`Using proxy for download: ${proxy.host}:${proxy.port}`);
    }

    args.push(url);

    const ytDlp = spawn("yt-dlp", args);

    const filename = `${info.title
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")}.mp4`;

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
