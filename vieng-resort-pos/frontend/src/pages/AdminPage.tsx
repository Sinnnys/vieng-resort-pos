import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api';
import type { Order, MenuItem, Category, InventoryItem, Summary, DailyStat, TopItem, HourlyStat, CategorySale, TableInfo, AdminUser } from '../api';
import { t, getLang, setLang, LANG_LABELS } from '../i18n';
import type { Lang } from '../i18n';

const fmt = (n: number) => n.toLocaleString() + ' ₭';

type Tab = 'orders' | 'tables' | 'menu' | 'inventory' | 'charts' | 'history' | 'accounts';

export default function AdminPage({ admin, onLogout }: { admin: AdminUser; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('orders');
  const [lang, setLangState] = useState<Lang>(getLang);
  const changeLang = (l: Lang) => { setLangState(l); setLang(l); };
  const T = (k: string) => t(lang, k);

  const tabs: { id: Tab; icon: string; label: string; ownerOnly?: boolean }[] = [
    { id: 'orders', icon: '📋', label: T('activeOrders') },
    { id: 'tables', icon: '🪑', label: T('tables') },
    { id: 'history', icon: '📜', label: T('orderHistory') },
    { id: 'menu', icon: '🍽️', label: T('menuMgmt') },
    { id: 'inventory', icon: '📦', label: T('inventory') },
    { id: 'charts', icon: '📊', label: T('analytics') },
    { id: 'accounts', icon: '👥', label: 'Accounts', ownerOnly: true },
  ];

  const visibleTabs = tabs.filter(tb => !tb.ownerOnly || admin.role === 'owner');

  return (
    <div className="admin-page">
      <aside className="a-sidebar">
        <div className="a-brand">
          <img src="/media/logo.png" alt="Logo" className="a-logo" />
          <span>Vieng POS</span>
        </div>
        <nav className="a-nav">
          {visibleTabs.map((tb) => (
            <button key={tb.id} className={tab === tb.id ? 'a-nav-btn active' : 'a-nav-btn'} onClick={() => setTab(tb.id)}>
              {tb.icon}<span>{tb.label}</span>
            </button>
          ))}
        </nav>
        <div className="a-sidebar-footer">
          <div className="a-user-info">
            <span className="a-user-name">{admin.displayName}</span>
            <span className="a-user-role">{admin.role}</span>
          </div>
          <select className="a-lang-select" value={lang} onChange={(e) => changeLang(e.target.value as Lang)}>
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
          <button className="a-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </aside>
      <main className="a-main">
        {tab === 'orders' && <OrdersTab T={T} />}
        {tab === 'tables' && <TablesTab T={T} />}
        {tab === 'history' && <HistoryTab T={T} />}
        {tab === 'menu' && <MenuTab T={T} />}
        {tab === 'inventory' && <InventoryTab T={T} />}
        {tab === 'charts' && <ChartsTab T={T} />}
        {tab === 'accounts' && <AccountsTab T={T} currentAdmin={admin} />}
      </main>
    </div>
  );
}

// ── Orders ──────────────────────────────────────────────
function OrdersTab({ T }: { T: (k: string) => string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);

  const load = useCallback(() => {
    api.getActiveOrders().then(setOrders).catch(() => {});
    api.getSummary().then(setSummary).catch(() => {});
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 4000); return () => clearInterval(i); }, [load]);

  async function updateStatus(id: number, status: string) {
    await api.updateOrderStatus(id, status);
    load();
  }

  const pending = orders.filter(o => o.status === 'pending');
  const preparing = orders.filter(o => o.status === 'preparing');
  const served = orders.filter(o => o.status === 'served');

  return (
    <div>
      <div className="a-topbar"><h2>{T('activeOrders')}</h2></div>
      {summary && (
        <div className="a-stats-row">
          <div className="a-stat a-stat-pulse"><span className="a-stat-value">{summary.activeOrders}</span><span className="a-stat-label">{T('activeOrders')}</span></div>
          <div className="a-stat"><span className="a-stat-value">{summary.todayOrders}</span><span className="a-stat-label">{T('todayOrders')}</span></div>
          <div className="a-stat"><span className="a-stat-value">{fmt(summary.todayRevenue)}</span><span className="a-stat-label">{T('todayRevenue')}</span></div>
          <div className="a-stat"><span className="a-stat-value">{fmt(summary.avgOrderValue)}</span><span className="a-stat-label">{T('avgOrderValue')}</span></div>
          {summary.lowStockItems > 0 && <div className="a-stat a-stat-warn"><span className="a-stat-value">{summary.lowStockItems}</span><span className="a-stat-label">{T('lowStock')}</span></div>}
        </div>
      )}
      <div className="a-kanban">
        <div className="a-kanban-col">
          <div className="a-kanban-header a-kh-orange">🔔 {T('pending')} ({pending.length})</div>
          {pending.map((o) => <OrderCard key={o.id} o={o} T={T} onStatus={updateStatus} onReceipt={setReceipt} />)}
        </div>
        <div className="a-kanban-col">
          <div className="a-kanban-header a-kh-blue">👨‍🍳 {T('preparing')} ({preparing.length})</div>
          {preparing.map((o) => <OrderCard key={o.id} o={o} T={T} onStatus={updateStatus} onReceipt={setReceipt} />)}
        </div>
        <div className="a-kanban-col">
          <div className="a-kanban-header a-kh-green">✅ {T('served')} ({served.length})</div>
          {served.map((o) => <OrderCard key={o.id} o={o} T={T} onStatus={updateStatus} onReceipt={setReceipt} />)}
        </div>
      </div>
      {receipt && <ReceiptModal order={receipt} T={T} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function OrderCard({ o, T, onStatus, onReceipt }: { o: Order; T: (k: string) => string; onStatus: (id: number, s: string) => void; onReceipt: (o: Order) => void }) {
  return (
    <div className={`a-order-card a-order-${o.status}`}>
      <div className="a-order-header">
        <span className="a-order-table">{T('table')} {o.tableNumber}</span>
        <span className="a-order-time">{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="a-order-id">#{o.id}</div>
      <div className="a-order-items">
        {o.items.map((it) => (
          <div key={it.id} className="a-order-line">
            <span><strong>{it.quantity}x</strong> {it.name}</span>
            <span>{fmt(it.price * it.quantity)}</span>
          </div>
        ))}
      </div>
      {o.note && <div className="a-order-note">📝 {o.note}</div>}
      <div className="a-order-footer">
        <span className="a-order-total">{fmt(o.totalAmount)}</span>
        <div className="a-order-actions">
          {o.status === 'pending' && <button className="a-btn a-btn-orange" onClick={() => onStatus(o.id, 'preparing')}>{T('prepare')}</button>}
          {o.status === 'preparing' && <button className="a-btn a-btn-blue" onClick={() => onStatus(o.id, 'served')}>{T('markServed')}</button>}
          {o.status === 'served' && <button className="a-btn a-btn-green" onClick={() => onStatus(o.id, 'paid')}>{T('markPaid')}</button>}
          <button className="a-btn a-btn-ghost" onClick={() => onReceipt(o)}>🧾</button>
          {o.status !== 'paid' && <button className="a-btn a-btn-ghost a-btn-danger-text" onClick={() => onStatus(o.id, 'cancelled')}>✕</button>}
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({ order, T, onClose }: { order: Order; T: (k: string) => string; onClose: () => void }) {
  return (
    <div className="a-overlay" onClick={onClose}>
      <div className="a-receipt" onClick={(e) => e.stopPropagation()}>
        <div className="a-receipt-header">
          <img src="/media/logo.png" alt="Logo" className="a-receipt-logo" />
          <h3>{T('viengCafe')}</h3>
          <p>{T('receipt')}</p>
        </div>
        <div className="a-receipt-divider" />
        <div className="a-receipt-info">
          <span>{T('orderNo')}{order.id}</span>
          <span>{T('table')} {order.tableNumber}</span>
          <span>{new Date(order.createdAt).toLocaleString()}</span>
        </div>
        <div className="a-receipt-divider" />
        {order.items.map((it) => (
          <div key={it.id} className="a-receipt-line">
            <span>{it.quantity}x {it.name}</span>
            <span>{fmt(it.price * it.quantity)}</span>
          </div>
        ))}
        <div className="a-receipt-divider" />
        <div className="a-receipt-total"><span>{T('total')}</span><span>{fmt(order.totalAmount)}</span></div>
        <p className="a-receipt-thanks">{T('thankYou')}</p>
        <button className="a-btn a-btn-green a-receipt-print" onClick={() => window.print()}>{T('printReceipt')}</button>
        <button className="a-btn a-btn-ghost" onClick={onClose} style={{ width: '100%', marginTop: 8 }}>{T('cancel')}</button>
      </div>
    </div>
  );
}

// ── Tables ──────────────────────────────────────────────
function TablesTab({ T }: { T: (k: string) => string }) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);

  const refreshTables = useCallback(() => { api.getTablesOverview().then(setTables).catch(() => {}); }, []);

  useEffect(() => {
    refreshTables();
    const i = setInterval(refreshTables, 5000);
    return () => clearInterval(i);
  }, [refreshTables]);

  async function openTable(num: number) {
    setSelectedTable(num);
    try {
      const orders = await api.getAllOrders(`table=${num}`);
      setTableOrders(orders.filter(o => ['pending', 'preparing', 'served'].includes(o.status)));
    } catch { setTableOrders([]); }
  }

  async function clearTable(num: number) {
    if (!confirm(`Clear all orders for Table ${num}? This will delete all order history for this table.`)) return;
    try {
      await api.clearTable(num);
      setSelectedTable(null);
      setTableOrders([]);
      refreshTables();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  }

  const occupiedCount = tables.filter(t => t.occupied).length;

  return (
    <div>
      <div className="a-topbar"><h2>{T('tableOverview')}</h2><span className="a-topbar-sub">{occupiedCount} {T('occupied')} / {tables.length - occupiedCount} {T('free')}</span></div>
      <div className="a-tables-grid">
        {tables.map((tb) => (
          <div key={tb.number} className={`a-table-card ${tb.occupied ? 'occupied' : 'free'}`} onClick={() => openTable(tb.number)} style={{ cursor: 'pointer' }}>
            <div className="a-table-number">{tb.number}</div>
            <div className="a-table-status">{tb.occupied ? T('occupied') : T('free')}</div>
            {tb.occupied && <div className="a-table-amount">{fmt(tb.activeAmount)}</div>}
            {tb.occupied && tb.orderCount > 0 && <div className="a-table-orders">{tb.orderCount} {T('orders').toLowerCase()}</div>}
          </div>
        ))}
      </div>

      {selectedTable && (
        <div className="a-overlay" onClick={() => setSelectedTable(null)}>
          <div className="a-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{T('table')} {selectedTable}</h3>
              <button className="a-btn a-btn-danger" onClick={() => clearTable(selectedTable)}>🗑 Clear Table</button>
            </div>
            {tableOrders.length === 0 ? <p className="a-empty">{T('noOrders')}</p> : tableOrders.map(o => (
              <div key={o.id} className={`a-order-card a-order-${o.status}`} style={{ marginBottom: 10 }}>
                <div className="a-order-header">
                  <span className="a-order-id">#{o.id}</span>
                  <span className={`a-status a-status-${o.status}`}>{T(o.status)}</span>
                </div>
                <div className="a-order-items">{o.items.map(it => <div key={it.id} className="a-order-line"><span>{it.quantity}x {it.name}</span><span>{fmt(it.price * it.quantity)}</span></div>)}</div>
                <div className="a-order-total" style={{ textAlign: 'right', marginTop: 6 }}>{fmt(o.totalAmount)}</div>
              </div>
            ))}
            <button className="a-btn a-btn-ghost" onClick={() => setSelectedTable(null)} style={{ width: '100%', marginTop: 12 }}>{T('close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Order History ───────────────────────────────────────
function HistoryTab({ T }: { T: (k: string) => string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [receipt, setReceipt] = useState<Order | null>(null);

  const load = useCallback(() => {
    const params = filter !== 'all' ? `status=${filter}` : '';
    api.getAllOrders(params).then(setOrders).catch(() => {});
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="a-topbar">
        <h2>{T('orderHistory')}</h2>
        <div className="a-filters">
          {['all', 'paid', 'cancelled', 'pending'].map((f) => (
            <button key={f} className={filter === f ? 'a-filter active' : 'a-filter'} onClick={() => setFilter(f)}>{f === 'all' ? T('all') : T(f)}</button>
          ))}
        </div>
      </div>
      <table className="a-table">
        <thead><tr><th>#</th><th>{T('table')}</th><th>{T('items')}</th><th>{T('total')}</th><th>{T('status')}</th><th>{T('orderTime')}</th><th>{T('actions')}</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.id}</td>
              <td><strong>{T('table')} {o.tableNumber}</strong></td>
              <td>{o.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}</td>
              <td className="a-td-name">{fmt(o.totalAmount)}</td>
              <td><span className={`a-status a-status-${o.status}`}>{T(o.status)}</span></td>
              <td>{new Date(o.createdAt).toLocaleString()}</td>
              <td><button className="a-btn a-btn-sm" onClick={() => setReceipt(o)}>🧾 {T('receipt')}</button></td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={7} className="a-empty">{T('noOrders')}</td></tr>}
        </tbody>
      </table>
      {receipt && <ReceiptModal order={receipt} T={T} onClose={() => setReceipt(null)} />}
    </div>
  );
}

// ── Menu (with image upload) ────────────────────────────
function MenuTab({ T }: { T: (k: string) => string }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [newCat, setNewCat] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.getMenu().then(setItems); api.getCategories().then(setCategories); }, []);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    try {
      const url = await api.uploadImage(file);
      setEditing({ ...editing, imageUrl: url });
    } catch (err) { alert(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function save() {
    if (!editing) return;
    if (!editing.name || editing.price == null) return alert('Name and price are required');
    if (editing.id) await api.updateMenuItem(editing.id, editing);
    else await api.createMenuItem(editing);
    setEditing(null);
    api.getMenu().then(setItems);
  }

  async function remove(id: number) {
    if (!confirm('Delete this item?')) return;
    await api.deleteMenuItem(id);
    api.getMenu().then(setItems);
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    await api.createCategory({ name: newCat.trim() });
    setNewCat('');
    api.getCategories().then(setCategories);
  }

  async function toggleAvail(item: MenuItem) {
    await api.updateMenuItem(item.id, { ...item, available: item.available ? 0 : 1 } as MenuItem);
    api.getMenu().then(setItems);
  }

  return (
    <div>
      <div className="a-topbar">
        <h2>{T('menuMgmt')}</h2>
        <button className="a-btn a-btn-green" onClick={() => setEditing({ name: '', price: 0, categoryId: categories[0]?.id || null, available: 1, description: '', imageUrl: '' })}>{T('addItem')}</button>
      </div>
      <div className="a-cat-row">
        <input placeholder={T('newCategory')} value={newCat} onChange={(e) => setNewCat(e.target.value)} className="a-input a-input-sm" />
        <button className="a-btn a-btn-blue" onClick={addCategory}>{T('addCategory')}</button>
      </div>

      {editing && (
        <div className="a-overlay" onClick={() => setEditing(null)}>
          <div className="a-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? T('editItem') : T('addItem')}</h3>
            <label>{T('name')}</label>
            <input className="a-input" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <label>{T('description')}</label>
            <input className="a-input" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Short description…" />
            <label>{T('price')} (LAK)</label>
            <input className="a-input" type="number" value={editing.price || ''} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
            <label>{T('category')}</label>
            <select className="a-input" value={editing.categoryId || ''} onChange={(e) => setEditing({ ...editing, categoryId: Number(e.target.value) || null })}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label>Image</label>
            <div className="a-upload-area">
              {editing.imageUrl ? (
                <div className="a-upload-preview">
                  <img src={editing.imageUrl} alt="Preview" />
                  <button className="a-btn a-btn-sm a-btn-danger" onClick={() => setEditing({ ...editing, imageUrl: '' })}>Remove</button>
                </div>
              ) : (
                <div className="a-upload-dropzone" onClick={() => fileRef.current?.click()}>
                  <span>📷</span>
                  <span>{uploading ? 'Uploading…' : 'Click to choose image'}</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </div>

            <div className="a-modal-actions">
              <button className="a-btn a-btn-ghost" onClick={() => setEditing(null)}>{T('cancel')}</button>
              <button className="a-btn a-btn-green" onClick={save} disabled={uploading}>{T('save')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="a-menu-cards">
        {items.map((item) => (
          <div key={item.id} className="a-menu-card-admin">
            {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <div className="a-menu-ph">🍽️</div>}
            <div className="a-menu-card-body">
              <strong>{item.name}</strong>
              <span className="a-mc-cat">{item.categoryName || '—'}</span>
              <span className="a-mc-price">{fmt(item.price)}</span>
            </div>
            <div className="a-menu-card-actions">
              <button className={`a-toggle ${item.available ? 'on' : 'off'}`} onClick={() => toggleAvail(item)}>{item.available ? '✓' : '✕'}</button>
              <button className="a-btn a-btn-sm" onClick={() => setEditing(item)}>{T('edit')}</button>
              <button className="a-btn a-btn-sm a-btn-danger" onClick={() => remove(item.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inventory ───────────────────────────────────────────
interface InvForm {
  name: string; quantity: string; unit: string; minStock: string;
  category: string; imageUrl: string; id?: number;
}

function InventoryTab({ T }: { T: (k: string) => string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [editing, setEditing] = useState<InvForm | null>(null);
  const [filter, setFilter] = useState<'all' | 'low' | 'ok'>('all');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<'name' | 'qty-asc' | 'qty-desc' | 'updated'>('name');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [uploading, setUploading] = useState(false);
  const [adjusting, setAdjusting] = useState<{ item: InventoryItem; value: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => { api.getInventory().then(setItems).catch(() => {}); }, []);
  useEffect(() => { reload(); }, [reload]);

  function openEdit(item?: InventoryItem) {
    if (item) {
      setEditing({
        id: item.id, name: item.name, quantity: String(item.quantity),
        unit: item.unit, minStock: String(item.minStock),
        category: item.category || '', imageUrl: item.imageUrl || '',
      });
    } else {
      setEditing({ name: '', quantity: '', unit: 'pcs', minStock: '', category: '', imageUrl: '' });
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setUploading(true);
    try {
      const url = await api.uploadImage(file);
      setEditing({ ...editing, imageUrl: url });
    } catch (err) { alert(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function save() {
    if (!editing?.name) return alert('Name required');
    const payload = {
      name: editing.name,
      quantity: Number(editing.quantity) || 0,
      unit: editing.unit || 'pcs',
      minStock: Number(editing.minStock) || 0,
      category: editing.category || null,
      imageUrl: editing.imageUrl || null,
    };
    if (editing.id) await api.updateInventory(editing.id, payload as InventoryItem);
    else await api.createInventory(payload as InventoryItem);
    setEditing(null);
    reload();
  }

  async function quickAdjust(item: InventoryItem, delta: number) {
    const newQty = Math.max(0, item.quantity + delta);
    await api.updateInventory(item.id, { ...item, quantity: newQty });
    reload();
  }

  async function applyAdjust() {
    if (!adjusting) return;
    const val = Number(adjusting.value);
    if (isNaN(val) || val < 0) return;
    await api.updateInventory(adjusting.item.id, { ...adjusting.item, quantity: val });
    setAdjusting(null);
    reload();
  }

  async function remove(id: number) {
    if (!confirm('Delete this item?')) return;
    await api.deleteInventory(id);
    reload();
  }

  const lowCount = items.filter(i => i.quantity <= i.minStock).length;
  const okCount = items.filter(i => i.quantity > i.minStock).length;
  const totalValue = items.reduce((s, i) => s + i.quantity, 0);
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];

  const filtered = items
    .filter(i => {
      if (filter === 'low' && i.quantity > i.minStock) return false;
      if (filter === 'ok' && i.quantity <= i.minStock) return false;
      if (catFilter && i.category !== catFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'qty-asc') return a.quantity - b.quantity;
      if (sort === 'qty-desc') return b.quantity - a.quantity;
      if (sort === 'updated') return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="inv-page">
      {/* Header */}
      <div className="inv-header">
        <div>
          <h2 className="inv-title">{T('inventory')}</h2>
          <p className="inv-subtitle">{items.length} {T('items')} · {totalValue.toLocaleString()} {T('unit')}s total</p>
        </div>
        <button className="a-btn a-btn-green inv-add-btn" onClick={() => openEdit()}>+ {T('addItem')}</button>
      </div>

      {/* Summary cards */}
      <div className="inv-stats-row">
        <div className={`inv-stat-card ${filter === 'all' ? 'inv-stat-active' : ''}`} onClick={() => setFilter('all')}>
          <div className="inv-stat-icon inv-stat-icon-all">📊</div>
          <div>
            <span className="inv-stat-num">{items.length}</span>
            <span className="inv-stat-label">{T('all')} {T('items')}</span>
          </div>
        </div>
        <div className={`inv-stat-card ${filter === 'ok' ? 'inv-stat-active' : ''}`} onClick={() => setFilter('ok')}>
          <div className="inv-stat-icon inv-stat-icon-ok">✅</div>
          <div>
            <span className="inv-stat-num inv-num-green">{okCount}</span>
            <span className="inv-stat-label">{T('inStock')}</span>
          </div>
        </div>
        <div className={`inv-stat-card ${filter === 'low' ? 'inv-stat-active' : ''}`} onClick={() => setFilter('low')}>
          <div className="inv-stat-icon inv-stat-icon-low">⚠️</div>
          <div>
            <span className="inv-stat-num inv-num-red">{lowCount}</span>
            <span className="inv-stat-label">{T('lowStock')}</span>
          </div>
        </div>
      </div>

      {/* Low stock alert banner */}
      {lowCount > 0 && filter !== 'low' && (
        <div className="inv-alert-banner" onClick={() => setFilter('low')}>
          <span>⚠️ {lowCount} {T('items')} {T('lowStock').toLowerCase()} — click to view</span>
        </div>
      )}

      {/* Toolbar: search, category filter, sort, view toggle */}
      <div className="inv-toolbar">
        <div className="inv-search-box">
          <span className="inv-search-icon">🔍</span>
          <input className="inv-search-input" placeholder={`${T('search')}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="inv-search-clear" onClick={() => setSearch('')}>&times;</button>}
        </div>
        <div className="inv-toolbar-right">
          {categories.length > 0 && (
            <select className="inv-select" value={catFilter || ''} onChange={(e) => setCatFilter(e.target.value || null)}>
              <option value="">{T('all')} {T('category')}</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select className="inv-select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="name">{T('name')} A-Z</option>
            <option value="qty-asc">{T('quantity')} ↑</option>
            <option value="qty-desc">{T('quantity')} ↓</option>
            <option value="updated">Recently Updated</option>
          </select>
          <div className="inv-view-toggle">
            <button className={viewMode === 'card' ? 'active' : ''} onClick={() => setViewMode('card')} title="Cards">▦</button>
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')} title="Table">☰</button>
          </div>
        </div>
      </div>

      {/* Edit/Add modal */}
      {editing && (
        <div className="a-overlay" onClick={() => setEditing(null)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inv-modal-header">
              <h3>{editing.id ? T('editItem') : T('addItem')}</h3>
              <button className="inv-modal-close" onClick={() => setEditing(null)}>&times;</button>
            </div>

            <div className="inv-modal-body">
              <div className="a-upload-area">
                {editing.imageUrl ? (
                  <div className="inv-upload-preview">
                    <img src={editing.imageUrl} alt="Preview" />
                    <div className="inv-upload-overlay" onClick={() => setEditing({ ...editing, imageUrl: '' })}>
                      <span>🗑 Remove</span>
                    </div>
                  </div>
                ) : (
                  <div className="inv-upload-dropzone" onClick={() => fileRef.current?.click()}>
                    <span className="inv-upload-icon">📷</span>
                    <span className="inv-upload-text">{uploading ? 'Uploading…' : 'Upload Photo'}</span>
                    <span className="inv-upload-hint">JPG, PNG up to 5MB</span>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </div>

              <div className="inv-field">
                <label>{T('name')} *</label>
                <input className="inv-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Item name…" autoFocus />
              </div>

              <div className="inv-form-row">
                <div className="inv-field">
                  <label>{T('quantity')}</label>
                  <input className="inv-input" type="number" min="0" step="any" value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} placeholder="0" />
                </div>
                <div className="inv-field">
                  <label>{T('unit')}</label>
                  <select className="inv-input" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })}>
                    <option value="pcs">Pieces</option>
                    <option value="bottles">Bottles</option>
                    <option value="cans">Cans</option>
                    <option value="kg">Kilograms</option>
                    <option value="liters">Liters</option>
                    <option value="boxes">Boxes</option>
                    <option value="packs">Packs</option>
                    <option value="bags">Bags</option>
                  </select>
                </div>
              </div>

              <div className="inv-form-row">
                <div className="inv-field">
                  <label>{T('minStock')}</label>
                  <input className="inv-input" type="number" min="0" step="any" value={editing.minStock} onChange={(e) => setEditing({ ...editing, minStock: e.target.value })} placeholder="0" />
                  <span className="inv-field-hint">Alert when stock falls below</span>
                </div>
                <div className="inv-field">
                  <label>{T('category')}</label>
                  <input className="inv-input" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} list="inv-cats" placeholder="e.g. Beverages…" />
                  <datalist id="inv-cats">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>
            </div>

            <div className="inv-modal-footer">
              <button className="a-btn a-btn-ghost" onClick={() => setEditing(null)}>{T('cancel')}</button>
              <button className="a-btn a-btn-green" onClick={save} disabled={uploading || !editing.name.trim()}>
                {editing.id ? T('save') : T('addItem')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust quantity modal */}
      {adjusting && (
        <div className="a-overlay" onClick={() => setAdjusting(null)}>
          <div className="inv-adjust-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Set {T('quantity')}</h3>
            <p className="inv-adjust-name">{adjusting.item.name}</p>
            <div className="inv-adjust-input-wrap">
              <input
                className="inv-adjust-input"
                type="number"
                min="0"
                step="any"
                value={adjusting.value}
                onChange={(e) => setAdjusting({ ...adjusting, value: e.target.value })}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && applyAdjust()}
              />
              <span className="inv-adjust-unit">{adjusting.item.unit}</span>
            </div>
            <div className="inv-adjust-actions">
              <button className="a-btn a-btn-ghost" onClick={() => setAdjusting(null)}>{T('cancel')}</button>
              <button className="a-btn a-btn-green" onClick={applyAdjust}>{T('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Card view */}
      {viewMode === 'card' && (
        <div className="inv-grid">
          {filtered.map((item) => {
            const isLow = item.quantity <= item.minStock;
            const pct = item.minStock > 0 ? Math.min(100, (item.quantity / (item.minStock * 3)) * 100) : 100;
            return (
              <div key={item.id} className={`inv-card ${isLow ? 'inv-card-low' : ''}`}>
                <div className="inv-card-top">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="inv-card-img" />
                  ) : (
                    <div className="inv-card-img-ph">📦</div>
                  )}
                  <div className="inv-card-info">
                    <strong className="inv-card-name">{item.name}</strong>
                    <span className="inv-card-cat">{item.category || '—'}</span>
                  </div>
                  <div className="inv-card-status-dot">
                    {isLow
                      ? <span className="inv-dot inv-dot-red" title={T('lowStock')} />
                      : <span className="inv-dot inv-dot-green" title={T('inStock')} />}
                  </div>
                </div>

                {isLow && (
                  <div className="inv-card-alert">
                    ⚠ {T('lowStock')} — {item.quantity} {item.unit} left (min: {item.minStock})
                  </div>
                )}

                <div className="inv-card-stock">
                  <div className="inv-stock-header">
                    <span className="inv-stock-label">{T('quantity')}</span>
                    <span className={`inv-stock-value ${isLow ? 'inv-stock-danger' : ''}`}>{item.quantity} <small>{item.unit}</small></span>
                  </div>
                  <div className="inv-progress-bg">
                    <div
                      className={`inv-progress-bar ${isLow ? 'inv-progress-red' : pct < 50 ? 'inv-progress-orange' : 'inv-progress-green'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="inv-stock-footer">
                    <span>{T('minStock')}: {item.minStock} {item.unit}</span>
                    {item.updatedAt && <span>{new Date(item.updatedAt).toLocaleDateString()}</span>}
                  </div>
                </div>

                <div className="inv-card-actions">
                  <div className="inv-quick-adj">
                    <button className="inv-adj-btn" onClick={() => quickAdjust(item, -1)} disabled={item.quantity <= 0}>−</button>
                    <button className="inv-adj-qty" onClick={() => setAdjusting({ item, value: String(item.quantity) })}>{item.quantity}</button>
                    <button className="inv-adj-btn inv-adj-plus" onClick={() => quickAdjust(item, 1)}>+</button>
                  </div>
                  <div className="inv-btns">
                    <button className="a-btn a-btn-sm" onClick={() => openEdit(item)} title={T('edit')}>✏️</button>
                    <button className="a-btn a-btn-sm a-btn-danger" onClick={() => remove(item.id)} title={T('delete')}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="a-empty">{T('noData')}</p>}
        </div>
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th></th>
                <th>{T('name')}</th>
                <th>{T('category')}</th>
                <th>{T('quantity')}</th>
                <th>{T('unit')}</th>
                <th>{T('minStock')}</th>
                <th>{T('status')}</th>
                <th>{T('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isLow = item.quantity <= item.minStock;
                return (
                  <tr key={item.id} className={isLow ? 'inv-row-low' : ''}>
                    <td className="inv-td-img">
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt="" />
                        : <div className="inv-td-img-ph">📦</div>}
                    </td>
                    <td className="inv-td-name">{item.name}</td>
                    <td>{item.category || '—'}</td>
                    <td>
                      <div className="inv-td-qty">
                        <button className="inv-td-adj" onClick={() => quickAdjust(item, -1)} disabled={item.quantity <= 0}>−</button>
                        <button className="inv-td-qty-val" onClick={() => setAdjusting({ item, value: String(item.quantity) })}>{item.quantity}</button>
                        <button className="inv-td-adj inv-td-adj-plus" onClick={() => quickAdjust(item, 1)}>+</button>
                      </div>
                    </td>
                    <td>{item.unit}</td>
                    <td>{item.minStock}</td>
                    <td>
                      {isLow
                        ? <span className="inv-badge-low">⚠ {T('lowStock')}</span>
                        : <span className="inv-badge-ok">✓ {T('inStock')}</span>}
                    </td>
                    <td>
                      <div className="inv-td-actions">
                        <button className="a-btn a-btn-sm" onClick={() => openEdit(item)}>✏️</button>
                        <button className="a-btn a-btn-sm a-btn-danger" onClick={() => remove(item.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="a-empty">{T('noData')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="inv-footer-count">
        {filtered.length} of {items.length} {T('items')}
      </div>
    </div>
  );
}

// ── Charts ──────────────────────────────────────────────
function ChartsTab({ T }: { T: (k: string) => string }) {
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hourly, setHourly] = useState<HourlyStat[]>([]);
  const [catSales, setCatSales] = useState<CategorySale[]>([]);
  const [days, setDays] = useState(7);

  useEffect(() => {
    api.getDaily(days).then(setDaily).catch(() => {});
    api.getTopItems().then(setTopItems).catch(() => {});
    api.getSummary().then(setSummary).catch(() => {});
    api.getHourly().then(setHourly).catch(() => {});
    api.getCategorySales().then(setCatSales).catch(() => {});
  }, [days]);

  const maxRev = Math.max(...daily.map(d => d.revenue), 1);
  const maxOrd = Math.max(...daily.map(d => d.orders), 1);
  const maxTopQty = Math.max(...topItems.map(t => t.totalQty), 1);
  const maxHourRev = Math.max(...hourly.map(h => h.revenue), 1);
  const maxCatRev = Math.max(...catSales.map(c => c.totalRevenue), 1);

  return (
    <div>
      <div className="a-topbar">
        <h2>{T('analytics')}</h2>
        <div className="a-filters">
          {[7, 14, 30].map((d) => (
            <button key={d} className={days === d ? 'a-filter active' : 'a-filter'} onClick={() => setDays(d)}>{d} {T('days')}</button>
          ))}
        </div>
      </div>
      {summary && (
        <div className="a-stats-row">
          <div className="a-stat"><span className="a-stat-value">{fmt(summary.totalRevenue)}</span><span className="a-stat-label">{T('totalRevenue')}</span></div>
          <div className="a-stat"><span className="a-stat-value">{fmt(summary.todayRevenue)}</span><span className="a-stat-label">{T('todayRevenue')}</span></div>
          <div className="a-stat"><span className="a-stat-value">{summary.todayOrders}</span><span className="a-stat-label">{T('todayOrders')}</span></div>
          <div className="a-stat"><span className="a-stat-value">{fmt(summary.avgOrderValue)}</span><span className="a-stat-label">{T('avgOrderValue')}</span></div>
        </div>
      )}
      <div className="a-charts-grid">
        <div className="a-chart-card">
          <h3>{T('dailyRevenue')}</h3>
          <div className="a-bar-chart">
            {daily.map((d) => (<div key={d.date} className="a-bar-col"><div className="a-bar" style={{ height: `${(d.revenue / maxRev) * 100}%` }}><span className="a-bar-tooltip">{fmt(d.revenue)}</span></div><span className="a-bar-label">{d.date.slice(5)}</span></div>))}
            {daily.length === 0 && <p className="a-empty">{T('noData')}</p>}
          </div>
        </div>
        <div className="a-chart-card">
          <h3>{T('dailyOrders')}</h3>
          <div className="a-bar-chart">
            {daily.map((d) => (<div key={d.date} className="a-bar-col"><div className="a-bar a-bar-blue" style={{ height: `${(d.orders / maxOrd) * 100}%` }}><span className="a-bar-tooltip">{d.orders}</span></div><span className="a-bar-label">{d.date.slice(5)}</span></div>))}
            {daily.length === 0 && <p className="a-empty">{T('noData')}</p>}
          </div>
        </div>
        <div className="a-chart-card">
          <h3>{T('hourlyBreakdown')}</h3>
          <div className="a-bar-chart">
            {hourly.map((h) => (<div key={h.hour} className="a-bar-col"><div className="a-bar a-bar-purple" style={{ height: `${(h.revenue / maxHourRev) * 100}%` }}><span className="a-bar-tooltip">{fmt(h.revenue)}</span></div><span className="a-bar-label">{h.hour}:00</span></div>))}
            {hourly.length === 0 && <p className="a-empty">{T('noData')}</p>}
          </div>
        </div>
        <div className="a-chart-card">
          <h3>{T('categorySales')}</h3>
          <div className="a-horiz-chart">
            {catSales.map((c) => (<div key={c.category} className="a-horiz-row"><span className="a-horiz-name">{c.category}</span><div className="a-horiz-bar-wrap"><div className="a-horiz-bar a-hb-green" style={{ width: `${(c.totalRevenue / maxCatRev) * 100}%` }} /></div><span className="a-horiz-value">{fmt(c.totalRevenue)}</span></div>))}
            {catSales.length === 0 && <p className="a-empty">{T('noData')}</p>}
          </div>
        </div>
        <div className="a-chart-card a-chart-wide">
          <h3>{T('topSelling')}</h3>
          <div className="a-horiz-chart">
            {topItems.map((ti) => (<div key={ti.name} className="a-horiz-row"><span className="a-horiz-name">{ti.name}</span><div className="a-horiz-bar-wrap"><div className="a-horiz-bar" style={{ width: `${(ti.totalQty / maxTopQty) * 100}%` }} /></div><span className="a-horiz-value">{ti.totalQty} {T('sold')}</span></div>))}
            {topItems.length === 0 && <p className="a-empty">{T('noData')}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Accounts ────────────────────────────────────────────
function AccountsTab({ T, currentAdmin }: { T: (k: string) => string; currentAdmin: AdminUser }) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'admin' });
  const [changePw, setChangePw] = useState<{ id: number; password: string } | null>(null);

  useEffect(() => { api.getAdmins().then(setAdmins).catch(() => {}); }, []);

  async function addAdmin() {
    if (!form.username || !form.password || !form.displayName) return alert('All fields required');
    try {
      await api.createAdmin(form);
      setShowAdd(false);
      setForm({ username: '', displayName: '', password: '', role: 'admin' });
      api.getAdmins().then(setAdmins);
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  async function removeAdmin(id: number) {
    if (!confirm('Delete this account?')) return;
    await api.deleteAdmin(id);
    api.getAdmins().then(setAdmins);
  }

  async function doChangePw() {
    if (!changePw || !changePw.password) return;
    try {
      await api.changePassword(changePw.id, changePw.password);
      setChangePw(null);
      alert('Password changed');
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  return (
    <div>
      <div className="a-topbar">
        <h2>👥 Accounts</h2>
        <button className="a-btn a-btn-green" onClick={() => setShowAdd(true)}>+ Add Account</button>
      </div>

      {showAdd && (
        <div className="a-overlay" onClick={() => setShowAdd(false)}>
          <div className="a-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Admin Account</h3>
            <label>Username</label>
            <input className="a-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <label>Display Name</label>
            <input className="a-input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            <label>Password</label>
            <input className="a-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <label>Role</label>
            <select className="a-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="cashier">Cashier</option>
              <option value="owner">Owner</option>
            </select>
            <div className="a-modal-actions">
              <button className="a-btn a-btn-ghost" onClick={() => setShowAdd(false)}>{T('cancel')}</button>
              <button className="a-btn a-btn-green" onClick={addAdmin}>{T('save')}</button>
            </div>
          </div>
        </div>
      )}

      {changePw && (
        <div className="a-overlay" onClick={() => setChangePw(null)}>
          <div className="a-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Change Password</h3>
            <label>New Password</label>
            <input className="a-input" type="password" value={changePw.password} onChange={(e) => setChangePw({ ...changePw, password: e.target.value })} />
            <div className="a-modal-actions">
              <button className="a-btn a-btn-ghost" onClick={() => setChangePw(null)}>{T('cancel')}</button>
              <button className="a-btn a-btn-green" onClick={doChangePw}>{T('save')}</button>
            </div>
          </div>
        </div>
      )}

      <table className="a-table">
        <thead><tr><th>ID</th><th>Username</th><th>Display Name</th><th>Role</th><th>Created</th><th>{T('actions')}</th></tr></thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td className="a-td-name">{a.username}</td>
              <td>{a.displayName}</td>
              <td><span className={`a-role-badge a-role-${a.role}`}>{a.role}</span></td>
              <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}</td>
              <td>
                <button className="a-btn a-btn-sm" onClick={() => setChangePw({ id: a.id, password: '' })}>🔑</button>
                {a.id !== currentAdmin.id && <button className="a-btn a-btn-sm a-btn-danger" onClick={() => removeAdmin(a.id)}>🗑</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
