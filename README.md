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

```bash
npx wrangler pages project create geoquest --production-branch master
```

### Manual deploy

```bash
just deploy
```

