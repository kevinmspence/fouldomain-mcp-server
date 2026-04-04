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

// Era name → year range mapping
const ERAS = {
  "1.0": [1983, 2000],
  "2.0": [2003, 2004],
  "3.0": [2009, 2019],
  "4.0": [2021, 2030],
};

function resolveYears({ year, start_year, end_year, era }) {
  if (era && ERAS[era]) {
    const [s, e] = ERAS[era];
    return { startYear: start_year || s, endYear: end_year || e };
  }
  return { year, startYear: start_year, endYear: end_year };
}

function addYearParams(params, { year, startYear, endYear }) {
  if (year) params.set("year", String(year));
  if (startYear) params.set("startYear", String(startYear));
  if (endYear) params.set("endYear", String(endYear));
}

const yearFields = {
  year: z.number().optional().describe("Filter to a single year (e.g. 2004)"),
  start_year: z.number().optional().describe("Start of year range (e.g. 1997)"),
  end_year: z.number().optional().describe("End of year range (e.g. 1999)"),
  era: z.string().optional().describe("Phish era: '1.0' (1983-2000), '2.0' (2003-2004), '3.0' (2009-2019), '4.0' (2021+)"),
};

const server = new McpServer({
  name: "fouldomain",
  version: "2.0.0",
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
  "Get the top-rated versions of a specific Phish song. Filter by year, year range, era, venue, or state.",
  {
    song: z.string().describe("Song title (exact or partial match)"),
    ...yearFields,
    venue: z.string().optional().describe("Filter by venue name (partial match, e.g. 'MSG', 'Garden')"),
    state: z.string().optional().describe("Filter by state (e.g. 'NY', 'Colorado')"),
    limit: z.number().optional().default(10).describe("Number of results (default 10, max 25)"),
  },
  async ({ song, year, start_year, end_year, era, venue, state, limit }) => {
    const params = new URLSearchParams();
    params.set("song", song);
    params.set("limit", String(Math.min(limit || 10, 25)));
    addYearParams(params, resolveYears({ year, start_year, end_year, era }));
    if (venue) params.set("venue", venue);
    if (state) params.set("state", state);
    const data = await api(`/api/public/best-versions?${params}`);
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
        text += `\nSet ${currentSet === "E" ? "e" : currentSet}:\n`;
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
  "Get the highest-rated Phish shows. Filter by year, year range, era, tour, venue, or state.",
  {
    ...yearFields,
    tour: z.string().optional().describe("Filter by tour name (partial match)"),
    venue: z.string().optional().describe("Filter by venue name (partial match)"),
    state: z.string().optional().describe("Filter by state (e.g. 'NY', 'Vermont')"),
    limit: z.number().optional().default(10).describe("Number of results (default 10, max 25)"),
  },
  async ({ year, start_year, end_year, era, tour, venue, state, limit }) => {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(limit || 10, 25)));
    addYearParams(params, resolveYears({ year, start_year, end_year, era }));
    if (tour) params.set("tour", tour);
    if (venue) params.set("venue", venue);
    if (state) params.set("state", state);
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
  "Find Phish jams matching specific criteria. Filter by song, year/era, venue, state, tags (Dark, Funk, Bliss, Type II, etc.), BPM, duration, groove. Sort by score, duration, or groove.",
  {
    song: z.string().optional().describe("Filter by song name (e.g. 'Tweezer', 'Piper')"),
    tags: z.string().optional().describe("Comma-separated jam tags (e.g. 'Dark,Funk'). Available: Type I, Type II, Funk, Bliss, Dark, Ambient, Rock, Peak, Build, Experimental"),
    ...yearFields,
    venue: z.string().optional().describe("Filter by venue name (partial match)"),
    state: z.string().optional().describe("Filter by state (e.g. 'CO', 'New York')"),
    min_bpm: z.number().optional().describe("Minimum BPM"),
    max_bpm: z.number().optional().describe("Maximum BPM"),
    min_duration_minutes: z.number().optional().describe("Minimum duration in minutes"),
    min_groove: z.number().optional().describe("Minimum groove score (0-100)"),
    sort: z.string().optional().describe("Sort by: 'score' (default), 'duration', 'groove', 'bpm'"),
    limit: z.number().optional().default(10).describe("Number of results (default 10, max 25)"),
  },
  async ({ song, tags, year, start_year, end_year, era, venue, state, min_bpm, max_bpm, min_duration_minutes, min_groove, sort, limit }) => {
    const params = new URLSearchParams();
    if (min_bpm) params.set("minBpm", String(min_bpm));
    if (max_bpm) params.set("maxBpm", String(max_bpm));
    if (min_duration_minutes) params.set("minDuration", String(min_duration_minutes));
    if (min_groove) params.set("minGroove", String(min_groove));
    if (tags) params.set("tag", tags);
    if (song) params.set("song", song);
    if (venue) params.set("venue", venue);
    if (state) params.set("state", state);
    if (sort) params.set("sort", sort);
    addYearParams(params, resolveYears({ year, start_year, end_year, era }));
    params.set("limit", String(Math.min(limit || 10, 25)));
    const data = await api(`/api/public/find-jams?${params}`);
    if (!data.tracks?.length) return { content: [{ type: "text", text: "No jams found matching those criteria." }] };
    const results = data.tracks.map((t, i) => {
      const tagsStr = t.tags?.length ? ` | ${t.tags.join(", ")}` : "";
      return `#${i + 1} ${t.song} — ${t.date} — ${t.venue}\n` +
        `  Score: ${t.score} | ${Math.round(t.duration / 60)}m | ${t.bpm} BPM | Groove: ${t.groove}${tagsStr}\n` +
        `  ${t.link}`;
    });
    return { content: [{ type: "text", text: results.join("\n\n") }] };
  }
);

// ── Tool: Bustouts ──────────────────────────────────────────
server.tool(
  "bustouts",
  "Find songs with long gaps between performances (bustouts). Without a year, shows current bustout candidates. With a year, shows bustouts that happened that year.",
  {
    min_gap: z.number().optional().default(20).describe("Minimum show gap to qualify as a bustout (default 20)"),
    year: z.number().optional().describe("Find bustouts that occurred in this year"),
    limit: z.number().optional().default(25).describe("Number of results (default 25, max 50)"),
  },
  async ({ min_gap, year, limit }) => {
    const params = new URLSearchParams();
    params.set("minGap", String(min_gap || 20));
    if (year) params.set("year", String(year));
    params.set("limit", String(Math.min(limit || 25, 50)));
    const data = await api(`/api/public/bustouts?${params}`);
    if (!data.songs?.length) return { content: [{ type: "text", text: "No bustouts found." }] };
    const results = data.songs.map((s, i) => {
      const where = s.venue ? ` — ${s.venue}, ${s.city}${s.state ? ", " + s.state : ""}` : "";
      const label = year ? "Gap" : "Shows since last played";
      return `#${i + 1} ${s.title} — ${s.date}${where}\n  ${label}: ${s.gap}`;
    });
    const header = year ? `Bustouts in ${year} (${min_gap}+ show gap):` : `Current bustout candidates (${min_gap}+ shows):`;
    return { content: [{ type: "text", text: `${header}\n\n${results.join("\n\n")}` }] };
  }
);

// ── Tool: Shows by venue ────────────────────────────────────
server.tool(
  "shows_by_venue",
  "Find Phish shows at a specific venue, city, or state. Useful for questions like 'what shows were at MSG?' or 'when did they last play Red Rocks?'",
  {
    venue: z.string().optional().describe("Venue name (partial match, e.g. 'Madison Square', 'Red Rocks')"),
    city: z.string().optional().describe("City name (partial match)"),
    state: z.string().optional().describe("State (e.g. 'CO', 'New York')"),
    year: z.number().optional().describe("Filter to a specific year"),
    limit: z.number().optional().default(25).describe("Number of results (default 25, max 50)"),
  },
  async ({ venue, city, state, year, limit }) => {
    if (!venue && !city && !state) return { content: [{ type: "text", text: "Please provide at least a venue, city, or state." }] };
    const params = new URLSearchParams();
    if (venue) params.set("venue", venue);
    if (city) params.set("city", city);
    if (state) params.set("state", state);
    if (year) params.set("year", String(year));
    params.set("limit", String(Math.min(limit || 25, 50)));
    const data = await api(`/api/public/shows-by-venue?${params}`);
    if (!data.shows?.length) return { content: [{ type: "text", text: "No shows found at that venue." }] };
    const results = data.shows.map((s, i) => {
      const score = s.score ? ` | Score: ${s.score}` : "";
      const rating = s.pnetRating ? ` | Rating: ${s.pnetRating.toFixed(2)}` : "";
      return `${s.date} — ${s.venue}, ${s.city}${s.state ? ", " + s.state : ""}${score}${rating}\n  Tour: ${s.tour || "N/A"} | ${s.link}`;
    });
    const label = venue || city || state;
    return { content: [{ type: "text", text: `Shows at ${label} (${data.shows.length} results):\n\n${results.join("\n\n")}` }] };
  }
);

// ── Connect ─────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
