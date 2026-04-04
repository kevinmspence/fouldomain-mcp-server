#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.FOULDOMAIN_URL || "https://fouldomain.com";

async function api(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const server = new McpServer({
  name: "fouldomain",
  version: "1.1.0",
});

// ── Tool: Search for songs ──────────────────────────────────
server.tool(
  "search_songs",
  "Search for Phish songs by name. Returns song info, play counts, and audio stats.",
  { query: z.string().describe("Song name to search for (partial match)") },
  async ({ query }) => {
    const data = await api(`/api/public/song?q=${encodeURIComponent(query)}`);
    if (!data.songs?.length) return { content: [{ type: "text", text: "No songs found matching: " + query }] };
    const results = data.songs.map((s) => {
      let text = `${s.title} — ${s.timesPlayed} times (debut: ${s.debut}, last: ${s.lastPlayed}, gap: ${s.gap} shows)`;
      if (s.audio) text += `\n  ${s.audio.versions} analyzed | avg ${s.audio.avgMinutes}m | ${s.audio.avgBpm} BPM | avg score: ${s.audio.avgScore} | top: ${s.audio.topScore}`;
      text += `\n  ${s.link}`;
      return text;
    });
    return { content: [{ type: "text", text: results.join("\n\n") }] };
  }
);

// ── Tool: Best versions of a song ───────────────────────────
server.tool(
  "best_versions",
  "Get the top-rated versions of a specific Phish song, ranked by performance score.",
  {
    song: z.string().describe("Song title (exact or partial match)"),
    limit: z.number().optional().default(10).describe("Number of results (default 10, max 25)"),
  },
  async ({ song, limit }) => {
    const n = Math.min(limit || 10, 25);
    const data = await api(`/api/public/best-versions?song=${encodeURIComponent(song)}&limit=${n}`);
    if (!data.tracks?.length) return { content: [{ type: "text", text: "No versions found for: " + song }] };
    const results = data.tracks.map((t, i) => {
      const tags = t.tags?.length ? ` | Tags: ${t.tags.join(", ")}` : "";
      return `#${i + 1} ${t.date} — ${t.venue}, ${t.city}${t.state ? ", " + t.state : ""}\n` +
        `  Score: ${t.score} | ${Math.round(t.duration / 60)}m | ${t.bpm} BPM | Groove: ${t.groove} | Likes: ${t.likes}${tags}\n` +
        `  ${t.link}`;
    });
    return { content: [{ type: "text", text: `Top ${data.tracks.length} versions of ${data.tracks[0].song}:\n\n${results.join("\n\n")}` }] };
  }
);

// ── Tool: Show details ──────────────────────────────────────
server.tool(
  "get_show",
  "Get details about a specific Phish show by date (YYYY-MM-DD format).",
  { date: z.string().describe("Show date in YYYY-MM-DD format") },
  async ({ date }) => {
    const data = await api(`/api/public/show?date=${encodeURIComponent(date)}`);
    if (data.error) return { content: [{ type: "text", text: "No show found on: " + date }] };

    let text = `Phish — ${data.date}\n${data.venue}, ${data.city}${data.state ? ", " + data.state : ""}\nTour: ${data.tour || "N/A"}`;
    if (data.showScore) text += `\nShow Score: ${data.showScore}/100`;
    if (data.pnetRating) text += ` | Phish.net Rating: ${data.pnetRating.toFixed(2)}/5`;
    text += `\nhttps://fouldomain.com/shows/${data.id}\n`;

    let currentSet = "";
    for (const entry of data.setlist) {
      if (entry.set !== currentSet) {
        currentSet = entry.set;
        text += `\nSet ${currentSet === "E" ? "Encore" : currentSet}:\n`;
      }
      const score = entry.score ? ` [${entry.score}]` : "";
      const dur = entry.duration ? ` (${Math.round(entry.duration / 60)}m)` : "";
      const trans = entry.transition === ">" ? " >" : entry.transition === "->" ? " ->" : "";
      text += `  ${entry.title}${dur}${score}${trans}\n`;
    }
    return { content: [{ type: "text", text }] };
  }
);

// ── Tool: Top shows ─────────────────────────────────────────
server.tool(
  "top_shows",
  "Get the highest-rated Phish shows, optionally filtered by year or tour.",
  {
    year: z.number().optional().describe("Filter by year (e.g. 1997)"),
    tour: z.string().optional().describe("Filter by tour name (partial match)"),
    limit: z.number().optional().default(10).describe("Number of results (default 10, max 25)"),
  },
  async ({ year, tour, limit }) => {
    const params = new URLSearchParams();
    if (year) params.set("year", String(year));
    if (tour) params.set("tour", tour);
    params.set("limit", String(Math.min(limit || 10, 25)));
    const data = await api(`/api/public/top-shows?${params}`);
    if (!data.shows?.length) return { content: [{ type: "text", text: "No shows found" }] };
    const results = data.shows.map((s, i) => {
      const rating = s.pnetRating ? ` | Rating: ${s.pnetRating.toFixed(2)}` : "";
      return `#${i + 1} ${s.score} — ${s.date} — ${s.venue}, ${s.city}${s.state ? ", " + s.state : ""}${rating}\n  ${s.link}`;
    });
    return { content: [{ type: "text", text: results.join("\n\n") }] };
  }
);

// ── Tool: Song stats ────────────────────────────────────────
server.tool(
  "song_stats",
  "Get detailed statistics about a Phish song: total plays, debut, gap, average duration, and audio analysis.",
  { song: z.string().describe("Song title (exact or partial match)") },
  async ({ song }) => {
    const data = await api(`/api/public/song?q=${encodeURIComponent(song)}`);
    if (!data.songs?.length) return { content: [{ type: "text", text: "Song not found: " + song }] };
    const s = data.songs[0];
    let text = `${s.title}\nType: ${s.original ? "Original" : "Cover"}\nTimes played: ${s.timesPlayed}\nDebut: ${s.debut} | Last: ${s.lastPlayed} | Gap: ${s.gap} shows\nVenues: ${s.venues}`;
    if (s.audio) {
      text += `\n\nAudio Analysis (${s.audio.versions} versions):\n  Avg duration: ${s.audio.avgMinutes}m\n  Avg BPM: ${s.audio.avgBpm} | Avg score: ${s.audio.avgScore} | Top score: ${s.audio.topScore}`;
    }
    text += `\n\n${s.link}`;
    return { content: [{ type: "text", text }] };
  }
);

// ── Tool: Find jams by style ────────────────────────────────
server.tool(
  "find_jams",
  "Find Phish jams matching specific audio characteristics. Filter by BPM range, minimum duration, groove, and jam chart tags.",
  {
    min_bpm: z.number().optional().describe("Minimum BPM"),
    max_bpm: z.number().optional().describe("Maximum BPM"),
    min_duration_minutes: z.number().optional().describe("Minimum duration in minutes"),
    min_groove: z.number().optional().describe("Minimum groove score (0-100)"),
    tag: z.string().optional().describe("Jam chart tag filter (e.g. 'Type II', 'Bliss', 'Funk', 'Dark')"),
    limit: z.number().optional().default(10).describe("Number of results (default 10, max 25)"),
  },
  async ({ min_bpm, max_bpm, min_duration_minutes, min_groove, tag, limit }) => {
    const params = new URLSearchParams();
    if (min_bpm) params.set("minBpm", String(min_bpm));
    if (max_bpm) params.set("maxBpm", String(max_bpm));
    if (min_duration_minutes) params.set("minDuration", String(min_duration_minutes));
    if (min_groove) params.set("minGroove", String(min_groove));
    if (tag) params.set("tag", tag);
    params.set("limit", String(Math.min(limit || 10, 25)));
    const data = await api(`/api/public/find-jams?${params}`);
    if (!data.tracks?.length) return { content: [{ type: "text", text: "No jams found matching those criteria." }] };
    const results = data.tracks.map((t, i) => {
      const tags = t.tags?.length ? ` | ${t.tags.join(", ")}` : "";
      return `#${i + 1} ${t.song} — ${t.date} — ${t.venue}\n` +
        `  Score: ${t.score} | ${Math.round(t.duration / 60)}m | ${t.bpm} BPM | Groove: ${t.groove}${tags}\n` +
        `  ${t.link}`;
    });
    return { content: [{ type: "text", text: results.join("\n\n") }] };
  }
);

// ── Connect ─────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
