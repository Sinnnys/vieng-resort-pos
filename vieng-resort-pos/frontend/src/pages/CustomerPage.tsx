import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { MenuItem, Order, CartItem } from '../api';
import { t, getLang, setLang, LANG_LABELS, LANG_FLAGS } from '../i18n';
import type { Lang } from '../i18n';

const fmt = (n: number) => n.toLocaleString() + ' ₭';

const CAT_COLORS: Record<string, string> = {
  Drinks: '#e0f2fe', Food: '#fef3c7', Snacks: '#fce7f3', 'Beer & Cocktails': '#ede9fe',
};
const CAT_ICONS: Record<string, string> = {
  Drinks: '🥤', Food: '🍛', Snacks: '🍿', 'Beer & Cocktails': '🍻',
};

export default function CustomerPage() {
  const { tableNumber } = useParams<{ tableNumber: string }>();
  const table = Number(tableNumber) || 1;
  const navigate = useNavigate();
  const [lang, setLangState] = useState<Lang>(getLang);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Map<number, CartItem>>(new Map());
  const [orders, setOrders] = useState<Order[]>([]);
  const [sending, setSending] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [itemNote, setItemNote] = useState('');
  const [showLang, setShowLang] = useState(false);

  // Checkout flow
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerContact, setCustomerContact] = useState('');

  // Receipt
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  const changeLang = (l: Lang) => { setLangState(l); setLang(l); setShowLang(false); };
  const T = (key: string) => t(lang, key);

  useEffect(() => {
    api.getMenu().then((items) => setMenu(items.filter((i) => i.available)));
    api.getTableOrders(table).then(setOrders);
  }, [table]);

  const refreshOrders = useCallback(() => { api.getTableOrders(table).then(setOrders); }, [table]);
  useEffect(() => { const i = setInterval(refreshOrders, 8000); return () => clearInterval(i); }, [refreshOrders]);

  const categories = useMemo(() => [...new Set(menu.map((m) => m.categoryName || 'Other'))], [menu]);

  const filteredMenu = useMemo(() => {
    let items = activeCategory ? menu.filter((m) => (m.categoryName || 'Other') === activeCategory) : menu;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((m) => m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q));
    }
    return items;
  }, [menu, activeCategory, search]);

  const cartItems = [...cart.values()];
  const cartTotal = cartItems.reduce((sum, ci) => {
    const item = menu.find((m) => m.id === ci.menuItemId);
    return sum + (item?.price || 0) * ci.quantity;
  }, 0);
  const cartCount = cartItems.reduce((s, c) => s + c.quantity, 0);

  function addToCart(item: MenuItem, note?: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      if (existing) next.set(item.id, { ...existing, quantity: existing.quantity + 1, note: note || existing.note });
      else next.set(item.id, { menuItemId: item.id, quantity: 1, note });
      return next;
    });
  }

  function updateQty(id: number, delta: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) next.delete(id);
      else next.set(id, { ...existing, quantity: newQty });
      return next;
    });
  }

  function updateCartNote(id: number, note: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (!existing) return prev;
      next.set(id, { ...existing, note });
      return next;
    });
  }

  function startCheckout() {
    if (cartItems.length === 0) return;
    setShowCart(false);
    setShowCheckout(true);
  }

  async function placeOrder() {
    if (cartItems.length === 0 || !customerContact.trim()) return;
    setSending(true);
    try {
      const result = await api.createOrder({ tableNumber: table, items: cartItems, customerContact: customerContact.trim() } as Parameters<typeof api.createOrder>[0] & { customerContact: string });
      setCart(new Map());
      setShowCheckout(false);
      setCustomerContact('');
      navigate(`/table/${table}/order/${result.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally { setSending(false); }
  }

  function downloadReceipt(order: Order) {
    const lines = [
      '═══════════════════════════════',
      '       VIENG RESORT CAFE',
      '═══════════════════════════════',
      '',
      `${T('orderNo')}${order.id}`,
      `${T('table')} ${order.tableNumber}`,
      `${T('dateTime')}: ${new Date(order.createdAt).toLocaleString()}`,
      '',
      '───────────────────────────────',
    ];
    order.items.forEach(it => {
      lines.push(`  ${it.quantity}x ${it.name}`);
      lines.push(`       ${fmt(it.price * it.quantity)}`);
    });
    lines.push('───────────────────────────────');
    lines.push(`  ${T('total')}:  ${fmt(order.totalAmount)}`);
    lines.push('═══════════════════════════════');
    lines.push('');
    lines.push(`  ${T('thankYou')}`);
    lines.push('');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-order-${order.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeOrders = orders.filter((o) => o.status !== 'paid' && o.status !== 'cancelled');
  const paidOrders = orders.filter((o) => o.status === 'paid');

  return (
    <div className="customer-page">
      {/* Header */}
      <header className="c-header">
        <img src="/media/logo.png" alt="Logo" className="c-logo" />
        <div className="c-header-info">
          <h1>{T('viengCafe')}</h1>
          <span className="c-table-badge">{T('table')} {table}</span>
        </div>
        <div className="c-header-actions">
          <button className="c-btn-icon c-lang-btn" onClick={() => setShowLang(!showLang)}>
            {LANG_FLAGS[lang]}
            {showLang && (
              <div className="c-lang-dropdown" onClick={(e) => e.stopPropagation()}>
                {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
                  <button key={l} className={lang === l ? 'active' : ''} onClick={() => changeLang(l)}>
                    {LANG_FLAGS[l]} {LANG_LABELS[l]}
                  </button>
                ))}
              </div>
            )}
          </button>
          <button className="c-btn-icon" onClick={() => setShowOrders(true)}>
            📋 {activeOrders.length > 0 && <span className="c-badge">{activeOrders.length}</span>}
          </button>
          <button className="c-btn-icon c-cart-btn" onClick={() => setShowCart(true)}>
            🛒 {cartCount > 0 && <span className="c-badge">{cartCount}</span>}
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="c-search-wrap">
        <div className="c-search-inner">
          <span className="c-search-icon">🔍</span>
          <input className="c-search" placeholder={T('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Categories */}
      <div className="c-categories">
        <button className={activeCategory === null ? 'c-cat active' : 'c-cat'} onClick={() => setActiveCategory(null)}>
          {T('all')}
        </button>
        {categories.map((c) => (
          <button key={c} className={activeCategory === c ? 'c-cat active' : 'c-cat'} onClick={() => setActiveCategory(c)}>
            {CAT_ICONS[c] || '🍽️'} {c}
          </button>
        ))}
      </div>

      {/* Menu grid */}
      <div className="c-menu-grid">
        {filteredMenu.length === 0 && <p className="c-empty">{T('noItems')}</p>}
        {filteredMenu.map((item) => {
          const inCart = cart.get(item.id)?.quantity || 0;
          const bg = CAT_COLORS[item.categoryName || ''] || '#f0fdf4';
          return (
            <div key={item.id} className="c-menu-card" onClick={() => { setDetailItem(item); setItemNote(''); }}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="c-menu-img" loading="lazy" />
              ) : (
                <div className="c-menu-placeholder" style={{ background: bg }}>
                  <span>{CAT_ICONS[item.categoryName || ''] || '🍽️'}</span>
                </div>
              )}
              <div className="c-menu-body">
                <span className="c-menu-name">{item.name}</span>
                <span className="c-menu-desc">{item.description || T('noDescription')}</span>
                <div className="c-menu-bottom">
                  <span className="c-menu-price">{fmt(item.price)}</span>
                  <button className="c-quick-add" onClick={(e) => { e.stopPropagation(); addToCart(item); }}>+</button>
                </div>
              </div>
              {inCart > 0 && <div className="c-menu-badge">{inCart}</div>}
            </div>
          );
        })}
      </div>

      {/* Item detail modal */}
      {detailItem && (
        <div className="c-overlay" onClick={() => setDetailItem(null)}>
          <div className="c-detail-modal" onClick={(e) => e.stopPropagation()}>
            {detailItem.imageUrl ? (
              <img src={detailItem.imageUrl} alt={detailItem.name} className="c-detail-img" />
            ) : (
              <div className="c-detail-placeholder" style={{ background: CAT_COLORS[detailItem.categoryName || ''] || '#f0fdf4' }}>
                <span>{CAT_ICONS[detailItem.categoryName || ''] || '🍽️'}</span>
              </div>
            )}
            <div className="c-detail-body">
              <div className="c-detail-cat">{CAT_ICONS[detailItem.categoryName || ''] || '🍽️'} {detailItem.categoryName || 'Other'}</div>
              <h3>{detailItem.name}</h3>
              <p className="c-detail-desc">{detailItem.description || T('noDescription')}</p>
              <p className="c-detail-price">{fmt(detailItem.price)}</p>
              <label className="c-detail-label">{T('specialInstructions')}</label>
              <textarea className="c-detail-note" placeholder={T('itemNote')} value={itemNote} onChange={(e) => setItemNote(e.target.value)} rows={2} />
              <button className="c-btn-primary" onClick={() => { addToCart(detailItem, itemNote); setDetailItem(null); }}>
                {T('addToCart')} — {fmt(detailItem.price)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders panel */}
      {showOrders && (
        <div className="c-overlay" onClick={() => setShowOrders(false)}>
          <div className="c-panel" onClick={(e) => e.stopPropagation()}>
            <div className="c-panel-header">
              <h2>{T('orders')}</h2>
              <button onClick={() => setShowOrders(false)} className="c-close">&times;</button>
            </div>
            {activeOrders.length === 0 && paidOrders.length === 0 && <p className="c-empty">{T('noOrders')}</p>}

            {activeOrders.map((o) => (
              <div key={o.id} className="c-order-card">
                <div className="c-order-top">
                  <span className="c-order-num">{T('orderNumber')} #{o.id}</span>
                  <span className={`c-status c-status-${o.status}`}>{T(o.status)}</span>
                </div>
                {o.items.map((it) => (
                  <div key={it.id} className="c-order-line">
                    <span>{it.quantity}x {it.name}</span>
                    <span>{fmt(it.price * it.quantity)}</span>
                  </div>
                ))}
                <div className="c-order-total">{T('total')}: {fmt(o.totalAmount)}</div>
                <div className="c-order-time">{new Date(o.createdAt).toLocaleTimeString()}</div>
              </div>
            ))}

            {paidOrders.length > 0 && (
              <>
                <h3 className="c-section-title">{T('paid')}</h3>
                {paidOrders.map((o) => (
                  <div key={o.id} className="c-order-card c-order-paid">
                    <div className="c-order-top">
                      <span className="c-order-num">{T('orderNumber')} #{o.id}</span>
                      <span className="c-status c-status-paid">{T('paid')}</span>
                    </div>
                    {o.items.map((it) => (
                      <div key={it.id} className="c-order-line">
                        <span>{it.quantity}x {it.name}</span>
                        <span>{fmt(it.price * it.quantity)}</span>
                      </div>
                    ))}
                    <div className="c-order-total">{T('total')}: {fmt(o.totalAmount)}</div>
                    <button className="c-btn-receipt" onClick={() => downloadReceipt(o)}>
                      📄 {T('downloadReceipt')}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Cart panel */}
      {showCart && (
        <div className="c-overlay" onClick={() => setShowCart(false)}>
          <div className="c-panel" onClick={(e) => e.stopPropagation()}>
            <div className="c-panel-header">
              <h2>{T('cart')}</h2>
              <button onClick={() => setShowCart(false)} className="c-close">&times;</button>
            </div>
            {cartItems.length === 0 ? <p className="c-empty">{T('emptyCart')}</p> : (
              <>
                {cartItems.map((ci) => {
                  const item = menu.find((m) => m.id === ci.menuItemId);
                  if (!item) return null;
                  return (
                    <div key={ci.menuItemId} className="c-cart-item">
                      <div className="c-cart-left">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="c-cart-thumb" />
                        ) : (
                          <div className="c-cart-thumb-ph" style={{ background: CAT_COLORS[item.categoryName || ''] || '#f0fdf4' }}>
                            {CAT_ICONS[item.categoryName || ''] || '🍽️'}
                          </div>
                        )}
                        <div className="c-cart-info">
                          <span className="c-cart-name">{item.name}</span>
                          <span className="c-cart-price">{fmt(item.price)} x {ci.quantity}</span>
                          <input className="c-cart-note-input" placeholder={T('itemNote')} value={ci.note || ''} onChange={(e) => updateCartNote(ci.menuItemId, e.target.value)} />
                        </div>
                      </div>
                      <div className="c-cart-right">
                        <span className="c-cart-subtotal">{fmt(item.price * ci.quantity)}</span>
                        <div className="c-qty-controls">
                          <button onClick={() => updateQty(ci.menuItemId, -1)}>−</button>
                          <span>{ci.quantity}</span>
                          <button onClick={() => updateQty(ci.menuItemId, 1)}>+</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="c-cart-total">
                  <span>{T('total')}</span>
                  <span>{fmt(cartTotal)}</span>
                </div>
                <button className="c-btn-primary" onClick={startCheckout}>
                  {T('orderConfirm')} — {fmt(cartTotal)}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Checkout / confirm panel */}
      {showCheckout && (
        <div className="c-overlay" onClick={() => setShowCheckout(false)}>
          <div className="c-panel c-checkout-panel" onClick={(e) => e.stopPropagation()}>
            <div className="c-panel-header">
              <h2>{T('confirmOrder')}</h2>
              <button onClick={() => setShowCheckout(false)} className="c-close">&times;</button>
            </div>

            <div className="c-checkout-summary">
              <h3>{T('orderSummary')}</h3>
              {cartItems.map((ci) => {
                const item = menu.find((m) => m.id === ci.menuItemId);
                if (!item) return null;
                return (
                  <div key={ci.menuItemId} className="c-checkout-line">
                    <span>{ci.quantity}x {item.name}</span>
                    <span>{fmt(item.price * ci.quantity)}</span>
                  </div>
                );
              })}
              <div className="c-checkout-total">
                <span>{T('total')}</span>
                <span>{fmt(cartTotal)}</span>
              </div>
            </div>

            <div className="c-checkout-contact">
              <label>{T('emailOrPhone')}</label>
              <p className="c-checkout-hint">{T('contactHint')}</p>
              <input
                className="c-checkout-input"
                type="text"
                placeholder={T('contactPlaceholder')}
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                autoFocus
              />
            </div>

            <div className="c-checkout-actions">
              <button className="c-btn-ghost" onClick={() => { setShowCheckout(false); setShowCart(true); }}>
                ← {T('back')}
              </button>
              <button className="c-btn-primary" onClick={placeOrder} disabled={sending || !customerContact.trim()}>
                {sending ? T('sending') : T('confirmOrder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt view */}
      {receiptOrder && (
        <div className="c-overlay" onClick={() => setReceiptOrder(null)}>
          <div className="c-panel" onClick={(e) => e.stopPropagation()}>
            <div className="c-panel-header"><h2>{T('receipt')}</h2><button onClick={() => setReceiptOrder(null)} className="c-close">&times;</button></div>
            <div className="c-checkout-summary">
              <p>{T('orderNo')}{receiptOrder.id} — {T('table')} {receiptOrder.tableNumber}</p>
              <p>{new Date(receiptOrder.createdAt).toLocaleString()}</p>
              {receiptOrder.items.map((it) => (
                <div key={it.id} className="c-checkout-line"><span>{it.quantity}x {it.name}</span><span>{fmt(it.price * it.quantity)}</span></div>
              ))}
              <div className="c-checkout-total"><span>{T('total')}</span><span>{fmt(receiptOrder.totalAmount)}</span></div>
            </div>
            <button className="c-btn-receipt" onClick={() => downloadReceipt(receiptOrder)}>📄 {T('downloadReceipt')}</button>
          </div>
        </div>
      )}

      {/* Floating cart bar */}
      {cartCount > 0 && !showCart && !showCheckout && (
        <div className="c-floating-bar" onClick={() => setShowCart(true)}>
          <span>{cartCount} {cartCount > 1 ? T('items') : T('item')}</span>
          <span>{T('viewCart')} — {fmt(cartTotal)}</span>
        </div>
      )}
    </div>
  );
}
