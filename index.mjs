#!/usr/bin/env node
/*
 * VIBETILES CONNECTOR: a small MCP server over window.Vibetiles.
 *
 * An AI styles a website from a chat through the same door the owner's design panel uses: it reads what every
 * setting means, changes settings by name as one step the owner can undo, gets a reading check back in numbers
 * (contrast, text size, line length), and can look at the page. It works in a Chrome window you can watch.
 *
 * VIBETILES_URL         the page to style: a post on a site with Vibetiles, where the OWNER logs in once in
 *                       the window this opens (the door is only on the owner's page). Required.
 * VIBETILES_HEADLESS    1 = no window (for tests)
 * VIBETILES_PROFILE     the Chrome profile it keeps (default ~/.cache/vibetiles); the login stays there.
 * (The names from before 0.3.0, LIVE_DESIGN_URL and so on, still work.)
 *
 * Needs Node 18 or newer and Google Chrome. MCP over stdio is one JSON message per line.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
let chromium;
try { ({ chromium } = await import('playwright-core')); }
catch (e) { if (!process.env.PLAYWRIGHT_CORE) { process.stderr.write('vibetiles: needs playwright-core (npm i playwright-core, or set PLAYWRIGHT_CORE)\n'); process.exit(1); } ({ chromium } = await import(process.env.PLAYWRIGHT_CORE)); }

const env = (k) => process.env['VIBETILES_' + k] || process.env['LIVE_DESIGN_' + k];
const URL_ = env('URL');
if (!URL_) { process.stderr.write('vibetiles: set VIBETILES_URL to a post on your site, e.g. https://example.com/hello-world/\n'); process.exit(1); }
const HEADLESS = env('HEADLESS') === '1';
const PROFILE = env('PROFILE') || path.join(os.homedir(), '.cache', 'vibetiles'); /* the page keeps its styles between chats */
/* the profile's old names (0.1.x, 0.2.x): move it once, so the login stays */
if (!env('PROFILE')) for (const n of ['live-design-panel', 'live-design-connector']) { const OLD = path.join(os.homedir(), '.cache', n); try { if (fs.existsSync(OLD) && !fs.existsSync(PROFILE)) fs.renameSync(OLD, PROFILE); } catch (e) { /* keep going with a fresh profile */ } }

let ctx = null, page = null, opening = null;
/* ONE browser for all calls: an AI sends several at once, and a second launch on the same profile fails */
function thePage() {
  if (page && !page.isClosed()) return Promise.resolve(page);
  opening = opening || (async () => {
    ctx = ctx || await chromium.launchPersistentContext(PROFILE, { channel:'chrome', headless:HEADLESS, chromiumSandbox:true, viewport:{ width:1440, height:900 } } /* sandbox on: no warning bar, and Chrome as safe as usual */);
    page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(URL_);
    await page.evaluate(() => { try { localStorage.setItem('ldp-proto-welcomed', '1'); } catch (e) {} });
    return page;
  })().finally(() => { opening = null; });
  return opening;
}
/* The door is on the page only for the owner: on a site, the first call may meet a page with no one logged in. */
async function door() {
  const p = await thePage();
  const ok = await p.waitForFunction(() => window.Vibetiles || window.LiveDesign, null, { timeout:15000 }).then(() => true, () => false);
  if (!ok) throw new Error('No Vibetiles on ' + p.url() + '. On a WordPress site: log in as the owner in the Chrome window that opened, go back to a post, then try again. The site needs Vibetiles.');
  return p;
}
const call = async (fn, ...args) => (await door()).evaluate(({ fn, args }) => (window.Vibetiles || window.LiveDesign)[fn](...args), { fn, args });

