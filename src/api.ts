import type {
    ApiErrorPayload,
    LoginResponse,
    Order,
    PayOrderResponse,
    Role,
    User,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

type RequestOptions = {
    method?: string;
    body?: unknown;
    token?: string | null;
    idempotencyKey?: string;
};

async function request<T>(
    path: string,
    options: RequestOptions = {},
): Promise<T> {
    const headers = new Headers();
    headers.set("Accept", "application/json");

    if (options.body !== undefined) {
        headers.set("Content-Type", "application/json");
    }

    if (options.token) {
        headers.set("Authorization", `Bearer ${options.token}`);
    }

    if (options.idempotencyKey) {
        headers.set("Idempotency-Key", options.idempotencyKey);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: "include",
    });

    if (response.status === 204) {
        return undefined as T;
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : undefined;

    if (!response.ok) {
        const errorPayload = payload as ApiErrorPayload | undefined;
        throw new ApiError(
            response.status,
            errorPayload?.error ?? `Request failed with ${response.status}`,
        );
    }

    return payload as T;
}

export const api = {
    baseUrl: API_BASE_URL,

    healthz() {
        return fetch(`${API_BASE_URL}/healthz`, { credentials: "include" });
    },

    register(email: string, password: string, role: Role) {
        return request<User>("/auth/register", {
            method: "POST",
            body: { email, password, role },
        });
    },

    async login(email: string, password: string) {
        return request<LoginResponse>("/auth/login", {
            method: "POST",
            body: { email, password },
        });
    },

    async refresh() {
        return request<LoginResponse>("/auth/refresh", {
            method: "POST",
        });
    },

    async logout() {
        return request<void>("/auth/logout", { method: "POST" });
    },

    me(token: string) {
        return request<User>("/me", { token });
    },

    listOrders(token: string) {
        return request<Order[]>("/orders", { token });
    },

    createOrder(
        token: string,
        params: { amount_cents: number; currency: string; description: string },
    ) {
        return request<Order>("/orders", {
            method: "POST",
            token,
            idempotencyKey: crypto.randomUUID(),
            body: params,
        });
    },

    payOrder(token: string, orderId: string) {
        return request<PayOrderResponse>(`/orders/${orderId}/pay`, {
            method: "POST",
            token,
            idempotencyKey: crypto.randomUUID(),
        });
    },

    cancelOrder(token: string, orderId: string) {
        return request<Order>(`/orders/${orderId}/cancel`, {
            method: "POST",
            token,
        });
    },
};
