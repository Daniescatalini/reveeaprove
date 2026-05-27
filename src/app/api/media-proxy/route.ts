import { NextRequest, NextResponse } from "next/server";

function inferContentType(url: string, upstreamType: string | null) {
  if (upstreamType && upstreamType !== "application/octet-stream") return upstreamType;
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".mov")) return "video/quicktime";
  if (path.endsWith(".m4v") || path.endsWith(".mp4")) return "video/mp4";
  return upstreamType ?? "application/octet-stream";
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) return new NextResponse("Missing media URL", { status: 400 });

  let mediaUrl: URL;
  try {
    mediaUrl = new URL(target);
  } catch {
    return new NextResponse("Invalid media URL", { status: 400 });
  }

  const isSupabaseMedia =
    mediaUrl.hostname.endsWith(".supabase.co") &&
    mediaUrl.pathname.includes("/storage/v1/object/public/post-media/");

  if (!isSupabaseMedia) return new NextResponse("Media URL not allowed", { status: 403 });

  const upstream = await fetch(mediaUrl, {
    headers: {
      ...(request.headers.get("range") ? { range: request.headers.get("range")! } : {})
    }
  });

  const headers = new Headers();
  const contentType = inferContentType(mediaUrl.href, upstream.headers.get("content-type"));
  headers.set("content-type", contentType);
  headers.set("accept-ranges", upstream.headers.get("accept-ranges") ?? "bytes");
  headers.set("cache-control", "public, max-age=86400");
  headers.set("content-disposition", "inline");

  const contentLength = upstream.headers.get("content-length");
  const contentRange = upstream.headers.get("content-range");
  if (contentLength) headers.set("content-length", contentLength);
  if (contentRange) headers.set("content-range", contentRange);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers
  });
}
