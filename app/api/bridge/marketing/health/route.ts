import { authorizeMarketingBridge } from "@/lib/marketing/bridge-auth";

export async function GET(request: Request) {
  if (!(await authorizeMarketingBridge(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "private, no-store",
      "Retry-After": "60",
    },
  });
}
