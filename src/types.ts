export type Role = "customer" | "admin";

export type User = {
    id: string;
    email: string;
    role: Role;
    created_at: string;
    updated_at: string;
};

export type LoginResponse = {
    access_token: string;
    token_type: "Bearer";
    user: User;
};

export type OrderStatus = "pending_payment" | "paid" | "payment_failed" | "cancelled";

export type Order = {
    id: string;
    user_id: string;
    status: OrderStatus;
    amount_cents: number;
    currency: string;
    description?: string;
    created_at: string;
    updated_at: string;
};

export type PaymentStatus = "succeeded" | "failed";

export type Payment = {
    id: string;
    order_id: string;
    status: PaymentStatus;
    amount_cents: number;
    provider: string;
    provider_ref?: string;
    failure_reason?: string;
    created_at: string;
    updated_at: string;
};

export type PayOrderResponse = {
    order: Order;
    payment: Payment;
};

export type ApiErrorPayload = {
    error?: string;
};
