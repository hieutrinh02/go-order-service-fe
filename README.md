# Go Order Service FE

React + Vite frontend for the Go Order Service API.

## Stack

- React
- TypeScript
- Vite
- lucide-react

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

## Production Build

Vite embeds `VITE_*` variables at build time, so changing the API URL requires a rebuild.

```env
VITE_API_BASE_URL=https://api.go-order-service.hieutrinh02.dev
```

```bash
VITE_API_BASE_URL=https://api.go-order-service.hieutrinh02.dev npm run build
```

The production frontend is served from:

```text
https://go-order-service.hieutrinh02.dev
```

The production API is served from:

```text
https://api.go-order-service.hieutrinh02.dev
```

## Deployment

The GitHub Actions deploy workflow builds the app, SSHes into the EC2 host, pulls the latest frontend repo, rebuilds `dist`, and restarts the backend nginx container that serves the static files.

Required repository secrets:

```text
EC2_SSH_KEY
AWS_ROLE_TO_ASSUME
```

Required repository variables:

```text
AWS_REGION=
EC2_SECURITY_GROUP_ID=
EC2_HOST=
EC2_USER=ubuntu
FE_PROJECT_DIR=/home/ubuntu/go-order-service-fe
BACKEND_PROJECT_DIR=/home/ubuntu/go-order-service
VITE_API_BASE_URL=https://api.go-order-service.hieutrinh02.dev
```

The workflow temporarily opens SSH access for the GitHub runner IP, deploys, then revokes that ingress rule.

## Disclaimer

This code is for educational purposes only, has not been audited, and is provided without any warranties or guarantees.

## License

This project is licensed under the MIT License.
