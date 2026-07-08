import {
    Activity,
    Ban,
    CheckCircle2,
    CircleDollarSign,
    Loader2,
    LogOut,
    Plus,
    RefreshCcw,
    Shield,
    ShoppingCart,
    UserRound,
    XCircle,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api";
import type { LoginResponse, Order, OrderStatus, Role, User } from "./types";

type AuthMode = "login" | "register";
type ViewMode = "customer" | "admin";
type Notice = { kind: "success" | "error"; message: string } | null;

const statusLabels: Record<OrderStatus, string> = {
    pending_payment: "Pending payment",
    paid: "Paid",
    payment_failed: "Payment failed",
    cancelled: "Cancelled",
};

const statusOrder: OrderStatus[] = ["pending_payment", "paid", "payment_failed", "cancelled"];

function formatMoney(cents: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(cents / 100);
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function readableError(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "Something went wrong";
}

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [authMode, setAuthMode] = useState<AuthMode>("login");
    const [viewMode, setViewMode] = useState<ViewMode>("customer");
    const [notice, setNotice] = useState<Notice>(null);
    const [booting, setBooting] = useState(true);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [actionOrderId, setActionOrderId] = useState<string | null>(null);
    const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");

    const applySession = useCallback((result: LoginResponse) => {
        setUser(result.user);
        setAccessToken(result.access_token);
        setViewMode(result.user.role === "admin" ? "admin" : "customer");
    }, []);

    const clearSession = useCallback(() => {
        setUser(null);
        setAccessToken(null);
        setOrders([]);
        setViewMode("customer");
    }, []);

    const loadOrders = useCallback(
        async (token: string) => {
            if (!token) {
                return;
            }

            setOrdersLoading(true);
            try {
                setOrders(await api.listOrders(token));
            } catch (error) {
                if (error instanceof ApiError && error.status === 401) {
                    clearSession();
                    setNotice({ kind: "error", message: "Session expired. Please sign in again." });
                    return;
                }

                setNotice({ kind: "error", message: readableError(error) });
            } finally {
                setOrdersLoading(false);
            }
        },
        [clearSession],
    );

    useEffect(() => {
        let mounted = true;

        async function boot() {
            try {
                const response = await api.healthz();
                if (mounted) {
                    setHealth(response.ok ? "online" : "offline");
                }
            } catch {
                if (mounted) {
                    setHealth("offline");
                }
            }

            try {
                const refreshed = await api.refresh();
                if (!mounted) {
                    return;
                }
                applySession(refreshed);
                await loadOrders(refreshed.access_token);
            } catch {
                if (mounted) {
                    clearSession();
                }
            } finally {
                if (mounted) {
                    setBooting(false);
                }
            }
        }

        void boot();

        return () => {
            mounted = false;
        };
    }, [applySession, clearSession, loadOrders]);

    const visibleOrders = useMemo(() => {
        if (!user) {
            return [];
        }

        if (viewMode === "admin" && user.role === "admin") {
            return orders;
        }

        return orders.filter((order) => order.user_id === user.id);
    }, [orders, user, viewMode]);

    const counts = useMemo(() => {
        return statusOrder.reduce(
            (acc, status) => ({
                ...acc,
                [status]: visibleOrders.filter((order) => order.status === status).length,
            }),
            {} as Record<OrderStatus, number>,
        );
    }, [visibleOrders]);

    async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const email = String(form.get("email") ?? "");
        const password = String(form.get("password") ?? "");
        const role = String(form.get("role") ?? "customer") as Role;

        setNotice(null);
        try {
            if (authMode === "register") {
                await api.register(email, password, role);
                setNotice({ kind: "success", message: "Account created. Signing you in now." });
            }

            const result = await api.login(email, password);
            applySession(result);
            await loadOrders(result.access_token);
        } catch (error) {
            setNotice({ kind: "error", message: readableError(error) });
        }
    }

    async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!accessToken) {
            return;
        }

        const form = new FormData(event.currentTarget);
        const amount = Number(form.get("amount") ?? 0);
        const currency = String(form.get("currency") ?? "USD").trim().toUpperCase();
        const description = String(form.get("description") ?? "").trim();

        setNotice(null);
        try {
            const order = await api.createOrder(accessToken, {
                amount_cents: Math.round(amount * 100),
                currency,
                description,
            });
            setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
            setNotice({ kind: "success", message: "Order created." });
            event.currentTarget.reset();
        } catch (error) {
            setNotice({ kind: "error", message: readableError(error) });
        }
    }

    async function handlePay(orderId: string) {
        if (!accessToken) {
            return;
        }

        setActionOrderId(orderId);
        setNotice(null);
        try {
            const result = await api.payOrder(accessToken, orderId);
            setOrders((current) => current.map((order) => (order.id === orderId ? result.order : order)));
            setNotice({
                kind: result.payment.status === "succeeded" ? "success" : "error",
                message:
                    result.payment.status === "succeeded"
                        ? "Payment succeeded."
                        : result.payment.failure_reason || "Payment failed.",
            });
        } catch (error) {
            setNotice({ kind: "error", message: readableError(error) });
        } finally {
            setActionOrderId(null);
        }
    }

    async function handleCancel(orderId: string) {
        if (!accessToken) {
            return;
        }

        setActionOrderId(orderId);
        setNotice(null);
        try {
            const order = await api.cancelOrder(accessToken, orderId);
            setOrders((current) => current.map((item) => (item.id === orderId ? order : item)));
            setNotice({ kind: "success", message: "Order cancelled." });
        } catch (error) {
            setNotice({ kind: "error", message: readableError(error) });
        } finally {
            setActionOrderId(null);
        }
    }

    async function handleLogout() {
        await api.logout();
        clearSession();
    }

    if (booting) {
        return (
            <main className="boot-screen">
                <Loader2 className="spin" size={28} />
            </main>
        );
    }

    return (
        <main className="app-shell">
            <TopBar user={user} health={health} onLogout={handleLogout} />

            {notice && (
                <div className={`notice ${notice.kind}`} role="status">
                    {notice.kind === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    <span>{notice.message}</span>
                </div>
            )}

            {!user ? (
                <AuthPanel mode={authMode} onModeChange={setAuthMode} onSubmit={handleAuthSubmit} />
            ) : (
                <section className="workspace">
                    <aside className="sidebar">
                        <UserPanel user={user} viewMode={viewMode} onViewModeChange={setViewMode} />
                        <CreateOrderForm onSubmit={handleCreateOrder} />
                    </aside>

                    <section className="content">
                        <StatusSummary counts={counts} total={visibleOrders.length} />
                        <OrderTable
                            currentUser={user}
                            orders={visibleOrders}
                            loading={ordersLoading}
                            actionOrderId={actionOrderId}
                            onRefresh={() => {
                                if (accessToken) {
                                    void loadOrders(accessToken);
                                }
                            }}
                            onPay={handlePay}
                            onCancel={handleCancel}
                        />
                    </section>
                </section>
            )}
        </main>
    );
}

