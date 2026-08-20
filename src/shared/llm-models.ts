export function buildLlmModelsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/models`;
}

export function parseLlmModelIds(payload: unknown): string[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("data" in payload) ||
    !Array.isArray(payload.data)
  ) {
    throw new Error("The provider returned an invalid model list.");
  }

  const modelIds = payload.data.flatMap((item) => {
    if (!item || typeof item !== "object" || !("id" in item)) return [];
    const id = typeof item.id === "string" ? item.id.trim() : "";
    return id ? [id] : [];
  });

  return [...new Set(modelIds)].sort((left, right) =>
    left.localeCompare(right),
  );
}
