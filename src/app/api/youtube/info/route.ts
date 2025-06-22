import { NextRequest, NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
import { isValidYouTubeUrl, extractVideoId } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Could not extract video ID from URL" },
        { status: 400 }
      );
    }

    const normalizedUrl = url.includes("/shorts/")
      ? `https://www.youtube.com/watch?v=${videoId}`
      : url;

    const isValid = ytdl.validateURL(normalizedUrl);
    if (!isValid) {
      return NextResponse.json(
        {
          error:
            "Video is not available (may be private, restricted, or deleted)",
        },
        { status: 400 }
      );
    }

    const info = await ytdl.getInfo(normalizedUrl);
    const videoDetails = info.videoDetails;

    const duration = parseInt(videoDetails.lengthSeconds);

    if (duration > 900) {
      return NextResponse.json(
        { error: "Video duration exceeds 15 minutes limit" },
        { status: 400 }
      );
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

    return NextResponse.json({
      title: videoDetails.title,
      duration,
      thumbnail: videoDetails.thumbnails[0]?.url,
      formats: formats.slice(0, 3),
      videoId,
      warning: isLongVideo
        ? "This video is over 10 minutes long and may take longer to process"
        : null,
    });
  } catch (error) {
    console.error("YouTube info error:", error);

    if (error instanceof Error) {
      if (error.message.includes("Could not extract functions")) {
        return NextResponse.json(
          {
            error:
              "Unable to process this YouTube video. This may be due to YouTube's recent changes or regional restrictions. Please try a different video.",
          },
          { status: 400 }
        );
      }
      if (error.message.includes("Video unavailable")) {
        return NextResponse.json(
          { error: "Video is unavailable or restricted" },
          { status: 400 }
        );
      }
      if (error.message.includes("private")) {
        return NextResponse.json(
          { error: "Video is private" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch video information" },
      { status: 500 }
    );
  }
}
