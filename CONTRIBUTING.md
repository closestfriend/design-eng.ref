# Contributing

The whole list lives in [`items.csv`](items.csv). Add or fix a row there; a GitHub Action rebuilds the list in `README.md` (the part between the `LIST` markers), `llms.txt`, `items.json` and the hero image. Please do not edit those generated parts by hand (the next build overwrites them). The rest of `README.md` is hand-written, so edits there are welcome.

## Columns

| column | what to put |
|---|---|
| `title` | The name of the thing, plain text |
| `url` | The canonical link, without tracking parameters |
| `applications` | One or more jobs, separated by `; `. The **first** one is its main section. Use exactly the names below |
| `confidence` | `high` if you checked what it is, `low` if it is a guess |
| `agent_readable` | `llms.txt`, `shadcn-registry`, `llms.txt + shadcn-registry`, `github`, or `not found` |
| `top_pick` | `yes` for a start-here pick, otherwise empty |
| `paid` | `yes` if it costs money, otherwise empty |
| `note` | One short line, for top picks only |
| `curators` | Who found it first, as `Name\|https://www.are.na/user/channel`, separated by `; `. Optional |

## Jobs (the `applications` values)

Core components & primitives · Micro-interactions & transitions · Scroll & page motion · Text effects & type motion · Loaders & AI/agent status · Backgrounds, shaders & generative visuals · Theming, color & tokens · Layout & CSS technique · Agent skills & motion vocabulary · Inspiration & reference only

## Run it locally

```sh
node scripts/build.mjs
```

Needs Node 20 or newer and nothing else. The build fails on an unknown job name, which is the quickest way to catch a typo.
