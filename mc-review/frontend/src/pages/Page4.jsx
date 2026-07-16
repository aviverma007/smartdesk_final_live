import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import api from '../api';
import Modal from '../components/Modal';

export default function Page4() {
  const { isAdmin } = useApp();
  const { push } = useToast();

  const [nfas, setNfas] = useState([]);
  const [maxOrders, setMaxOrders] = useState(10);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const cfg = await api.ordersConfig();
      setMaxOrders(Number(cfg.maxOrdersPerNfa || 10));
      const all = await api.allOrders();
      const byNfa = {};
      all.forEach((o) => {
        byNfa[o.NfaNo] = byNfa[o.NfaNo] || { nfa: o.NfaNo, index: o.IndexName, orders: [] };
        byNfa[o.NfaNo].orders.push(o);
      });
      setNfas(Object.values(byNfa));
    } catch (e) { push(e.response?.data?.error || 'Failed to load orders', 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="pagewrap">
      <div className="surface">
        <div className="toolbar">
          <b>Order Register</b>
          {isAdmin && (
            <>
              <span style={{ marginLeft: 12 }}>Max orders / NFA:</span>
              <input type="number" className="inp" style={{ width: 70 }} value={maxOrders}
                onChange={async (e) => {
                  const v = Number(e.target.value) || 1;
                  setMaxOrders(v);
                  try { await api.setMaxOrders(v); push('Max orders/NFA updated'); } catch (err) { push('Failed to update', 'error'); }
                }} />
            </>
          )}
          <div className="spacer" />
          <NewNfaLookup onAdd={(nfa, index) => setNfas((prev) => (prev.find((n) => n.nfa === nfa) ? prev : [...prev, { nfa, index, orders: [] }]))} />
        </div>

        {loading ? <div className="empty">Loading…</div> : nfas.length === 0 ? (
          <div className="empty">No orders yet. Add an approved NFA above to generate order numbers.</div>
        ) : (
          nfas.map((n) => (
            <NfaOrderBlock key={n.nfa} entry={n} maxOrders={maxOrders} onRefresh={load} onDeleteRequest={setDeleteTarget} />
          ))
        )}
      </div>

      {deleteTarget && (
        <Modal
          title="Delete order number?"
          onClose={() => setDeleteTarget(null)}
          actions={<>
            <button className="btn ghost" onClick={() => setDeleteTarget(null)}>Keep order number</button>
            <button className="btn danger" onClick={async () => {
              try {
                await api.deleteOrder(deleteTarget.Id);
                push(`Order number ${deleteTarget.OrderNo} deleted — retired & audited`, 'warn');
                setDeleteTarget(null);
                load();
              } catch (e) { push(e.response?.data?.error || 'Delete failed', 'error'); }
            }}>Delete order number</button>
          </>}
        >
          <p>
            Order <b>{deleteTarget.OrderNo}</b> ({deleteTarget.NfaNo}{deleteTarget.Vendor ? `, ${deleteTarget.Vendor}` : ''}) will be retired,
            not reused, and the deletion is audit-logged. Any PO/SO already issued in QMS against it must be voided there separately.
          </p>
        </Modal>
      )}
    </div>
  );
}

function NewNfaLookup({ onAdd }) {
  const [nfa, setNfa] = useState('');
  const [index, setIndex] = useState('MEP');
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <input className="inp" placeholder="Approved NFA no." value={nfa} onChange={(e) => setNfa(e.target.value)} />
      <select className="inp" value={index} onChange={(e) => setIndex(e.target.value)}>
        <option value="MEP">MEP &amp; Procurement</option>
        <option value="CIVIL">Civil &amp; Consultancy</option>
      </select>
      <button className="btn" onClick={() => { if (nfa.trim()) { onAdd(nfa.trim(), index); setNfa(''); } }}>Add to register</button>
    </div>
  );
}

function NfaOrderBlock({ entry, maxOrders, onRefresh, onDeleteRequest }) {
  const { push } = useToast();
  const [count, setCount] = useState(1);
  const [orderType, setOrderType] = useState('PO');
  const hasGenerated = entry.orders.length > 0;

  async function generate() {
    try {
      await api.generateOrders({ nfa: entry.nfa, index: entry.index, count, orderType });
      push(`Orders generated — ${entry.nfa} x ${count}`);
      onRefresh();
    } catch (e) { push(e.response?.data?.error || 'Generate failed', 'error'); }
  }

  async function addMore() {
    const label = `Add ${count} more order number(s) against ${entry.nfa}? Existing order rows stay untouched.`;
    if (!window.confirm(label)) return;
    try {
      await api.addMoreOrders({ nfa: entry.nfa, index: entry.index, count, orderType });
      push(`Orders generated — ${entry.nfa} x ${count}`);
      onRefresh();
    } catch (e) { push(e.response?.data?.error || 'Failed', 'error'); }
  }

  async function override(order, newValue) {
    try {
      await api.overrideOrder(order.Id, newValue);
      onRefresh();
    } catch (e) {
      const data = e.response?.data;
      push(data?.error || 'Override failed', 'error');
      onRefresh();
    }
  }

  return (
    <div className="surface" style={{ margin: '0 0 14px 0' }}>
      <div className="toolbar">
        <b className="nfa">{entry.nfa}</b>
        <span className="chip">{entry.index}</span>
        <div className="spacer" />
        <div className="field" style={{ margin: 0 }}>
          <label>No. of orders</label>
          <select className="inp" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {Array.from({ length: maxOrders }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Order type</label>
          <select className="inp" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
            {['PO', 'SO', 'WO', 'LOA'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button className="btn primary" onClick={hasGenerated ? addMore : generate}>
          {hasGenerated ? `Add ${count} more order${count > 1 ? 's' : ''}` : 'Generate order number'}
        </button>
      </div>

      {entry.orders.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Order No.</th><th>Type</th><th>Vendor</th><th>Generated By</th><th>Timestamp</th><th></th></tr></thead>
            <tbody>
              {entry.orders.map((o) => (
                <tr key={o.Id}>
                  <td>
                    <div className="cellinput" contentEditable suppressContentEditableWarning
                      onBlur={(ev) => override(o, ev.target.textContent.trim())}>
                      {o.OrderNo}
                    </div>
                    {o.IsOverride ? <div className="sub">manual override · audited</div> : null}
                  </td>
                  <td>
                    <select className="inp sm" defaultValue={o.OrderType} onChange={async (e) => { await api.setOrderType(o.Id, e.target.value); onRefresh(); }}>
                      {['PO', 'SO', 'WO', 'LOA'].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>
                    <div className="cellinput" contentEditable suppressContentEditableWarning
                      onBlur={async (ev) => { await api.setVendor(o.Id, ev.target.textContent); onRefresh(); }}>
                      {o.Vendor}
                    </div>
                  </td>
                  <td>{o.GeneratedBy}</td>
                  <td>{new Date(o.GeneratedAt).toLocaleString()}</td>
                  <td><button className="ordel" onClick={() => onDeleteRequest(o)}>x</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
