# bin

Small command-line tools used by the skills in this repo.

## devshare

Shares a local dev server with your tailnet over HTTPS, using `tailscale serve`. `charlie-pipeline`
uses it in Step 7 (share the dev server) and in *Merge* (stop the share).

```bash
devshare 3000          # prints https://<this-machine>.<tailnet>.ts.net:3000
devshare list          # what is being shared
devshare stop 3000     # stop sharing
```

Only devices signed in to your tailnet can open the link. It is not public (that would be `funnel`).

Setup (one time): Tailscale must be installed and signed in. Then link the script onto your PATH:

```bash
mkdir -p ~/.local/bin
ln -sf "$HOME/Code/Charlie_Skills/bin/devshare" ~/.local/bin/devshare
```

It uses `tailscale` from PATH, or falls back to `/Applications/Tailscale.app/Contents/MacOS/Tailscale`.
Shares stay on until you stop them, even after a restart (`--bg`).
