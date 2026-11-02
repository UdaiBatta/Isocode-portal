export type SearchParams = Record<string, string | string[] | undefined>;

export function previewState(params: SearchParams): "loading" | "empty" | null {
  if (process.env.NEXT_PUBLIC_PROTO !== "1") return null;
  if (params.state === "error") throw new Error("Prototype error preview");
  return params.state === "loading" || params.state === "empty" ? params.state : null;
}
