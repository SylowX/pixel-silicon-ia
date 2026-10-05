# Pixel Agents — Installation Guide for Claude Code

This file tells Claude Code how to help you set up Pixel Agents on your own website.

## What this project does

Pixel Agents reads Claude Code's session files in real time and renders animated pixel art characters that mirror what your AI agents are doing — reading, editing, thinking, running commands, or spawning sub-agents.

## Requirements

- Docker and Docker Compose installed
- Claude Code installed and running on the same machine (or a server)
- A web server or VPS to host the app (optional — works locally too)

## How it works

Claude Code writes session logs to `~/.claude/projects/<project-path>/`.
This app mounts that directory read-only and tails the `.jsonl` files via a Server-Sent Events (SSE) endpoint.

The path conversion rule: `/` in directory paths becomes `-`.
- `~/` (home directory) → `-root`
- `~/myproject` → `-home-user-myproject`

## Setup steps

### 1. Find your CLAUDE_JSONL_DIR

Identify which directory you run Claude Code from, then convert the path:

```
~/            → /dot-claude/projects/-root
~/myproject   → /dot-claude/projects/-home-youruser-myproject
/Users/john/work → /dot-claude/projects/-Users-john-work
```

### 2. Configure docker-compose.yml

Edit `docker-compose.yml` and set the correct `CLAUDE_JSONL_DIR`:

```yaml
environment:
  - CLAUDE_JSONL_DIR=/dot-claude/projects/-root  # ← change this if needed
volumes:
  - ~/.claude:/dot-claude:ro
```

### 3. Build and run

```bash
docker compose up -d --build
```

The app will be available at `http://localhost:3000`.

### 4. Broadcast toggle

Visit `http://localhost:3000` while Claude Code is running. You'll see the agents animated.
Use the **Public** toggle in the top-right to control whether the visualization is publicly visible (useful if you embed it on a website).

## Embed on your website

Add an `<iframe>` to your existing website:

```html
<iframe
  src="http://your-server:3000/pixel-agents"
  width="100%"
  style="border: none; aspect-ratio: 1376/768;"
></iframe>
```

Or proxy `/pixel-agents` through your existing Nginx/Traefik setup.

## Customization

All configuration constants are documented at the top of each component:

- **Agent positions** → `src/app/pixel-agents/OfficeCanvas.tsx` (SLOTS_INIT, FLOORS_INIT)
- **Desk layout** → `src/app/pixel-agents/DeskCanvas.tsx` (SEAT_X_FRACTIONS)
- **Background image** → replace `public/pixel-agents-office-v2.webp` (keep 1376×768px)
- **Sprites** → `public/pixel-agents/char_0.png` to `char_5.png`

## Troubleshooting

**Agents not appearing / status shows "offline"**
- Check that `~/.claude` is accessible and the volume mount works: `docker compose exec pixel-agents ls /dot-claude/projects/`
- Verify CLAUDE_JSONL_DIR matches the path where your session `.jsonl` files are

**Wrong directory / no files found**
- Run `ls ~/.claude/projects/` on your host to see available project directories
- Set CLAUDE_JSONL_DIR to match the correct path pattern
