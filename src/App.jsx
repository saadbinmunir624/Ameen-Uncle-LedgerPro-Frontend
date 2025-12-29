import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = 'https://ameen-uncle-ledgerpro-backend.onrender.com';

function App() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('ledger_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [accounts, setAccounts] = useState([]);
  const [lockedAccounts, setLockedAccounts] = useState(() => {
    const saved = localStorage.getItem('ledger_locked_accounts');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [accountNameInput, setAccountNameInput] = useState('');
  const [txForm, setTxForm] = useState({
    dateOfEntry: '',
    dueOn: '',
    reference: '',
    description: '',
    debit: '',
    credit: '',
    remarks: ''
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    localStorage.setItem('ledger_auth', JSON.stringify(auth));
  }, [auth]);

  useEffect(() => {
    localStorage.setItem('ledger_locked_accounts', JSON.stringify(lockedAccounts));
  }, [lockedAccounts]);

  useEffect(() => {
    if (auth) {
      loadAccounts();
    }
  }, [auth]);

  useEffect(() => {
    if (selectedAccountId) {
      loadTransactions(selectedAccountId);
    } else {
      setTransactions([]);
    }
  }, [selectedAccountId]);

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const aLocked = lockedAccounts[a._id];
      const bLocked = lockedAccounts[b._id];
      if (aLocked !== bLocked) return aLocked ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [accounts, lockedAccounts]);

  const getFirstUnlockedId = (list, locks = lockedAccounts) => {
    const found = list.find((a) => !locks[a._id]);
    return found?._id || null;
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/accounts`);
      if (!res.ok) throw new Error('Failed to load accounts');
      const data = await res.json();
      setAccounts(data);
      const stillExists = data.find((a) => a._id === selectedAccountId);
      if (selectedAccountId && (!stillExists || lockedAccounts[selectedAccountId])) {
        setSelectedAccountId(null);
      }
    } catch (err) {
      setError(err.message || 'Unable to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadTransactions = async (accountId) => {
    setLoadingTx(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/transactions/${accountId}`);
      if (!res.ok) throw new Error('Failed to load transactions');
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      setError(err.message || 'Unable to load transactions');
    } finally {
      setLoadingTx(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setLoginError('Please enter both username and password');
      return;
    }
    
    // Hardcoded credentials
    if (loginForm.username === 'ameen' && loginForm.password === 'ameen@123') {
      setAuth({ username: loginForm.username });
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    setAuth(null);
    setSelectedAccountId(null);
    setLoginForm({ username: '', password: '' });
  };

  const toggleLock = (accountId) => {
    setLockedAccounts((prev) => {
      const next = { ...prev, [accountId]: !prev[accountId] };
      if (!next[accountId]) {
        delete next[accountId];
      }
      const firstAvailable = getFirstUnlockedId(accounts, next);
      if (selectedAccountId === accountId && firstAvailable && accountId !== firstAvailable) {
        setSelectedAccountId(firstAvailable);
      }
      return next;
    });
  };

  const createAccount = async (e) => {
    e.preventDefault();
    if (!accountNameInput.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountNameInput.trim() })
      });
      if (!res.ok) throw new Error('Failed to create account');
      const newAccount = await res.json();
      setAccounts((prev) => [...prev, newAccount]);
      setAccountNameInput('');
      setShowAccountModal(false);
      setSelectedAccountId(newAccount._id);
    } catch (err) {
      setError(err.message || 'Unable to create account');
    }
  };

  const addTransaction = async (e) => {
    e.preventDefault();
    if (!selectedAccountId) return;
    try {
      const res = await fetch(`${API_BASE}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          dateOfEntry: txForm.dateOfEntry,
          dueOn: txForm.dueOn || null,
          reference: txForm.reference,
          description: txForm.description,
          debit: txForm.debit ? Number(txForm.debit) : 0,
          credit: txForm.credit ? Number(txForm.credit) : 0,
          remarks: txForm.remarks
        })
      });
      if (!res.ok) throw new Error('Failed to add transaction');
      await res.json();
      setShowTxModal(false);
      setTxForm({ dateOfEntry: '', dueOn: '', reference: '', description: '', debit: '', credit: '', remarks: '' });
      loadTransactions(selectedAccountId);
    } catch (err) {
      setError(err.message || 'Unable to add transaction');
    }
  };

  const selectedAccount = accounts.find((a) => a._id === selectedAccountId) || null;
  const cannotTransact = !selectedAccountId || lockedAccounts[selectedAccountId];

  const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
  const currentBalance = selectedAccount && transactions.length > 0 
    ? transactions[transactions.length - 1].balance 
    : 0;

  if (!auth) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-large">Ledger Pro</div>
            <p className="login-subtitle">Financial Ledger Management</p>
          </div>
          {loginError && <div className="alert alert-error">{loginError}</div>}
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={loginForm.username}
                onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-large">Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="navbar">
        <div className="navbar-left">
          <div className="logo">Ledger Pro</div>
        </div>
        <div className="navbar-right">
          <span className="user-name">Hi, {auth.username}</span>
          <AccountDropdown
            accounts={sortedAccounts}
            lockedAccounts={lockedAccounts}
            selectedId={selectedAccountId}
            onSelect={(id) => setSelectedAccountId(id)}
            onToggleLock={toggleLock}
          />
          <button className="btn btn-ghost" onClick={() => setShowAccountModal(true)}>+ New Account</button>
          <button className="btn btn-ghost" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="main-content">
        {error && <div className="alert alert-error">{error}</div>}

        {selectedAccount ? (
          <>
            <div className="page-header">
              <div>
                <h1>{selectedAccount.name}</h1>
                <p className="subtitle">Account Overview</p>
              </div>
              <button className="btn btn-primary" disabled={cannotTransact} onClick={() => setShowTxModal(true)}>
                + New Transaction
              </button>
            </div>

            <div className="table-section">
              <div className="section-header">
                <h2>Recent Transactions</h2>
                <span className="record-count">{loadingTx ? 'Loading...' : `${transactions.length} records`}</span>
              </div>
              <div className="table-wrapper">
                <table className="transactions-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Due On</th>
                      <th>Remarks</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan="8" className="empty-state">No transactions yet. Add one to get started.</td>
                      </tr>
                    )}
                    {transactions.map((t) => (
                      <tr key={t._id} className="transaction-row">
                        <td className="date-cell">{formatDate(t.dateOfEntry)}</td>
                        <td>{t.reference || '—'}</td>
                        <td>{t.description || '—'}</td>
                        <td className="num debit">{formatMoney(t.debit)}</td>
                        <td className="num credit">{formatMoney(t.credit)}</td>
                        <td>{t.dueOn ? formatDate(t.dueOn) : '—'}</td>
                        <td className="remarks">{t.remarks || '—'}</td>
                        <td className="num balance">{formatMoney(t.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-dashboard">
            <p className="empty-icon">📭</p>
            <h2>No Account Selected</h2>
            <p>Create a new account or select one from the dropdown to get started.</p>
            <button className="btn btn-primary" onClick={() => setShowAccountModal(true)}>+ Create Account</button>
          </div>
        )}
      </main>

      {showAccountModal && (
        <Modal title="New Account" onClose={() => setShowAccountModal(false)}>
          <form className="form" onSubmit={createAccount}>
            <div className="form-group">
              <label>Account name</label>
              <input
                type="text"
                value={accountNameInput}
                onChange={(e) => setAccountNameInput(e.target.value)}
                placeholder="e.g. Travel Fund, Business Account"
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAccountModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Account</button>
            </div>
          </form>
        </Modal>
      )}

      {showTxModal && selectedAccount && (
        <Modal title="New Transaction" onClose={() => setShowTxModal(false)}>
          <form className="form form-grid" onSubmit={addTransaction}>
            <div className="form-group">
              <label>Date of entry *</label>
              <input
                type="date"
                value={txForm.dateOfEntry}
                onChange={(e) => setTxForm((p) => ({ ...p, dateOfEntry: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Due on</label>
              <input
                type="date"
                value={txForm.dueOn}
                onChange={(e) => setTxForm((p) => ({ ...p, dueOn: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Reference</label>
              <input
                type="text"
                value={txForm.reference}
                onChange={(e) => setTxForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="INV-001"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={txForm.description}
                onChange={(e) => setTxForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Transaction details"
              />
            </div>
            <div className="form-group">
              <label>Debit</label>
              <input
                type="number"
                step="0.01"
                value={txForm.debit}
                onChange={(e) => setTxForm((p) => ({ ...p, debit: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Credit</label>
              <input
                type="number"
                step="0.01"
                value={txForm.credit}
                onChange={(e) => setTxForm((p) => ({ ...p, credit: e.target.value }))}
              />
            </div>
            <div className="form-group form-full">
              <label>Remarks</label>
              <textarea
                rows="3"
                value={txForm.remarks}
                onChange={(e) => setTxForm((p) => ({ ...p, remarks: e.target.value }))}
                placeholder="Additional notes..."
              />
            </div>
            <div className="modal-actions form-full">
              <button type="button" className="btn btn-ghost" onClick={() => setShowTxModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add Transaction</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, color }) {
  return (
    <div className={`metric-card metric-${color}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <p className="metric-label">{title}</p>
        <p className="metric-value">{value}</p>
      </div>
    </div>
  );
}

function AccountDropdown({ accounts, lockedAccounts, selectedId, onSelect, onToggleLock }) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a._id === selectedId);
  
  return (
    <div className="dropdown-wrapper">
      <button className="btn btn-ghost dropdown-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{selected?.name || 'Select Account'}</span>
        <span className="dropdown-arrow">▾</span>
      </button>
      {open && (
        <div className="dropdown-menu">
          {accounts.length === 0 && (
            <div className="dropdown-empty">No accounts yet</div>
          )}
          {accounts.map((acc) => {
            const locked = !!lockedAccounts[acc._id];
            return (
              <div key={acc._id} className={`dropdown-item ${locked ? 'locked' : ''}`}>
                <button
                  className="lock-toggle"
                  title={locked ? 'Unlock account' : 'Lock account'}
                  onClick={() => onToggleLock(acc._id)}
                >
                  {locked ? '🔒' : ''}
                </button>
                <button
                  className="account-select"
                  onClick={() => {
                    if (!locked) {
                      onSelect(acc._id);
                      setOpen(false);
                    }
                  }}
                  disabled={locked}
                >
                  {acc.name}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMoney(value) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default App;
