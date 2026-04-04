# Foul Domain MCP Server

An MCP (Model Context Protocol) server that gives AI assistants access to Phish concert analytics from [Foul Domain](https://fouldomain.com). Query 36,000+ analyzed tracks, show scores, jam ratings, and more.

## Tools

| Tool | Description |
|------|-------------|
| `search_songs` | Find songs by name |
| `best_versions` | Top-rated versions of any song, filterable by year/era, venue, state |
| `get_show` | Show details with full setlist and scores |
| `top_shows` | Highest-rated shows, filterable by year/era, tour, venue, state |
| `song_stats` | Detailed song stats: plays, debut, gap, audio analysis |
| `find_jams` | Search jams by song, tags, year/era, venue, state, BPM, duration, groove, with sort options |
| `bustouts` | Find songs with long gaps between performances |
| `shows_by_venue` | Find shows at a specific venue, city, or state |

## Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fouldomain": {
      "command": "npx",
      "args": ["-y", "@fouldomain/mcp-server"]
    }
  }
}
```

### Claude Code

Add to your `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "fouldomain": {
      "command": "npx",
      "args": ["-y", "@fouldomain/mcp-server"]
    }
  }
}
```

### Manual

```bash
npx @fouldomain/mcp-server
```

## Example Queries

Once connected, you can ask your AI assistant things like:

### By song
- "What's the best version of Tweezer?"
- "Best Reba from 1997"
- "Top Ghost versions at MSG"
- "Best 3.0 Tweezers"

### By style
- "Find me a long, dark Phish jam"
- "Dark funky jams from 1997-1999"
- "Best Type II jams over 20 minutes"
- "Grooviest jams from Fall 1997"
- "Longest jams in 2.0"

### By year and era
- "Best Phish shows from 1997"
- "Top shows in 3.0"
- "Best jams from 2003-2004"

### By venue and location
- "Best shows at MSG"
- "When did they last play Red Rocks?"
- "Top shows in Colorado"
- "What shows were at the Gorge in 2023?"
- "Best jams at Hampton Coliseum"

### Bustouts and gaps
- "What songs haven't they played in 50+ shows?"
- "What bustouts happened in 2024?"
- "Songs they haven't played since 1.0"

### Show details
- "What happened at the Phish show on 12/31/99?"
- "Show me the setlist from Baker's Dozen night 1"
- "How many times has Phish played Reba?"

Every response includes links back to [fouldomain.com](https://fouldomain.com) for full audio analysis, waveforms, and playback.

## Data

Powered by audio analysis of 36,861 Phish tracks from [Phish.in](https://phish.in), scored using a blend of:

- **Phish.net community ratings** (343,000+ votes)
- **Phish.in likes**
- **Jam chart recognition**
- **Audio analysis** (energy, groove, rhythm, BPM, peak detection)

## License

MIT