function TopBar({
    user,
    health,
    onLogout,
}: {
    user: User | null;
    health: "checking" | "online" | "offline";
    onLogout: () => void;
}) {
    return (
        <header className="topbar">
            <div className="brand">
                <div className="brand-mark">
                    <ShoppingCart size={20} />
                </div>
                <div>
                    <strong>Go Order Service</strong>
                    <span>Orders, payments, and event flow</span>
                </div>
            </div>

            <div className="topbar-actions">
                <span className={`health-dot ${health}`}>
                    <Activity size={15} />
                    {health}
                </span>
                {user && (
                    <button className="icon-button" type="button" onClick={onLogout} aria-label="Sign out" title="Sign out">
                        <LogOut size={18} />
                    </button>
                )}
            </div>
        </header>
    );
}

function AuthPanel({
    mode,
    onModeChange,
    onSubmit,
}: {
    mode: AuthMode;
    onModeChange: (mode: AuthMode) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
    return (
        <section className="auth-layout">
            <div className="auth-copy">
                <h1>Operate the order lifecycle from the browser.</h1>
                <p>
                    Sign in, create orders, simulate payments, cancel pending work, and switch into admin mode when your account
                    has the role.
                </p>
            </div>

            <form className="auth-form" onSubmit={onSubmit}>
                <div className="segmented">
                    <button className={mode === "login" ? "active" : ""} type="button" onClick={() => onModeChange("login")}>
                        Login
                    </button>
                    <button
                        className={mode === "register" ? "active" : ""}
                        type="button"
                        onClick={() => onModeChange("register")}
                    >
                        Register
                    </button>
                </div>

                <label>
                    Email
                    <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
                </label>

                <label>
                    Password
                    <input name="password" type="password" autoComplete="current-password" required minLength={6} />
                </label>

                {mode === "register" && (
                    <label>
                        Role
                        <select name="role" defaultValue="customer">
                            <option value="customer">Customer</option>
                            <option value="admin">Admin</option>
                        </select>
                    </label>
                )}

                <button className="primary-button" type="submit">
                    <Shield size={18} />
                    {mode === "login" ? "Sign in" : "Create account"}
                </button>
            </form>
        </section>
    );
}

function UserPanel({
    user,
    viewMode,
    onViewModeChange,
}: {
    user: User;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
}) {
    return (
        <section className="panel compact-panel">
            <div className="panel-title">
                <UserRound size={18} />
                Session
            </div>
            <strong className="user-email">{user.email}</strong>
            <span className="role-pill">{user.role}</span>

            {user.role === "admin" && (
                <div className="segmented slim">
                    <button
                        className={viewMode === "customer" ? "active" : ""}
                        type="button"
                        onClick={() => onViewModeChange("customer")}
                    >
                        Mine
                    </button>
                    <button
                        className={viewMode === "admin" ? "active" : ""}
                        type="button"
                        onClick={() => onViewModeChange("admin")}
                    >
                        Admin
                    </button>
                </div>
            )}
        </section>
    );
}

function CreateOrderForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
    return (
        <form className="panel create-form" onSubmit={onSubmit}>
            <div className="panel-title">
                <Plus size={18} />
                New order
            </div>

            <label>
                Amount
                <input name="amount" type="number" min="1" step="0.01" required placeholder="49.99" />
            </label>

            <label>
                Currency
                <input name="currency" defaultValue="USD" maxLength={3} required />
            </label>

            <label>
                Description
                <textarea name="description" rows={3} placeholder="Short note for the order" />
            </label>

            <button className="primary-button" type="submit">
                <Plus size={18} />
                Create order
            </button>
        </form>
    );
}

