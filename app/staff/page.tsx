'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import ClientPortal from '@/app/components/ClientPortal';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Crown, 
  Shield, 
  Zap, 
  Phone, 
  Mail, 
  Lock, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle,
  X,
  KeyRound,
  RefreshCw,
  SlidersHorizontal,
  UserCheck
} from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: 'OWNER' | 'MANAGER' | 'COUNTER_STAFF';
  isActive: boolean;
  createdAt: string;
}

export default function StaffManagementPage() {
  const { user: currentUser } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPinModalOpen, setIsResetPinModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);

  // Form states
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New staff form
  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    role: 'COUNTER_STAFF' as 'OWNER' | 'MANAGER' | 'COUNTER_STAFF',
  });

  // Edit staff form
  const [editStaff, setEditStaff] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'COUNTER_STAFF' as 'OWNER' | 'MANAGER' | 'COUNTER_STAFF',
    isActive: true,
  });

  // Reset PIN form
  const [newPin, setNewPin] = useState('');

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/staff');
      if (res.ok) {
        const data = await res.json();
        if (data.staff && data.staff.length > 0) {
          setStaff(data.staff);
        } else {
          // Default initial team members if empty
          setStaff([
            { id: 'u1', name: 'Rajesh Sharma', phone: '9822012345', email: 'rajesh@royalautospares.com', role: 'OWNER', isActive: true, createdAt: new Date().toISOString() },
            { id: 'u2', name: 'Amit Verma', phone: '9822054321', email: 'amit@royalautospares.com', role: 'MANAGER', isActive: true, createdAt: new Date().toISOString() },
            { id: 'u3', name: 'Suresh Patil', phone: '9822098765', email: 'suresh@royalautospares.com', role: 'COUNTER_STAFF', isActive: true, createdAt: new Date().toISOString() },
          ]);
        }
      }
    } catch (err) {
      console.error('Error fetching staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Open Edit Modal
  const openEditModal = (member: StaffMember) => {
    setSelectedMember(member);
    setEditStaff({
      name: member.name,
      phone: member.phone,
      email: member.email || '',
      role: member.role,
      isActive: member.isActive,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Open Reset PIN Modal
  const openResetPinModal = (member: StaffMember) => {
    setSelectedMember(member);
    setNewPin('');
    setFormError(null);
    setIsResetPinModalOpen(true);
  };

  // Handle Add Staff
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newStaff.name || !newStaff.phone || !newStaff.password) {
      setFormError('Name, phone number, and security password/PIN are required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/v1/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to appoint staff member');
        return;
      }

      setIsAddModalOpen(false);
      setNewStaff({
        name: '',
        phone: '',
        email: '',
        password: '',
        role: 'COUNTER_STAFF',
      });
      showToast('New team member appointed successfully!');
      fetchStaff();
    } catch (err: any) {
      setFormError(err.message || 'Error creating staff');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Staff
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setFormError(null);

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/staff/${selectedMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editStaff),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to update member');
        return;
      }

      setIsEditModalOpen(false);
      showToast(`Profile & permissions updated for ${editStaff.name}`);
      fetchStaff();
    } catch (err: any) {
      setFormError(err.message || 'Error updating staff');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Reset PIN
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !newPin) return;
    setFormError(null);

    try {
      setSubmitting(true);
      const res = await fetch(`/api/v1/staff/${selectedMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPin }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to update password');
        return;
      }

      setIsResetPinModalOpen(false);
      showToast(`Security login PIN reset for ${selectedMember.name}`);
    } catch (err: any) {
      setFormError(err.message || 'Error updating PIN');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Toggle Active
  const handleToggleActive = async (member: StaffMember) => {
    try {
      await fetch(`/api/v1/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      showToast(`${member.name} is now ${!member.isActive ? 'Active' : 'Inactive'}`);
      fetchStaff();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Delete Member
  const handleDeleteMember = async (member: StaffMember) => {
    if (member.role === 'OWNER') {
      alert('Primary Owner account cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to remove ${member.name} from the dealership roster?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/staff/${member.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`${member.name} removed from dealership team`);
        fetchStaff();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#DC2626]" />
            <span>Staff & Manager Role Permissions</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Appoint counter staff, shop managers, modify role privileges, and manage security login PINs.
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Appoint Staff / Manager</span>
        </button>
      </div>

      {/* Toast Notification */}
      {successToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {staff.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
            {loading ? 'Loading staff roster from database...' : 'No staff members found.'}
          </div>
        ) : (
          staff.map((member) => (
            <div
              key={member.id}
              className={`bg-white border rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-2xs transition ${
                member.isActive ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 opacity-60 bg-slate-50/50'
              }`}
            >
              <div>
                {/* Role Badge & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {member.role === 'OWNER' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        <Crown className="w-3 h-3 text-blue-600" />
                        OWNER / PROPRIETOR
                      </span>
                    )}
                    {member.role === 'MANAGER' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                        <Shield className="w-3 h-3 text-indigo-600" />
                        SHOP MANAGER
                      </span>
                    )}
                    {member.role === 'COUNTER_STAFF' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-600" />
                        COUNTER BILLING STAFF
                      </span>
                    )}
                  </div>

                  <span className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded ${
                    member.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {member.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                {/* Member Info */}
                <div className="font-black text-base text-slate-900 mt-3">{member.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1.5 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{member.phone}</span>
                </div>
                {member.email && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{member.email}</span>
                  </div>
                )}
              </div>

              {/* Responsibilities summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 text-[11px]">Assigned Privileges:</div>
                {member.role === 'OWNER' && (
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Full financial access, profit margins, staff management, and credit overrides.
                  </p>
                )}
                {member.role === 'MANAGER' && (
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Store operations, inventory auditing, day-end cash closing, and staff supervision.
                  </p>
                )}
                {member.role === 'COUNTER_STAFF' && (
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Fast POS billing (F2), parts lookup, customer balance inquiry, and counter collections.
                  </p>
                )}
              </div>

              {/* Action Buttons (Edit, Reset PIN, Delete) */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <button
                  onClick={() => openEditModal(member)}
                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-[11px] flex items-center justify-center gap-1 transition"
                  title="Modify name, role, and details"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => openResetPinModal(member)}
                  className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] flex items-center justify-center gap-1 transition"
                  title="Reset login PIN / password"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span>PIN</span>
                </button>

                {member.role !== 'OWNER' && (
                  <button
                    onClick={() => handleDeleteMember(member)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Remove member"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ----------------- 1. ADD STAFF MODAL ----------------- */}
      {isAddModalOpen && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#DC2626]" />
                <span>Appoint New Staff or Manager</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  placeholder="e.g. Amit Verma"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-900 focus:bg-slate-50 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Phone / Login ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    placeholder="9822054321"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900 focus:bg-slate-50 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    placeholder="amit@honda.com"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:bg-slate-50 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Store Role & Permissions <span className="text-red-500">*</span>
                </label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900"
                >
                  <option value="COUNTER_STAFF">⚡ Counter Billing Staff (Fast POS & Customer Khata)</option>
                  <option value="MANAGER">🛡️ Shop Manager (Supervision, Audits, Day-End Closing)</option>
                  <option value="OWNER">👑 Co-Owner / Partner (Full Financials & Settings)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Login Password / PIN <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  placeholder="Enter 4-digit PIN or password"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900 focus:bg-slate-50 focus:border-blue-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Appointing...' : 'Appoint Team Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ClientPortal>
      )}

      {/* ----------------- 2. EDIT STAFF MODAL ----------------- */}
      {isEditModalOpen && selectedMember && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>Edit Staff Member & Role</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editStaff.name}
                  onChange={(e) => setEditStaff({ ...editStaff, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phone / Login ID</label>
                  <input
                    type="tel"
                    required
                    value={editStaff.phone}
                    onChange={(e) => setEditStaff({ ...editStaff, phone: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email</label>
                  <input
                    type="email"
                    value={editStaff.email}
                    onChange={(e) => setEditStaff({ ...editStaff, email: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Role & Permissions</label>
                <select
                  value={editStaff.role}
                  onChange={(e) => setEditStaff({ ...editStaff, role: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900"
                >
                  <option value="COUNTER_STAFF">⚡ Counter Billing Staff (Fast POS & Khata)</option>
                  <option value="MANAGER">🛡️ Shop Manager (Supervision & Auditing)</option>
                  <option value="OWNER">👑 Owner / Proprietor (Full Access)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={editStaff.isActive}
                  onChange={(e) => setEditStaff({ ...editStaff, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActiveToggle" className="text-slate-800 font-semibold cursor-pointer">
                  Account Active & Enabled for Login
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ClientPortal>
      )}

      {/* ----------------- 3. RESET PIN MODAL ----------------- */}
      {isResetPinModalOpen && selectedMember && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Reset Login PIN</span>
              </h3>
              <button
                onClick={() => setIsResetPinModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Set a new login password or 4-digit PIN for <strong className="text-slate-900">{selectedMember.name}</strong>.
            </div>

            <form onSubmit={handleSavePin} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  New PIN / Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Enter new 4-digit PIN or password"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono font-bold text-slate-900 focus:bg-slate-50 focus:border-blue-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetPinModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ClientPortal>
      )}

    </div>
  );
}
