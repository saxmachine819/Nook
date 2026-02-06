# Batch QR PDF Export (Internal Ops)

## What this adds

- **Admin-only** PDF export endpoint:
  - `GET /api/admin/qr-assets/batch/[batchId]/print.pdf?limit=24`
- **Minimal admin page** to download/open the PDF:
  - `GET /admin/qr-assets/batch/[batchId]?limit=24`

## Setup / DB

1. Schema change: `QRAsset.batchId` was added to Prisma (`prisma/schema.prisma`).
2. Apply it to your database:

```bash
npx prisma db push
```

## How to generate a batch and download the PDF

1. **Create a batch** (admin-only):

```bash
curl -X POST http://localhost:3000/api/admin/qr-assets/batch-create \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{"count": 100}'
```

Response includes:
- `batchId`
- `sampleTokens`

2. **Download/preview the PDF**:

- Open the admin helper page:
  - `http://localhost:3000/admin/qr-assets/batch/<batchId>?limit=24`

Or hit the endpoint directly:
- `http://localhost:3000/api/admin/qr-assets/batch/<batchId>/print.pdf?limit=24`

## Limits

- `limit` defaults to **24**
- max `limit` is **120**

## Scan reliability

- The PDF embeds the **same sticker SVG layout** used by `/api/qr-assets/[token]/sticker.svg`.
- We render those SVGs into a conservative **A4 grid** with margins/gaps to avoid cutoffs.

Recommended verification:
- Open the generated PDF at 100% zoom and scan several codes from screen
- Print one page and scan a few stickers (different phones if possible)

