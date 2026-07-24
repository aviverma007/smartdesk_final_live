import client, { API_BASE } from './client';

export const api = {
  // Reference & users
  reference: () => client.get('/reference').then((r) => r.data),
  allNfas: (limit, offset) => client.get('/qms/all-nfas', { params: { limit, offset } }).then((r) => r.data),
  users: () => client.get('/users').then((r) => r.data),
  me: () => client.get('/users/me').then((r) => r.data),
  audit: () => client.get('/audit').then((r) => r.data),
  searchNfa: (nfa) => client.get(`/search/${encodeURIComponent(nfa)}`).then((r) => r.data),

  // Page 1 — entries
  listEntries: (dateView) => client.get('/entries', { params: { dateView } }).then((r) => r.data),
  fetchNfa: (payload) => client.post('/entries/fetch', payload),
  createModeB: (payload) => client.post('/entries/mode-b', payload).then((r) => r.data),
  selectEntry: (id, selected) => client.post(`/entries/${id}/select`, { selected }),
  submitEntry: (id, comment) => client.post(`/entries/${id}/submit`, { comment }),
  updateField: (id, payload) => client.post(`/entries/${id}/field`, payload),
  updatePlainField: (id, field, value) => client.post(`/entries/${id}/plain-field`, { field, value }),
  setResubComment: (id, comment) => client.post(`/entries/${id}/resub-comment`, { comment }),
  removeFile: (id, index) => client.post(`/entries/${id}/files/remove`, { index }),
  uploadFilesToEntry: (id, fileList) => {
    const form = new FormData();
    Array.from(fileList).forEach((f) => form.append('files', f));
    return client.post(`/entries/${id}/files/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  stageFiles: (fileList) => {
    const form = new FormData();
    Array.from(fileList).forEach((f) => form.append('files', f));
    return client.post('/entries/stage-files', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getStagedFiles: () => client.get('/entries/stage-files').then((r) => r.data),
  clearStagedFiles: () => client.delete('/entries/stage-files'),

  // Page 2 — sheets
  getSheet: (index, date) => client.get(`/sheets/${index}/${date}`).then((r) => r.data),
  setPresentToMc: (index, date, id, mc) => client.post(`/sheets/${index}/${date}/entries/${id}/mc`, { mc }),
  touchCell: (index, date, id, field, value) => client.post(`/sheets/${index}/${date}/entries/${id}/touch`, { field, value }),
  lockSheet: (index, date) => client.post(`/sheets/${index}/${date}/lock`),
  migrateSheet: (index, date, toDate) => client.post(`/sheets/${index}/${date}/migrate`, { toDate }),

  // Page 3 — meeting
  getMeeting: (index, date) => client.get(`/meeting/${index}/${date}`).then((r) => r.data),
  setDecision: (index, date, rowId, decision) => client.post(`/meeting/${index}/${date}/rows/${rowId}/decision`, { decision }),
  setMcComment: (index, date, rowId, comment) => client.post(`/meeting/${index}/${date}/rows/${rowId}/comment`, { comment }),
  publish: (index, date, confirmed) => client.post(`/meeting/${index}/${date}/publish`, { confirmed }),

  // Page 4 — orders
  ordersForNfa: (nfa) => client.get(`/orders/nfa/${encodeURIComponent(nfa)}`).then((r) => r.data),
  allOrders: () => client.get('/orders').then((r) => r.data),
  approvedNfas: () => client.get('/orders/approved-nfas').then((r) => r.data),
  generateOrders: (payload) => client.post('/orders/generate', payload).then((r) => r.data),
  addMoreOrders: (payload) => client.post('/orders/add-more', payload).then((r) => r.data),
  overrideOrder: (id, newValue) => client.post(`/orders/${id}/override`, { newValue }),
  setVendor: (id, vendor) => client.post(`/orders/${id}/vendor`, { vendor }),
  setOrderType: (id, orderType) => client.post(`/orders/${id}/type`, { orderType }),
  deleteOrder: (id, reason) => client.delete(`/orders/${id}`, { data: { reason } }),
  ordersConfig: () => client.get('/orders/config').then((r) => r.data),
  setMaxOrders: (value) => client.post('/orders/config/max-orders', { value }),

  // PDFs
  publishedPdfs: () => client.get('/pdf').then((r) => r.data),
  pdfUrl: (index, date) => `${API_BASE}/pdf/${index}/${date}`,
};

export default api;
