import type { Bootstrap, Format, FormatInput, Idea, IdeaInput, Prompt, PromptKey, Status } from "./types";

async function req<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  if (!isJson) {
    // The static site answered instead of the API: the serverless function is missing or misrouted.
    throw new Error(`The API at ${url} did not answer (HTTP ${res.status}). Check the deployment: the /api function and the DATABASE_URL environment variable.`);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || res.statusText);
  return json as T;
}

export const api = {
  bootstrap: () => req<Bootstrap>("/api/bootstrap", "GET"),

  createIdea: (input: IdeaInput) => req<Idea>("/api/ideas", "POST", input),
  updateIdea: (id: number, patch: Partial<IdeaInput> & { status?: Status }) =>
    req<Idea>(`/api/ideas/${id}`, "PATCH", patch),
  deleteIdea: (id: number) => req<void>(`/api/ideas/${id}`, "DELETE"),

  createFormat: (input: FormatInput) => req<Format>("/api/formats", "POST", input),
  updateFormat: (id: number, patch: Partial<FormatInput> & { hasMaster?: boolean }) =>
    req<Format>(`/api/formats/${id}`, "PATCH", patch),
  deleteFormat: (id: number) => req<void>(`/api/formats/${id}`, "DELETE"),

  savePrompt: (key: PromptKey, body: string) => req<Prompt>(`/api/prompts/${key}`, "PUT", { body }),
};
