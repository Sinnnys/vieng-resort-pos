export interface Category { id: number; name: string; sortOrder: number }
export interface MenuItem { id: number; name: string; categoryId: number | null; categoryName: string | null; price: number; imageUrl: string | null; description: string | null; available: number; createdAt: string; updatedAt: string }
export interface CartItem { menuItemId: number; quantity: number; note?: string }
export interface OrderItem { id: number; orderId: number; menuItemId: number; name: string; price: number; quantity: number; note: string | null }
export interface Order { id: number; tableNumber: number; status: string; totalAmount: number; note: string | null; customerContact: string | null; createdAt: string; updatedAt: string; items: OrderItem[] }
export interface InventoryItem { id: number; name: string; quantity: number; unit: string; minStock: number; category: string | null; imageUrl: string | null; createdAt: string; updatedAt: string }
export interface Summary { todayRevenue: number; todayOrders: number; activeOrders: number; totalRevenue: number; lowStockItems: number; avgOrderValue: number }
export interface DailyStat { date: string; orders: number; revenue: number }
export interface TopItem { name: string; totalQty: number; totalRevenue: number }
export interface HourlyStat { hour: number; orders: number; revenue: number }
export interface CategorySale { category: string; totalQty: number; totalRevenue: number }
export interface TableInfo { number: number; occupied: boolean; activeAmount: number; orderCount: number }
export interface AdminUser { id: number; username: string; displayName: string; role: string; createdAt?: string }
export interface LoginResult { token: string; admin: AdminUser }

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function getToken(): string | null {
  return localStorage.getItem('pos-token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('pos-token', token);
  else localStorage.removeItem('pos-token');
}

export function getStoredAdmin(): AdminUser | null {
  const s = localStorage.getItem('pos-admin');
  return s ? JSON.parse(s) : null;
}

export function setStoredAdmin(admin: AdminUser | null) {
  if (admin) localStorage.setItem('pos-admin', JSON.stringify(admin));
  else localStorage.removeItem('pos-admin');
}

async function request<T>(url: string, opts?: RequestInit & { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token && opts?.auth !== false) headers['Authorization'] = `Bearer ${token}`;
  const mergedHeaders = { ...headers, ...(opts?.headers ? Object.fromEntries(new Headers(opts.headers as HeadersInit).entries()) : {}) };
  const { auth: _auth, headers: _h, ...restOpts } = opts || {};
  const res = await fetch(`${BASE}${url}`, { ...restOpts, headers: mergedHeaders });
  if (res.status === 204) return undefined as T;
  if (res.status === 401 && opts?.auth !== false) {
    setToken(null); setStoredAdmin(null);
    window.dispatchEvent(new Event('pos-logout'));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) => request<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }), auth: false }),
  getMe: () => request<AdminUser>('/auth/me'),

  // Admin management
  getAdmins: () => request<AdminUser[]>('/admins'),
  createAdmin: (d: { username: string; displayName: string; password: string; role: string }) => request<AdminUser>('/admins', { method: 'POST', body: JSON.stringify(d) }),
  deleteAdmin: (id: number) => request<void>(`/admins/${id}`, { method: 'DELETE' }),
  changePassword: (id: number, password: string) => request<{ ok: boolean }>(`/admins/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),

  // Upload
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const token = getToken();
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Upload failed'); }
    const data = await res.json();
    return data.url;
  },

  // Public
  getCategories: () => request<Category[]>('/categories', { auth: false }),
  getMenu: () => request<MenuItem[]>('/menu', { auth: false }),
  getTableOrders: (table: number) => request<Order[]>(`/orders/table/${table}`, { auth: false }),
  createOrder: (d: { tableNumber: number; items: CartItem[]; note?: string; customerContact?: string }) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(d), auth: false }),
  getReceipt: (id: number) => request<Order>(`/orders/${id}/receipt`, { auth: false }),

  // Protected
  createMenuItem: (d: Partial<MenuItem>) => request<MenuItem>('/menu', { method: 'POST', body: JSON.stringify(d) }),
  updateMenuItem: (id: number, d: Partial<MenuItem>) => request<MenuItem>(`/menu/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteMenuItem: (id: number) => request<void>(`/menu/${id}`, { method: 'DELETE' }),

  createCategory: (d: { name: string; sortOrder?: number }) => request<Category>('/categories', { method: 'POST', body: JSON.stringify(d) }),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' }),

  getActiveOrders: () => request<Order[]>('/orders/active'),
  getAllOrders: (params?: string) => request<Order[]>(`/orders${params ? '?' + params : ''}`),
  updateOrderStatus: (id: number, status: string) => request<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getInventory: () => request<InventoryItem[]>('/inventory'),
  createInventory: (d: Partial<InventoryItem>) => request<InventoryItem>('/inventory', { method: 'POST', body: JSON.stringify(d) }),
  updateInventory: (id: number, d: Partial<InventoryItem>) => request<InventoryItem>(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteInventory: (id: number) => request<void>(`/inventory/${id}`, { method: 'DELETE' }),

  getSummary: () => request<Summary>('/stats/summary'),
  getDaily: (days?: number) => request<DailyStat[]>(`/stats/daily?days=${days || 7}`),
  getTopItems: () => request<TopItem[]>('/stats/top-items'),
  getHourly: () => request<HourlyStat[]>('/stats/hourly'),
  getCategorySales: () => request<CategorySale[]>('/stats/category-sales'),
  getTablesOverview: () => request<TableInfo[]>('/tables/overview'),
  clearTable: (table: number) => request<{ ok: boolean }>(`/tables/${table}/orders`, { method: 'DELETE' }),
};
