# Go Order Service FE

React + Vite frontend for the Go Order Service API.

## Local Development

```bash
cp .env.example .env
npm install
npm run dev
```

For local development, keep the API base URL empty so the Vite dev proxy can forward API requests without browser CORS:

```env
VITE_API_BASE_URL=
```

Production target:

```env
VITE_API_BASE_URL=https://api.go-order-service.hieutrinh02.dev
```
