import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Order } from '../api';
import { t, getLang, setLang, LANG_LABELS, LANG_FLAGS } from '../i18n';
import type { Lang } from '../i18n';

const fmt = (n: number) => n.toLocaleString() + ' ₭';

const STATUS_STEPS = ['pending', 'preparing', 'served', 'paid'] as const;

export default function OrderStatusPage() {
  const { tableNumber, orderId } = useParams<{ tableNumber: string; orderId: string }>();
  const table = Number(tableNumber) || 1;
  const oId = Number(orderId) || 0;
  const navigate = useNavigate();

  const [lang, setLangState] = useState<Lang>(getLang);
  const [order, setOrder] = useState<Order | null>(null);
  const [showLang, setShowLang] = useState(false);

  const changeLang = (l: Lang) => { setLangState(l); setLang(l); setShowLang(false); };
  const T = (key: string) => t(lang, key);

  const fetchOrder = useCallback(() => {
    if (!oId) return;
    api.getReceipt(oId).then(setOrder).catch(() => {});
  }, [oId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);
  useEffect(() => { const i = setInterval(fetchOrder, 5000); return () => clearInterval(i); }, [fetchOrder]);

  function downloadReceipt(o: Order) {
    const lines = [
      '═══════════════════════════════',
      '       VIENG RESORT CAFE',
      '═══════════════════════════════',
      '',
      `${T('orderNo')}${o.id}`,
      `${T('table')} ${o.tableNumber}`,
      `${T('dateTime')}: ${new Date(o.createdAt).toLocaleString()}`,
      '',
      '───────────────────────────────',
    ];
    o.items.forEach(it => {
      lines.push(`  ${it.quantity}x ${it.name}`);
      lines.push(`       ${fmt(it.price * it.quantity)}`);
    });
    lines.push('───────────────────────────────');
    lines.push(`  ${T('total')}:  ${fmt(o.totalAmount)}`);
    lines.push('═══════════════════════════════');
    lines.push('');
    lines.push(`  ${T('thankYou')}`);
    lines.push('');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-order-${o.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentStep = order ? STATUS_STEPS.indexOf(order.status as typeof STATUS_STEPS[number]) : 0;

  return (
    <div className="os-page">
      {/* Header */}
      <header className="os-header">
        <img src="/media/logo.png" alt="Logo" className="os-logo" />
        <div className="os-header-info">
          <h1>{T('viengCafe')}</h1>
          <span className="os-table-badge">{T('table')} {table}</span>
        </div>
        <div className="os-header-actions">
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
        </div>
      </header>

      {/* Main content */}
      <div className="os-content">
        {!order ? (
          <div className="os-loading">
            <div className="os-spinner" />
            <p>{T('sending')}</p>
          </div>
        ) : (
          <>
            {/* Success icon */}
            <div className="os-success-icon">
              {order.status === 'paid' ? '🎉' : order.status === 'cancelled' ? '❌' : '✅'}
            </div>

            <h2 className="os-title">
              {order.status === 'paid' ? T('paid') : order.status === 'cancelled' ? T('cancelled') : T('orderReceived')}
            </h2>
            <p className="os-subtitle">{T('orderNumber')} <strong>#{order.id}</strong></p>

            {/* Status tracker */}
            {order.status !== 'cancelled' && (
              <div className="os-tracker">
                {STATUS_STEPS.map((step, idx) => (
                  <div key={step} className={`os-step ${idx <= currentStep ? 'active' : ''} ${idx === currentStep ? 'current' : ''}`}>
                    <div className="os-step-dot">
                      {idx < currentStep ? '✓' : idx === currentStep ? (idx + 1) : (idx + 1)}
                    </div>
                    <span className="os-step-label">{T(step)}</span>
                    {idx < STATUS_STEPS.length - 1 && <div className={`os-step-line ${idx < currentStep ? 'done' : ''}`} />}
                  </div>
                ))}
              </div>
            )}

            {/* Order items */}
            <div className="os-items-card">
              <h3>{T('orderSummary')}</h3>
              {order.items.map((it) => (
                <div key={it.id} className="os-item-row">
                  <span className="os-item-qty">{it.quantity}x</span>
                  <span className="os-item-name">{it.name}</span>
                  <span className="os-item-price">{fmt(it.price * it.quantity)}</span>
                </div>
              ))}
              <div className="os-item-total">
                <span>{T('total')}</span>
                <span>{fmt(order.totalAmount)}</span>
              </div>
            </div>

            {/* Time */}
            <p className="os-time">{T('dateTime')}: {new Date(order.createdAt).toLocaleString()}</p>

            {/* Actions */}
            <div className="os-actions">
              {order.status === 'paid' && (
                <button className="os-btn os-btn-receipt" onClick={() => downloadReceipt(order)}>
                  📄 {T('downloadReceipt')}
                </button>
              )}
              <button className="os-btn os-btn-primary" onClick={() => navigate(`/table/${table}`)}>
                🍽️ {T('orderMore')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
