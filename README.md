# PDF24 Toolkit

An offline PDF toolbox for **Linux** — merge, split, rotate, reorder, compress, sign, add text, convert and more, all on your own computer. **No internet connection and no cloud account needed**: every tool runs locally in the app, and your files never leave your machine.

## Download & install (Linux)

The app is distributed as a ready-to-run Linux package (`PDF24-Toolkit-linux-x64.tar.gz`). It works on **Ubuntu, Debian, Linux Mint, Fedora, Pop!_OS, Arch** and other 64-bit Linux distributions.

```bash
tar xzf PDF24-Toolkit-linux-x64.tar.gz
cd PDF24-Toolkit-linux-x64
./install.sh
```

The installer puts the app in `~/.local/share/pdf24-toolkit`, adds a **PDF24 Toolkit** entry (with its own icon) to your app menu, and a `pdf24-toolkit` command. To remove everything later, run `./uninstall.sh` from the same folder.

> The package is built for 64-bit x86 Linux (glibc). There is no Windows or macOS build.

## Tools included

- Merge and split PDFs
- Rotate, delete and reorder pages
- Compress PDFs (five levels, from lossless to maximum)
- Sign PDFs — draw your signature and place it exactly where you want it
- Add text anywhere on a page
- Convert PDF ↔ images, and PDF → Word (.doc/.docx) / ODT
- Watermarks, page numbers, metadata editing, text extraction

## Built with Lovable

This project was built with [Lovable](https://lovable.dev). Continue developing it in the [Lovable editor](https://lovable.dev/projects/be834c66-cc25-47bc-84df-c24622f1068d) — every change there is committed straight to this repository, and pushes to `main` on GitHub sync back into Lovable.

## Development

The app is a TanStack Start (React) web app packaged as an offline desktop app with Electron. You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