function StatusSummary({ counts, total }: { counts: Record<OrderStatus, number>; total: number }) {
    return (
        <section className="summary-grid">
            <div className="metric total">
                <span>Total orders</span>
                <strong>{total}</strong>
            </div>
            {statusOrder.map((status) => (
                <div className="metric" key={status}>
                    <span>{statusLabels[status]}</span>
                    <strong>{counts[status]}</strong>
                </div>
            ))}
        </section>
    );
}

function OrderTable({
    currentUser,
    orders,
    loading,
    actionOrderId,
    onRefresh,
    onPay,
    onCancel,
}: {
    currentUser: User;
    orders: Order[];
    loading: boolean;
    actionOrderId: string | null;
    onRefresh: () => void;
    onPay: (orderId: string) => void;
    onCancel: (orderId: string) => void;
}) {
    return (
        <section className="orders-panel">
            <div className="orders-header">
                <div>
                    <h2>Orders</h2>
                    <span>{orders.length} visible</span>
                </div>
                <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh">
                    {loading ? <Loader2 className="spin" size={18} /> : <RefreshCcw size={18} />}
                </button>
            </div>

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Amount</th>
                            <th>Description</th>
                            <th>Owner</th>
                            <th>Updated</th>
                            <th className="actions-col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr>
                                <td className="empty-cell" colSpan={6}>
                                    No orders yet.
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => {
                                const canOperate =
                                    order.status === "pending_payment" || order.status === "payment_failed";
                                const busy = actionOrderId === order.id;

                                return (
                                    <tr key={order.id}>
                                        <td>
                                            <span className={`status status-${order.status}`}>{statusLabels[order.status]}</span>
                                        </td>
                                        <td>{formatMoney(order.amount_cents, order.currency)}</td>
                                        <td>
                                            <div className="description-cell">
                                                <strong>{order.description || "Order"}</strong>
                                                <span>{order.id.slice(0, 8)}</span>
                                            </div>
                                        </td>
                                        <td>{order.user_id === currentUser.id ? "You" : order.user_id.slice(0, 8)}</td>
                                        <td>{formatDate(order.updated_at)}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    className="icon-button"
                                                    type="button"
                                                    onClick={() => onPay(order.id)}
                                                    disabled={!canOperate || busy}
                                                    aria-label="Pay order"
                                                    title="Pay order"
                                                >
                                                    {busy ? <Loader2 className="spin" size={17} /> : <CircleDollarSign size={17} />}
                                                </button>
                                                <button
                                                    className="icon-button danger"
                                                    type="button"
                                                    onClick={() => onCancel(order.id)}
                                                    disabled={!canOperate || busy}
                                                    aria-label="Cancel order"
                                                    title="Cancel order"
                                                >
                                                    <Ban size={17} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default App;
