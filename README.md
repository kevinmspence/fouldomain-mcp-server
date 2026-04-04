# Foul Domain MCP Server

An MCP (Model Context Protocol) server that gives AI assistants access to Phish concert analytics from [Foul Domain](https://fouldomain.com). Query 36,000+ analyzed tracks, show scores, jam ratings, and more.

## Tools

| Tool | Description | Example |
|------|-------------|---------|
| `search_songs` | Find songs by name | "Search for Ghost" |
| `best_versions` | Top-rated versions of any song | "What are the best Tweezers?" |
| `get_show` | Show details with full setlist and scores | "What happened at the Phish show on 12/31/99?" |
| `top_shows` | Highest-rated shows, filterable by year or tour | "Best Phish shows from 1997" |
| `song_stats` | Detailed song stats: plays, debut, gap, audio analysis | "Tell me about Reba" |
| `find_jams` | Search jams by BPM, duration, groove, and jam chart tags | "Find long funky Phish jams" |

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

- "What's the best version of Tweezer?"
- "Find me a long, dark Phish jam with high groove"
- "What are the top 5 shows from Fall 1997?"
- "How many times has Phish played Reba?"
- "Show me the setlist from 12/31/99"
- "Find Type II jams over 20 minutes"

Every response includes links back to [fouldomain.com](https://fouldomain.com) for full audio analysis, waveforms, and playback.

## Data

Powered by audio analysis of 36,861 Phish tracks from [Phish.in](https://phish.in), scored using a blend of:

- **Phish.net community ratings** (343,000+ votes)
- **Phish.in likes**
- **Jam chart recognition**
- **Audio analysis** (energy, groove, rhythm, BPM, peak detection)

## License

MIT
