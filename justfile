set dotenv-load := true

# Deploy GeoQuest to Cloudflare Pages without requiring a global wrangler install
deploy:
    npx wrangler pages deploy public --project-name geoquest
