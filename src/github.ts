import type { Env } from "./types";

const API_BASE = "https://api.github.com";

function ghHeaders(env: Env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "price-radar-worker",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function getFile(env: Env, path: string) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN تنظیم نشده یا خالیه");
  const res = await fetch(`${API_BASE}/repos/${env.GITHUB_REPO}/contents/${path}`, { headers: ghHeaders(env) });
  if (!res.ok) throw new Error(`GitHub getFile ${path} failed: ${res.status}`);
  const data: any = await res.json();
  const content = atob(data.content.replace(/\n/g, ""));
  return { content, sha: data.sha as string };
}

async function putFile(env: Env, path: string, content: string, sha: string, message: string) {
  const res = await fetch(`${API_BASE}/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: ghHeaders(env),
    body: JSON.stringify({ message, content: btoa(content), sha }),
  });
  if (!res.ok) throw new Error(`GitHub putFile ${path} failed: ${res.status}`);
}

export async function addUrlToWatchlist(env: Env, id: string, url: string, title: string): Promise<boolean> {
  const { content, sha } = await getFile(env, "watchlist.json");
  const list: { id: string; url: string; title: string }[] = JSON.parse(content);
  if (list.some((p) => p.id === id)) return false;
  list.push({ id, url, title });
  await putFile(env, "watchlist.json", JSON.stringify(list, null, 2), sha, `add product ${id}`);
  return true;
}

export async function triggerScrapeWorkflow(env: Env) {
  const res = await fetch(`${API_BASE}/repos/${env.GITHUB_REPO}/actions/workflows/scrape.yml/dispatches`, {
    method: "POST",
    headers: ghHeaders(env),
    body: JSON.stringify({ ref: "main" }),
  });
  if (!res.ok) console.log("workflow dispatch failed:", res.status, await res.text());
}

export async function fetchLatestPrices(env: Env) {
  const res = await fetch(`https://raw.githubusercontent.com/${env.GITHUB_REPO}/main/prices.json`, { cf: { cacheTtl: 0 } as any });
  if (!res.ok) throw new Error(`fetch prices.json failed: ${res.status}`);
  return res.json() as Promise<{
    updatedAt: string;
    products: { id: string; url: string; title: string; price?: number; available?: boolean; source?: string; error: string | null }[];
  }>;
}