const changes = { type:'object', description:'Settings by name, e.g. { "corners": "large", "space": "+1", "roles.read.size": 20, "bstyle": "tinted" }. A choice by value or label; a number goes to the nearest step; "+1"/"-1" moves one step. Names and meanings come from describe.', additionalProperties:true };
const why = { type:'string', description:'Why, in a few words. The owner sees it in Versions.' };
const TOOLS = [
  { name:'describe', description:'Start here. Everything in one answer: every setting with what it MEANS, its values and its current value; the eight kinds of text and their dials; fonts; colour presets; the styles; the reading check.', inputSchema:{ type:'object', properties:{} }, run:() => call('describe') },
  { name:'set_settings', description:'Change settings by name, as ONE step the owner can undo. Returns what changed, anything refused (with "did you mean"), and the reading check after the change.', inputSchema:{ type:'object', properties:{ changes, why }, required:['changes'] }, run:(a) => call('set', a.changes, a.why || '') },
  { name:'preview', description:'Show a change on the page without keeping it. Keep it with set_settings, or go back with end_preview.', inputSchema:{ type:'object', properties:{ changes }, required:['changes'] }, run:(a) => call('preview', a.changes) },
  { name:'end_preview', description:'Leave a preview; the page shows the kept style again.', inputSchema:{ type:'object', properties:{} }, run:() => call('endPreview') },
  { name:'check', description:'The reading check in numbers: text, link and button contrast, letters per line, reading size, line spacing; warnings with a suggested fix.', inputSchema:{ type:'object', properties:{} }, run:() => call('check') },
  { name:'explain', description:'The current style in one plain paragraph, to tell the person what you see.', inputSchema:{ type:'object', properties:{} }, run:() => call('explain') },
  { name:'undo', description:'Take back the last change (yours or the owner\'s).', inputSchema:{ type:'object', properties:{} }, run:() => call('undo') },
  { name:'redo', description:'Put back what undo took.', inputSchema:{ type:'object', properties:{} }, run:() => call('redo') },
  { name:'get_style', description:'The whole style as a record, with a link that carries it. Keep it, or load it on another site with Vibetiles.', inputSchema:{ type:'object', properties:{} }, run:() => call('style') },
  { name:'load_style', description:'Load a whole style (what get_style returns), as one undoable step.', inputSchema:{ type:'object', properties:{ style:{ type:'object' }, why }, required:['style'] }, run:(a) => call('load', a.style, a.why || '') },
  { name:'choose_style', description:'Switch to another style by id (ids come from describe).', inputSchema:{ type:'object', properties:{ id:{ type:'string' } }, required:['id'] }, run:(a) => call('choose', a.id) },
  { name:'open_panel', description:'Open the owner\'s design panel on the page, so the person watching sees it.', inputSchema:{ type:'object', properties:{} }, run:(a) => call('open', a.section) },
  { name:'publish', description:'ONLY WHEN THE OWNER ASKS TO PUBLISH. The look on the page becomes a style on the site and, unless default is false, what every visitor opens in. On WordPress it is live at once. On a site that is only files (no WordPress) the answer carries the new site.js and its path (vibetiles/site.js): write it into the site\'s folder, replacing the whole file, and put the site online again.', inputSchema:{ type:'object', properties:{ name:{ type:'string', description:'the style\'s name on the site (default: its current name)' }, default:{ type:'boolean', description:'make it what visitors open in (default true)' } } },
    run:(a) => call('publish', { name:a.name, default:a.default }) },
  { name:'look', description:'See the page: a picture of the window, or of one part (a CSS selector such as "h1", "main", "article"). Use it to judge a change with your own eyes.', inputSchema:{ type:'object', properties:{ part:{ type:'string' }, whole:{ type:'boolean', description:'the whole page, not only the window' } } },
    run:async (a) => { const p = await door(); const el = a.part ? await p.$(a.part) : null;
      const png = el ? await el.screenshot() : await p.screenshot({ fullPage:!!a.whole });
      return { image:png.toString('base64') }; } }
];

function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
async function handle(m) {
  if (m.method === 'initialize') return send({ jsonrpc:'2.0', id:m.id, result:{ protocolVersion:(m.params && m.params.protocolVersion) || '2025-06-18', capabilities:{ tools:{} }, serverInfo:{ name:'vibetiles', version:'0.3.0' },
    instructions:'Vibetiles styles a website. Call describe first; every setting says what it means. Change with set_settings (one undo step, give a why), check the reading check it returns, and use look to see the result.' } });
  if (m.method === 'ping') return send({ jsonrpc:'2.0', id:m.id, result:{} });
  if (m.method === 'tools/list') return send({ jsonrpc:'2.0', id:m.id, result:{ tools:TOOLS.map(({ run, ...t }) => t) } });
  if (m.method === 'tools/call') { queue = queue.then(() => callTool(m)); return queue; }
  if (m.id !== undefined) send({ jsonrpc:'2.0', id:m.id, error:{ code:-32601, message:'Unknown method ' + m.method } });
}
/* ONE CALL AT A TIME, in the order they came: a choose and a set sent together must not cross on the page */
let queue = Promise.resolve();
async function callTool(m) {
  {
    const t = TOOLS.find((x) => x.name === m.params.name);
    if (!t) return send({ jsonrpc:'2.0', id:m.id, error:{ code:-32602, message:'No tool ' + m.params.name } });
    try { const r = await t.run(m.params.arguments || {});
      const content = r && r.image ? [{ type:'image', data:r.image, mimeType:'image/png' }] : [{ type:'text', text:typeof r === 'string' ? r : JSON.stringify(r) }];
      return send({ jsonrpc:'2.0', id:m.id, result:{ content } });
    } catch (e) { return send({ jsonrpc:'2.0', id:m.id, result:{ content:[{ type:'text', text:'Failed: ' + e.message }], isError:true } }); }
  }
}
let buf = '';
process.stdin.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) > -1) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) { let m; try { m = JSON.parse(line); } catch (e) { continue; } handle(m); } } });
process.stdin.on('end', async () => { if (ctx) await ctx.close(); process.exit(0); });
