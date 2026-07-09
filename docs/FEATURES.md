# Pi Desktop — Features

_Website-ready feature copy. Version 0.5.0 · macOS (Apple Silicon + Intel)._

**Pi Desktop is a native macOS app for the [Pi coding agent](https://pi.dev) — a polished, multi-tab GUI that replaces the terminal. No CLI, no Node.js setup. Just open it and start.**

---

## Highlights

- **🔀 Pi Routing (Mixture of Agents).** A Pi Desktop exclusive. Create a team of models that collaborate on every prompt — they respond in parallel, synthesize a briefing, and the main model builds its answer enriched by the team's analysis. Basic and Advanced modes.
- **🏷 Tag Team (Sequential Model Relay).** A Pi Desktop exclusive. Chain models to work in sequence — the starter builds, then tags the next model to review, improve, and finalize in a fresh tab, automatically.
- **Launches into chat.** Open the app and start typing — no folder, no setup.
- **Chat or Code, your choice.** Quick conversations or full project sessions, one toggle away.
- **⚡ Turn a chat into code.** Promote any conversation into a real project session — with the whole chat carried forward as context.
- **Web search built in.** Flip it on mid-conversation; works with zero config.
- **Never overflows.** Per-session auto-compaction keeps long conversations healthy.
- **Multi-tab, fully isolated.** Each session has its own model, history, and context — like browser tabs for AI coding.

---

## Chat & Conversation

**Quick Chat mode**
Start talking the instant the app opens — no folder picker, like Claude Desktop. Pure, fast conversation with nothing to configure.

**Chat / Code toggle**
One switch decides what "New" creates: a quick **Chat**, or a folder-bound **Code** session with the agent's full toolset. Your preference is remembered.

**⚡ Convert to Code**
Started chatting and it turned into real work? Click **Convert to code**, pick a folder, and Pi Desktop archives the conversation to `docs/`, opens a full project session, and seeds it with everything you discussed so the agent keeps full context.

**Web search**
A **🔍 Web** toggle turns search on or off live, mid-conversation, with no restart. Works zero-config out of the box; add your own Exa, Perplexity, or Gemini keys in Settings for more power.

**Streaming, beautifully rendered**
Real-time responses with markdown, syntax-highlighted code, collapsible tool calls, and inline diffs for file edits. Web images collapse into a tidy chip you click to expand — no giant raw images.

**Auto-scroll that respects you**
The view follows streaming output, but the moment you scroll up to read, it stops fighting you. A "Jump to latest" button snaps you back when you're ready.

**Queue control**
Line up follow-up messages while the agent works — and remove any of them without stopping the run.

---

## Pi Routing — Mixture of Agents

**A Pi Desktop exclusive.** No other Pi client offers this.

**Team-based model routing**
Create a team of any models you have configured — Claude, GPT, GLM, Grok, MiniMax, and more. When Pi Routing is enabled, every prompt you send is fanned out to all team members in parallel. Their responses are collected, and an aggregator model synthesizes them into a briefing. The main model then builds its response with the team's analysis available as enriched context — pre-processing, not replacement.

**Basic mode**
The team responds once per prompt. The aggregator synthesizes. The main model builds. One layer — fast and cost-effective.

**Advanced mode**
The aggregator scores each team member's response on a 0–10 confidence scale. If any response falls below your threshold, the aggregator automatically re-queries that member with a refined prompt that includes feedback — up to 5 layers. You can also trigger a manual re-query, and confidence scores are visible in the chat.

**Team management**
A dedicated **Mixture of Agents** tab in Settings lets you create and edit teams, assign roles to members (architect, reviewer, implementer), pick the aggregator model, and test the team with a sample prompt before using it live.

**One-click toggle**
The Pi Routing button in the chat toolbar (next to Tools and Web) turns routing on or off instantly. If you have multiple teams, a dropdown lets you pick which one to use. Right-click the button to switch teams anytime.

**Live progress**
A subtle indicator in the chat area shows "Pi Routing: consulting 3 models…" during fan-out, so you always know the team is working.

---

## Tag Team — Sequential Model Relay

**A Pi Desktop exclusive.** The counterpart to Pi Routing: where MOA runs models in **parallel**, Tag Team runs them in **sequence**.

**How the relay works**
The starter model builds out your request, then **tags** the next model in the team. That model takes over in a brand-new tab, receives the previous model's output plus a handoff prompt, and improves the work — no clicks needed. It keeps going stage by stage until the final model, so a team like **build → review → finalize** runs end-to-end on its own.

**Context-efficient by design**
Each stage gets a fresh tab carrying only what it needs — the previous output and the handoff prompt — not the entire conversation history. Long relays stay lean.

**Custom handoff prompts**
Every stage carries an instruction for the next model: "Review the code above and fix bugs," "Optimize for performance," "Add tests." Write them once; every relay reuses them.

**Team management**
The **Tag Team** sidebar panel lets you create teams with two or more ordered stages, set each stage's model and role, reorder stages, write handoff prompts, and **Test** the full relay — previewing every stage's output — before using it live. Create as many teams as you like and cycle through them from the chat toolbar.

**At-a-glance in chat**
A toolbar button cycles through your teams and shows the active one. **TAG badges** in the tab bar mark handoff-created tabs, and a handoff indicator shows the relay passing from one model to the next.

---

## Sessions & Projects

**Multi-tab, fully standalone sessions**
Run many agent sessions at once, like browser tabs. Each is independent: its own working folder, model, thinking level, history, web-search and compaction state. Switching the model in one tab never touches another.

**Context that never overflows**
Per-session auto-compaction automatically summarizes old context before it hits the limit. A live usage meter shows where you stand, and you can compact manually anytime — button or `/compact` in the chat.

**Session history & branching**
Resume past sessions, fork from any point in the conversation, clone a branch, and navigate the full session tree. Favorites for one-click access to the folders you use most.

**GitHub integration**
Connect your account once. Create or attach repos, push and pull with visual ahead/behind status — and a badge that **glows the moment a session has unsaved or unpushed changes**, so you always know when to sync.

---

## Models & Extensions

**Bring any model**
Built-in presets for Claude, GPT/Codex, GLM, MiniMax, MiMo, and Grok, plus a simple form to add your own. Group-by-provider picker with thinking-level control (off → xhigh). Each session remembers its own model.

**Extensions, skills & packages**
Browse, install, and remove Pi packages right in the app. Skills, prompt templates, and themes load automatically. One-click "Restore to Stock" reverts everything to the built-in toolset.

**Rich extension UI**
Extensions drive real in-app UI — not just text. **Plan Mode** shows a dedicated banner and status badge; interactive prompts appear as native dialogs; and every extension gets a polished, on-brand look automatically.

---

## Design & Platform

**Made for macOS**
Native vibrancy and traffic-light layout, System / Dark / Light themes that follow your Mac, and seven accent colors. Self-contained — no Node.js, npm, or CLI required.

**Private by design**
Your API keys and GitHub token are encrypted at rest with the macOS keychain. Everything runs locally; the agent only talks to the providers you configure.

---

## Popular Add-ons

Community packages that work seamlessly inside Pi Desktop:

| Package                  | What it adds                                                                |
| ------------------------ | --------------------------------------------------------------------------- |
| `@samfp/pi-memory`       | Persistent memory — learns your corrections and preferences across sessions |
| `pi-subagents`           | Delegate work to focused child agents (reviewer, planner, worker, scout)    |
| `@narumitw/pi-plan-mode` | Codex-style Plan Mode — plan before executing                               |
| `pi-web-access`          | Web search, page fetching, PDF & video understanding                        |
| `context-mode`           | Smarter context management with semantic indexing                           |

---

_Download the latest release at [github.com/rubengarciajr/pi-desktop/releases](https://github.com/rubengarciajr/pi-desktop/releases). MIT licensed. Powered by [Pi](https://pi.dev) from earendil-works._
