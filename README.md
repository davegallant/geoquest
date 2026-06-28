# GeoQuest

GeoQuest is an HTML5 geography game for learning countries around the world.

## Local preview

```bash
npm install
npm run dev
```

Or without Node dependencies:

```bash
npm run preview
```

## Deploy to Cloudflare Pages

This repo is configured for Cloudflare Pages with static assets in `public/`.

### Project

The Cloudflare Pages project is `geoquest`.

```bash
npx wrangler pages project create geoquest --production-branch master
```

### Manual deploy

```bash
npm run pages:deploy
```

Production Pages URL:

```text
https://geoquest-4fi.pages.dev/
```

### Custom domain

The intended custom domain is:

```text
https://geoquest.davegallant.ca/
```

Add this DNS record in the `davegallant.ca` Cloudflare zone:

```text
Type: CNAME
Name: geoquest
Target: geoquest-4fi.pages.dev
Proxy status: Proxied
```

Then attach the custom domain to the `geoquest` Pages project if it is not already attached.

### Git-connected Pages deploy

In Cloudflare Pages, connect the Git repository and use:

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `public`

The same output directory is also recorded in `wrangler.toml`.
