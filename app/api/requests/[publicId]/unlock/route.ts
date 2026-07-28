import { createAccessToken, accessCookieName } from "@/lib/security/signed-access";
import { assertSameOrigin, hashClientAddress } from "@/lib/security/request-guard";
import { verifyPrivateRequestAccess } from "@/lib/logic/request-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { publicId } = await params;
    const payload = (await request.json()) as { password?: unknown };
    const password = typeof payload.password === "string" ? payload.password : "";
    if (password.length < 8 || password.length > 64) {
      return Response.json({ error: "비밀번호를 확인해 주세요." }, { status: 400 });
    }
    const result = await verifyPrivateRequestAccess(
      publicId,
      password,
      await hashClientAddress(request),
    );
    if (!result.ok) {
      const blocked = result.reason === "BLOCKED";
      return Response.json(
        {
          error: blocked
            ? "입력 횟수를 초과했습니다. 15분 뒤 다시 시도해 주세요."
            : "비밀번호가 일치하지 않습니다.",
        },
        { status: blocked ? 429 : 401 },
      );
    }
    const token = await createAccessToken(publicId);
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return Response.json(
      { ok: true },
      {
        headers: {
          "set-cookie": `${accessCookieName(publicId)}=${token}; Path=/requests/${publicId}; Max-Age=600; HttpOnly; SameSite=Lax${secure}`,
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    const invalidOrigin = error instanceof Error && error.message === "INVALID_ORIGIN";
    return Response.json(
      { error: invalidOrigin ? "요청 출처가 올바르지 않습니다." : "확인 중 오류가 발생했습니다." },
      { status: invalidOrigin ? 403 : 500 },
    );
  }
}
