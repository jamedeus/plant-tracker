## Cloudfront

Cloudfront is used for 2 things:
- Serving static JS/CSS bundles faster
- Serving photos from S3 with signed cookies for access control

Since signed cookies are used a custom domain for cloudfront is required (can't issue cookies unless the server domain is same as cloudfront).

Create these DNS records:
- Server domain: `plants.joshmedeiros.dev` (A record pointing at VPS IP)
- CDN alt domain: `static.plants.joshmedeiros.dev` (CNAME record pointing at cloudfront distribution)
- CDN alt domain: `media.plants.joshmedeiros.dev` (CNAME record pointing at cloudfront distribution)

Go to AWS -> AWS Certificate Manager -> Certificates -> Request
- Request a public certificate
- Enter both `static.plants.joshmedeiros.dev` and `media.plants.joshmedeiros.dev` as fully-qualified domain names
- Leave everything else default (DNS validation etc)
- Click request
- Once the cert is issued you'll see a Domains section with both listed
    - Go to DNS registrar and create 2 CNAMES with the CNAME name and CNAME value from this screen
    - Wait a few minutes and validation status will change to success

Once the certificate is ready go to Cloudfront, select distribution, and click Edit in the settings section:
- Alternate domain name (CNAME): Add both `static.plants.joshmedeiros.dev` and `media.plants.joshmedeiros.dev`
- Custom SSL certificate: Select the certificate created above
- Save changes

### Origins

Create custom origin for static files (served from django with whitenoise, cached by cloudfront and served to user).
- Origin domain: `plants.joshmedeiros.dev`
- Protocol: HTTPS only

# TODO update this next time
Create S3 origin for photos
- Origin: Photos bucket
- Origin access: OAC
- Create OAC, copy JSON to S3 bucket policy

### Key Group (signed cookies)

Generate keypair:
```
openssl genrsa -out private_key.pem 2048
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

Note: You'll need to upload `private_key.pem` to the docker host and mount it as a volume in docker compose.

Go to Cloudfront -> Key management -> Public keys - Create Public key
- Name: Plant-tracker-beta-photos
- Description: Used for cookie access control
- Key: contents of `public_key.pem`

Copy the ID cloudfront creates for the key (something like K86ALCJM6RYZT), you'll need it for the `CLOUDFRONT_KEY_ID` env var in docker compose.

Go to Cloudfront -> Key management -> Key groups - Create key group
- Name: Plant-tracker-beta-photos
- Description: Used for cookie access control
- Public keys: select key created above

### Behaviors

Default behavior: deny access
- Restrict viewer access: Yes
    - Trusted authorization type: Trusted signer
        - Trusted signers: self (just never sign anything)
- Cache policy: caching disabled

Static file behavior (public):
- Path pattern: `/static/*`
- Compress objects automatically: `Yes`
- Viewer protocol policy: `Redirect HTTP to HTTPS`
- Allowed HTTP methods: `GET, HEAD`
- Restrict viewer access: `No`
- Cache policy: `CachingOptimized`

Thumbnails behavior (signed cookies, long cache):
- Path pattern: `user_*/thumbnails/*`
- Origin: S3 bucket
- Compress objects automatically: `Yes`
- Viewer protocol policy: `Redirect HTTP to HTTPS`
- Allowed HTTP methods: `GET, HEAD`
- Restrict viewer access: `Yes`
    - Trusted authorization type: `Trusted key groups (recommended)`
        - Key group: Select key group created above
- Cache policy: `CachingOptimized`

Previews behavior (signed cookies, no cache):
- Path pattern: `user_*/previews/*`
- Origin: S3 bucket
- Compress objects automatically: `Yes`
- Viewer protocol policy: `Redirect HTTP to HTTPS`
- Allowed HTTP methods: `GET, HEAD`
- Restrict viewer access: `Yes`
    - Trusted authorization type: `Trusted key groups (recommended)`
        - Key group: Select key group created above
- Cache policy: `CachingDisabled`

# TODO custom policy with shorter TTL? These are large and infrequently accessed,
# don't want user device to push frequently-accessed thumbnails out of cache
Original resolution behavior (signed cookies, long cache):
- Path pattern: `user_*/images/*`
- Origin: S3 bucket
- Compress objects automatically: `Yes`
- Viewer protocol policy: `Redirect HTTP to HTTPS`
- Allowed HTTP methods: `GET, HEAD`
- Restrict viewer access: `Yes`
    - Trusted authorization type: `Trusted key groups (recommended)`
        - Key group: Select key group created above
- Cache policy: `CachingOptimized`

### Docker compose config

The following env vars are related to cloudfront:
- `BASE_URL` - The domain where the app is accessed (will also be used to issue cloudfront cookies)
    - Example value: `plants.joshmedeiros.dev`
- `IMAGE_URL` - The full cloudfront distribution alternate domain name with NO PROTOCOL (ie no https)
    - Example value: `media.plants.joshmedeiros.dev`
- `STATIC_URL` - The full cloudfront distribution alternate domain name WITH protocol
    - Example value: `https://static.plants.joshmedeiros.dev`
- `CLOUDFRONT_KEY_ID` - The public key ID generated by cloudfront (Cloudfront -> Key management -> Public keys)
    - Example value: `K86ALCJM6RYZT`

You'll also need to copy the `private_key.pem` used to sign the cookies to your docker host (same directory as docker-compose.yaml) and mount it as a volume:
```
    volumes:
      # Cloudfront private key for signed URLs (if using AWS S3)
      - ./private_key.pem:/mnt/backend/private_key.pem
```

If for some reason you want to mount this to a different location than `/mnt/backend/private_key.pem` set the `CLOUDFRONT_PRIVKEY_PATH` env var.
