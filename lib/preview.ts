export type SearchParams = Record<string, string | string[] | undefined>;

export function previewState(params: SearchParams): "loading" | "empty" | null {
  if (process.env.NEXT_PUBLIC_PROTO !== "1") return null;
  if (params.state === "error") throw new Error("Prototype error preview");
  return params.state === "loading" || params.state === "empty" ? params.state : null;
}

// Retrying a forced preview error has to drop ?state=error, or the same error comes straight back.
export function retryRoute(reset: () => void) {
  const url = new URL(window.location.href);
  if (process.env.NEXT_PUBLIC_PROTO === "1" && url.searchParams.get("state") === "error") {
    url.searchParams.delete("state");
    window.location.assign(url.pathname + url.search + url.hash);
  } else reset();
}
