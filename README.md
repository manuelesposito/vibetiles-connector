# Vibetiles Connector

Let an AI style your website from a chat.

Your site runs [Vibetiles](https://elmastudio.de/en/vibetiles/), the design panel on the live page. This connector opens it for an AI assistant. You say "make the headings bigger and the page a little warmer", and the AI turns the same dials you would, on your real page, in a Chrome window you can watch.

**Beta.** It works, and it is still being improved.

## What the AI can do

- **Read every setting and what it means**: colours, fonts, sizes, spacing, corners, lines, pictures, effects, light and dark.
- **Change settings by name.** Each request is one step, and you can undo it in the panel.
- **Try a change without keeping it**, then keep it or go back.
- **Check that the page still reads well**: contrast of text, links and buttons, text size, line length and line spacing, with a suggested fix for each problem.
- **Look at the page**, to judge a change with its own eyes.
- **Publish, when you ask it to.** Say "publish my design": the look becomes a style on your site, and what visitors see. On a website without WordPress, Claude gets the new `vibetiles/site.js`, writes it into your site's folder and puts the site online again.

What it cannot do:

- **Publish on its own.** Until you ask, changes stay on your page. Your readers see nothing before that.
- **Change the theme's own look.** Its first change makes a copy, as the panel does.
- **Anything besides design.** It only reaches the panel's settings.

## What you need

- A site with Vibetiles, and an account that may edit the design (an administrator). Or a website without WordPress that carries [Vibetiles for HTML sites](https://github.com/manuelesposito/vibetiles-html); open it once with `?design` in the address to be its owner.
- [Node.js](https://nodejs.org) 18 or newer.
- Google Chrome.

## Set it up

Pick a post on your site; the reading check measures its article. In the lines below, replace `https://example.com/hello-world/` with that post's address.

**Claude Code**

```sh
claude mcp add vibetiles -e VIBETILES_URL=https://example.com/hello-world/ -- npx -y github:manuelesposito/vibetiles-connector
```

**Claude Desktop**: open Settings, then Developer, then Edit Config, and add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vibetiles": {
      "command": "npx",
      "args": ["-y", "github:manuelesposito/vibetiles-connector"],
      "env": { "VIBETILES_URL": "https://example.com/hello-world/" }
    }
  }
}
```

Restart Claude Desktop afterwards.

**Any other app that speaks MCP**: run `npx -y github:manuelesposito/vibetiles-connector` with `VIBETILES_URL` set.

## The first time

1. Ask the AI something about your site's design, for example: "Describe my site's design."
2. A Chrome window opens on your post. Log in to your site there, as you always do, then open the post again.
3. Ask again. From now on the login stays, in the connector's own Chrome profile (`~/.cache/vibetiles`). It is separate from your everyday Chrome.

## Try

- "Describe my site's design, then make it feel calmer."
- "Make the headings bolder and one step bigger."
- "Try a darker accent on the dark side, show me, and keep it only if the links still read well."
- "Undo that."

## Settings

| Variable | What it does |
| --- | --- |
| `VIBETILES_URL` | The post the connector opens. Required. |
| `VIBETILES_PROFILE` | Where the connector's Chrome profile lives. Default `~/.cache/vibetiles`. |
| `VIBETILES_HEADLESS` | `1` runs Chrome without a window (for tests). |

## Privacy

The connector talks only to your own site, in a Chrome window on your computer. It sends nothing anywhere else. What the AI sees is what you allow your AI app to receive: the settings, the reading check, and pictures of the page when it asks to look.

## Licence

GPL-2.0-or-later. By [Elmastudio](https://elmastudio.de/en).
