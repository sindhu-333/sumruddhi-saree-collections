import React, { useEffect, useState } from 'react';
import './AdminReturnsPage.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : '/api';

function getAuthToken() {
  const raw = window.localStorage.getItem('saree-auth-token');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : raw;
  } catch {
    return raw;
  }
}

export default function AdminReturnsPage() {
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null); // 'approve' | 'reject'
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [refundInput, setRefundInput] = useState('');

  useEffect(() => {
    fetchReturns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchReturns() {
    setLoading(true);
    setError('');
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/returns`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('unauthorized');
        }
        throw new Error('Failed to load returns');
      }
      const data = await res.json();
      setReturnsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      if (err.message === 'unauthorized') {
        setError('Unauthorized: please sign in as an admin to view return requests.');
      } else {
        setError(err.message || 'Error');
      }
    } finally {
      setLoading(false);
    }
  }

  function openActionModal(action, r) {
    if ((r.status || 'pending') !== 'pending') {
      setError(`This request is already ${r.status}.`);
      return;
    }
    setModalAction(action);
    setSelectedReturn(r);
    setAdminNoteInput(r.admin_note || '');
    setRefundInput('');
    setShowModal(true);
  }

  async function confirmAction() {
    if (!selectedReturn) return;
    const token = getAuthToken();
    const id = selectedReturn.id;
    try {
      const url = `${API_BASE}/returns/${id}/${modalAction === 'approve' ? 'approve' : 'reject'}`;
      const body = { admin_note: adminNoteInput || undefined };
      if (modalAction === 'approve') body.refund_details = refundInput || undefined;

      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Action failed');
      setShowModal(false);
      setSelectedReturn(null);
      await fetchReturns();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Action error');
    }
  }

  const backendOrigin = API_BASE.replace(/\/api$/, '');

  // local filtering + pagination
  const filtered = returnsList.filter((r) => {
    if (statusFilter !== 'all' && String(r.status) !== String(statusFilter)) return false;
    if (!query) return true;
    const q = query.trim().toLowerCase();
    return [r.customer_name, r.order_number, r.product_code, r.email, r.whatsapp].join(' ').toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <main className="admin-returns-page">
      <div className="admin-returns-hero">
        <h1>Return / Exchange Requests</h1>
        <p>Review incoming requests and approve or reject them. Actions will notify the customer by email.</p>
      </div>
      <div className="returns-controls">
        <input placeholder="Search by name, order, product, email" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <label className="page-size-label">Per page:
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>
      </div>

      {loading ? <p>Loading...</p> : null}
      {error ? (
        <div>
          <p className="error">{error}</p>
          {error.toLowerCase().includes('unauthor') ? (
            <div style={{ marginTop: 8 }}>
              <button className="primary-btn" onClick={() => { window.location.hash = '#/'; window.location.reload(); }}>Go to login</button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="returns-list">
        {pageItems.length === 0 && !loading ? <p>No return requests found.</p> : null}
        {pageItems.map((r) => {
          const status = String(r.status || 'pending').toLowerCase();
          const isFinalized = status !== 'pending';

          return (
            <article key={r.id} className="return-card">
              <header>
                <div className="return-meta">
                  <strong>#{r.id}</strong>
                  <span>{r.customer_name || r.customerName || 'N/A'}</span>
                  <span className="muted">{new Date(r.created_at).toLocaleString()}</span>
                  <span className={`status-pill ${status}`}>{status}</span>
                </div>
                <div className="return-actions">
                  <button
                    type="button"
                    className={`approve${isFinalized ? ' disabled' : ''}`}
                    disabled={isFinalized}
                    aria-disabled={isFinalized}
                    onClick={() => openActionModal('approve', r)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={`reject${isFinalized ? ' disabled' : ''}`}
                    disabled={isFinalized}
                    aria-disabled={isFinalized}
                    onClick={() => openActionModal('reject', r)}
                  >
                    Reject
                  </button>
                </div>
              </header>

            <div className="return-body">
              <p><strong>Order:</strong> {r.order_number || r.orderNumber || 'N/A'}</p>
              <p><strong>Product:</strong> {r.product_code || r.productCode || 'N/A'}</p>
              <p><strong>Issue:</strong> {r.issue_type || r.issueType || 'N/A'}</p>
              <p><strong>Description:</strong> {r.description || r.problemDescription || ''}</p>
              {(r.status || 'pending') !== 'pending' ? (
                <p className="decision-note">
                  Final decision made: {r.status}. You can no longer change this request.
                </p>
              ) : null}

              <div className="file-list">
                {(r.video_files || []).length ? (
                  <div>
                    <strong>Videos:</strong>
                    <ul>
                      {(r.video_files || []).map((f) => (
                        <li key={f.filename}><a href={`${backendOrigin}${f.path}`} target="_blank" rel="noreferrer">{f.filename}</a></li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {(r.photo_files || []).length ? (
                  <div>
                    <strong>Photos:</strong>
                    <ul>
                      {(r.photo_files || []).map((f) => (
                        <li key={f.filename}><a href={`${backendOrigin}${f.path}`} target="_blank" rel="noreferrer">{f.filename}</a></li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </article>
          );
        })}
      </div>

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span>Page {page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
      </div>

      {showModal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>{modalAction === 'approve' ? 'Approve Return' : 'Reject Return'}</h3>
            <p>Request #{selectedReturn?.id} — {selectedReturn?.customer_name}</p>
            <label>
              Admin note
              <textarea value={adminNoteInput} onChange={(e) => setAdminNoteInput(e.target.value)} />
            </label>
            {modalAction === 'approve' ? (
              <label>
                Refund / Delivery details
                <input value={refundInput} onChange={(e) => setRefundInput(e.target.value)} />
              </label>
            ) : null}
            <div className="modal-actions">
              <button className="ghost-btn" onClick={() => { setShowModal(false); setSelectedReturn(null); }}>Cancel</button>
              <button className="primary-btn" onClick={confirmAction}>{modalAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
