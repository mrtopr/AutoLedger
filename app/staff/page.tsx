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

  const ownersCount = staff.filter(s => s.role === 'OWNER').length;
  const managersCount = staff.filter(s => s.role === 'MANAGER').length;
  const counterStaffCount = staff.filter(s => s.role === 'COUNTER_STAFF').length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 sm:px-4 sm:py-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#FEF2F2] text-[#C81E1E] flex items-center justify-center font-bold border border-[#FEE2E2] shrink-0 shadow-2xs">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#0F172A]">
                Staff Roster & Access Controls
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                {staff.length} Personnel
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Appoint counter billing operators, store managers, modify role privileges, and rotate security PINs.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          className="h-8 px-3.5 bg-[#C81E1E] hover:bg-[#A81818] text-white text-xs font-semibold rounded-md transition inline-flex items-center gap-1.5 shadow-2xs self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Appoint Staff Member</span>
        </button>
      </div>

      {/* Toast Notification */}
      {successToast && (
        <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-md flex items-center gap-2 text-[#15803D] text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* 3-Stat Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-lg shadow-2xs">
          <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block">Total Active Personnel</span>
          <div className="text-lg font-bold font-mono text-[#0F172A] mt-1 tabular-nums">
            {staff.filter(s => s.isActive).length} / {staff.length}
          </div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">Active operators with login access</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-lg shadow-2xs">
          <span className="text-[11px] font-medium text-[#2563EB] uppercase tracking-wider block">Owners & Managers</span>
          <div className="text-lg font-bold font-mono text-[#2563EB] mt-1 tabular-nums">
            {ownersCount + managersCount}
          </div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">{ownersCount} Owners • {managersCount} Managers</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-3.5 rounded-lg shadow-2xs">
          <span className="text-[11px] font-medium text-[#16A34A] uppercase tracking-wider block">Counter Billing Operators</span>
          <div className="text-lg font-bold font-mono text-[#16A34A] mt-1 tabular-nums">
            {counterStaffCount}
          </div>
          <span className="text-[11px] text-[#64748B] block mt-0.5">POS terminal operators</span>
        </div>
      </div>

      {/* High-Density Staff Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E2E8F0] text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                <th className="py-3 px-4">Personnel Name</th>
                <th className="py-3 px-4">Contact & Login ID</th>
                <th className="py-3 px-4">Role & Privilege Tier</th>
                <th className="py-3 px-4">Permissions Scope</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#64748B] font-mono">
                    Loading staff directory from database...
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#94A3B8]">
                    No staff members registered. Click "Appoint Staff Member" to add one.
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className="hover:bg-[#F8F9FA] transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0F172A]">{member.name}</div>
                      {member.email && (
                        <div className="text-[11px] text-[#64748B]">{member.email}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-[#475569]">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-[#94A3B8]" />
                        <span>{member.phone}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {member.role === 'OWNER' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] inline-flex items-center gap-1">
                          <Crown className="w-3 h-3" />
                          OWNER
                        </span>
                      )}
                      {member.role === 'MANAGER' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE] inline-flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          SHOP MANAGER
                        </span>
                      )}
                      {member.role === 'COUNTER_STAFF' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] inline-flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          COUNTER BILLING
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-[11px] text-[#64748B]">
                      {member.role === 'OWNER' && 'Full financial reports, gross margin analytics, tax settings, staff management'}
                      {member.role === 'MANAGER' && 'Stock audits, inward stock additions, day-end drawer reconciliation, staff oversight'}
                      {member.role === 'COUNTER_STAFF' && 'Fast POS counter invoicing (F2), parts lookup, customer balance & receipts'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border transition ${
                          member.isActive 
                            ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0] hover:bg-[#DCFCE7]' 
                            : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] hover:bg-[#FEE2E2]'
                        }`}
                        title="Click to toggle active status"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${member.isActive ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
                        {member.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(member)}
                          className="h-7 px-2.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1] rounded-lg text-[11px] font-medium transition inline-flex items-center gap-1 shadow-2xs"
                          title="Modify details"
                        >
                          <Edit3 className="w-3 h-3 text-[#2563EB]" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => openResetPinModal(member)}
                          className="h-7 px-2.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#334155] border border-[#CBD5E1] rounded-lg text-[11px] font-medium transition inline-flex items-center gap-1 shadow-2xs"
                          title="Reset PIN"
                        >
                          <KeyRound className="w-3 h-3 text-[#D97706]" />
                          <span>PIN</span>
                        </button>

                        {member.role !== 'OWNER' && (
                          <button
                            onClick={() => handleDeleteMember(member)}
                            className="h-7 px-2 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg border border-transparent hover:border-[#FECACA] transition"
                            title="Remove staff member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------- 1. ADD STAFF MODAL ----------------- */}
      {isAddModalOpen && (
        <ClientPortal>
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#C81E1E]" />
                  <span>Appoint New Staff Member</span>
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-md text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-xs text-[#B91C1C] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleAddStaff} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[#475569] font-medium mb-1">
                    Full Name <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    placeholder="e.g. Amit Verma"
                    className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-md text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#475569] font-medium mb-1">
                      Phone / Login ID <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                      placeholder="9822054321"
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-md text-xs font-mono text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[#475569] font-medium mb-1">
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                      placeholder="amit@honda.com"
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-md text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#475569] font-medium mb-1">
                    Store Role & Permissions <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as any })}
                    className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-md text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] transition"
                  >
                    <option value="COUNTER_STAFF">Counter Billing Staff (Fast POS & Customer Khata)</option>
                    <option value="MANAGER">Shop Manager (Supervision, Audits, Day-End Closing)</option>
                    <option value="OWNER">Co-Owner / Partner (Full Financials & Settings)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#475569] font-medium mb-1">
                    Login Password / PIN <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    placeholder="Enter 4-digit PIN or password"
                    className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-md text-xs font-mono text-[#0F172A] focus:bg-white focus:border-[#C81E1E] focus:outline-hidden focus:ring-1 focus:ring-[#C81E1E] transition"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 h-8.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#475569] font-medium rounded-md border border-[#CBD5E1] text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-8.5 bg-[#C81E1E] hover:bg-[#A81818] text-white font-semibold rounded-md text-xs shadow-xs transition disabled:opacity-50"
                  >
                    {submitting ? 'Appointing...' : 'Appoint Personnel'}
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
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#2563EB]" />
                  <span>Edit Staff Member & Role</span>
                </h3>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1 rounded-md text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-xs text-[#B91C1C]">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[#475569] font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editStaff.name}
                    onChange={(e) => setEditStaff({ ...editStaff, name: e.target.value })}
                    className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-md text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#475569] font-medium mb-1">Phone / Login ID</label>
                    <input
                      type="tel"
                      required
                      value={editStaff.phone}
                      onChange={(e) => setEditStaff({ ...editStaff, phone: e.target.value })}
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-md text-xs font-mono text-[#0F172A] focus:bg-white focus:border-[#C81E1E] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[#475569] font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={editStaff.email}
                      onChange={(e) => setEditStaff({ ...editStaff, email: e.target.value })}
                      className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-md text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#475569] font-medium mb-1">Role & Permissions</label>
                  <select
                    value={editStaff.role}
                    onChange={(e) => setEditStaff({ ...editStaff, role: e.target.value as any })}
                    className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-md text-xs text-[#0F172A] focus:bg-white focus:border-[#C81E1E] transition"
                  >
                    <option value="COUNTER_STAFF">Counter Billing Staff (Fast POS & Khata)</option>
                    <option value="MANAGER">Shop Manager (Supervision & Auditing)</option>
                    <option value="OWNER">Owner / Proprietor (Full Access)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveToggle"
                    checked={editStaff.isActive}
                    onChange={(e) => setEditStaff({ ...editStaff, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-[#C81E1E] focus:ring-[#C81E1E]"
                  />
                  <label htmlFor="isActiveToggle" className="text-[#334155] font-medium cursor-pointer text-xs">
                    Account Active & Enabled for Terminal Login
                  </label>
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 h-8.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#475569] font-medium rounded-md border border-[#CBD5E1] text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-8.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-md text-xs shadow-xs transition disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
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
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] rounded-lg max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#D97706]" />
                  <span>Reset Login PIN / Password</span>
                </h3>
                <button
                  onClick={() => setIsResetPinModalOpen(false)}
                  className="p-1 rounded-md text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-[#64748B]">
                Set a new login password or 4-digit PIN for <strong className="text-[#0F172A]">{selectedMember.name}</strong>.
              </div>

              <form onSubmit={handleSavePin} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[#475569] font-medium mb-1">
                    New PIN / Password <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="Enter new 4-digit PIN or password"
                    className="w-full h-8.5 px-3 bg-[#F8F9FA] border border-[#CBD5E1] rounded-md text-xs font-mono text-[#0F172A] focus:bg-white focus:border-[#C81E1E] transition"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-3 border-t border-[#E2E8F0]">
                  <button
                    type="button"
                    onClick={() => setIsResetPinModalOpen(false)}
                    className="flex-1 h-8.5 bg-[#F8F9FA] hover:bg-[#F1F5F9] text-[#475569] font-medium rounded-md border border-[#CBD5E1] text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-8.5 bg-[#D97706] hover:bg-[#B45309] text-white font-semibold rounded-md text-xs shadow-xs transition disabled:opacity-50"
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
