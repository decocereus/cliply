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
