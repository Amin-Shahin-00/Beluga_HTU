export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function checkMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Cross-origin requests are not allowed." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "Content-Type must be application/json." }, 415);
  return null;
}
export async function readObject(request: Request, maxBytes = 8192): Promise<Record<string, unknown> | null> {
  try {
    if (Number(request.headers.get('content-length') || 0) > maxBytes) return null;
    const reader=request.body?.getReader();
    if (!reader) return null;
    const decoder=new TextDecoder();let text='';let size=0;
    while(true) {const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();return null;}text+=decoder.decode(value,{stream:true});}
    text+=decoder.decode();
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
