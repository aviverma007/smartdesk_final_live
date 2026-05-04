import React, { useState, useMemo, useEffect } from "react";
import { Search, Grid3X3, List, X, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useAuth } from "../context/AuthContext";
import { employeeAPI, utilityAPI } from "../services/api";
import EmployeeCard from "./EmployeeCard";
import EmployeeList from "./EmployeeList";

const S = {
  container: { padding: '0 0 24px' },
  searchCard: {
    background: 'rgba(6,20,45,0.85)', border: '1px solid rgba(0,212,255,0.2)',
    borderRadius: 8, padding: '14px 16px', marginBottom: 14,
    backdropFilter: 'blur(12px)', position: 'relative', overflow: 'hidden',
  },
  searchCardTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    background: 'linear-gradient(90deg,transparent,#00d4ff,transparent)', opacity: .5,
  },
  inputWrap: { position: 'relative' },
  input: {
    width: '100%', background: 'rgba(0,20,40,0.8)',
    border: '1px solid rgba(0,212,255,0.2)', borderRadius: 5,
    padding: '8px 34px 8px 34px', color: '#e0f4ff',
    fontFamily: "'Exo 2', sans-serif", fontSize: '.8rem', outline: 'none',
    transition: 'border-color .2s',
  },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,212,255,0.4)', pointerEvents: 'none' },
  clearBtn: {
    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'rgba(0,212,255,0.5)', cursor: 'pointer', padding: 2,
  },
  viewBtn: (active) => ({
    background: active ? 'rgba(0,212,255,0.15)' : 'rgba(6,20,45,0.8)',
    border: `1px solid ${active ? 'rgba(0,212,255,0.5)' : 'rgba(0,212,255,0.15)'}`,
    color: active ? '#00d4ff' : 'rgba(122,184,212,0.6)',
    borderRadius: 5, padding: '6px 10px', cursor: 'pointer', transition: 'all .2s',
    display: 'flex', alignItems: 'center', gap: 4,
  }),
  clearAllBtn: {
    background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.3)',
    color: '#ff6b00', borderRadius: 5, padding: '6px 12px', cursor: 'pointer',
    fontFamily: "'Orbitron', monospace", fontSize: '.6rem', letterSpacing: '.1em',
    transition: 'all .2s',
  },
  countBadge: {
    fontFamily: "'Share Tech Mono', monospace", fontSize: '.6rem',
    color: '#00d4ff', background: 'rgba(0,212,255,0.1)',
    border: '1px solid rgba(0,212,255,0.25)', borderRadius: 4,
    padding: '3px 8px', letterSpacing: '.1em',
  },
  loadingWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '60px 0', flexDirection: 'column', gap: 16,
  },
  spinner: {
    width: 36, height: 36, border: '2px solid rgba(0,212,255,0.1)',
    borderTop: '2px solid #00d4ff', borderRadius: '50%',
    animation: 'spin .8s linear infinite',
  },
};

const EmployeeDirectory = () => {
  const [nameSearch, setNameSearch] = useState("");
  const [employeeIdSearch, setEmployeeIdSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [designationSearch, setDesignationSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [debouncedSearchTerms, setDebouncedSearchTerms] = useState({ name:"",employeeId:"",department:"",designation:"",location:"" });
  const [viewMode, setViewMode] = useState("grid");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { isAdmin } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await employeeAPI.getAll();
        setEmployees(data);
      } catch (e) { setEmployees([]); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerms({ name: nameSearch, employeeId: employeeIdSearch, department: departmentSearch, designation: designationSearch, location: locationSearch }), 300);
    return () => clearTimeout(t);
  }, [nameSearch, employeeIdSearch, departmentSearch, designationSearch, locationSearch]);

  const filteredEmployees = useMemo(() => {
    const has = debouncedSearchTerms.name || debouncedSearchTerms.employeeId || debouncedSearchTerms.department || debouncedSearchTerms.designation || debouncedSearchTerms.location;
    if (!isAdmin && !has) return [];
    return employees.filter(emp => {
      const nm = (emp.name || '').toLowerCase();
      const id = (emp.employeeId || emp.employee_id || '').toLowerCase();
      const dp = (emp.department || '').toLowerCase();
      const dg = (emp.designation || '').toLowerCase();
      const lc = (emp.location || '').toLowerCase();
      const s = debouncedSearchTerms;
      return (!s.name || nm.startsWith(s.name.toLowerCase()))
        && (!s.employeeId || id.startsWith(s.employeeId.toLowerCase()))
        && (!s.department || dp.startsWith(s.department.toLowerCase()))
        && (!s.designation || dg.startsWith(s.designation.toLowerCase()))
        && (!s.location || lc.startsWith(s.location.toLowerCase()));
    });
  }, [employees, debouncedSearchTerms, isAdmin]);

  const hasSearched = nameSearch || employeeIdSearch || departmentSearch || designationSearch || locationSearch;

  const handleImageUpdate = async (employeeId, imageData) => {
    try {
      let updated;
      if (imageData instanceof File) updated = await employeeAPI.uploadImage(employeeId, imageData);
      else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) updated = await employeeAPI.updateImage(employeeId, imageData);
      else throw new Error('Invalid image data');
      setEmployees(prev => prev.map(e => e.id === employeeId ? updated : e));
      if (selectedEmployee?.id === employeeId) setSelectedEmployee(updated);
    } catch (e) { console.error(e); throw e; }
  };

  const clearAllSearches = () => { setNameSearch(""); setEmployeeIdSearch(""); setDepartmentSearch(""); setDesignationSearch(""); setLocationSearch(""); };

  const SearchInput = ({ value, onChange, placeholder }) => (
    <div style={S.inputWrap}>
      <Search size={14} style={S.searchIcon} />
      <input
        style={S.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={e => e.target.style.borderColor = 'rgba(0,212,255,0.6)'}
        onBlur={e => e.target.style.borderColor = 'rgba(0,212,255,0.2)'}
      />
      {value && <button style={S.clearBtn} onClick={() => onChange("")}><X size={12} /></button>}
    </div>
  );

  if (loading) return (
    <div style={S.loadingWrap}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.spinner} />
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.65rem', color: 'rgba(0,212,255,0.5)', letterSpacing: '.15em' }}>
        LOADING PERSONNEL DATABASE...
      </div>
    </div>
  );

  return (
    <div style={S.container}>
      {/* Section header */}
      <div style={{ marginBottom: 14 }}>
        <div className="section-title" style={{ marginBottom: 6 }}>// PERSONNEL DATABASE</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontFamily: "'Orbitron', monospace", fontWeight: 800, fontSize: '1.2rem', color: '#e0f4ff', margin: 0 }}>
            EMPLOYEE <span className="neon-text">DIRECTORY</span>
          </h2>
          {isAdmin && <div style={S.countBadge}>{employees.length} RECORDS</div>}
        </div>
        <div className="cyber-divider" style={{ marginTop: 10 }} />
      </div>

      {/* Search Bar */}
      <div style={S.searchCard}>
        <div style={S.searchCardTop} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
          <SearchInput value={nameSearch} onChange={setNameSearch} placeholder="Search name..." />
          <SearchInput value={employeeIdSearch} onChange={setEmployeeIdSearch} placeholder="Employee ID..." />
          <SearchInput value={departmentSearch} onChange={setDepartmentSearch} placeholder="Department..." />
          <SearchInput value={designationSearch} onChange={setDesignationSearch} placeholder="Designation..." />
          <SearchInput value={locationSearch} onChange={setLocationSearch} placeholder="Location..." />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button style={S.viewBtn(viewMode==='grid')} onClick={() => setViewMode('grid')}>
            <Grid3X3 size={13} /> GRID
          </button>
          <button style={S.viewBtn(viewMode==='list')} onClick={() => setViewMode('list')}>
            <List size={13} /> LIST
          </button>
          {hasSearched && <button style={S.clearAllBtn} onClick={clearAllSearches}>✕ CLEAR ALL</button>}
          {filteredEmployees.length > 0 && (
            <div style={{ ...S.countBadge, marginLeft: 'auto' }}>{filteredEmployees.length} RESULTS</div>
          )}
        </div>
      </div>

      {/* Empty / Prompt */}
      {!isAdmin && !hasSearched && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: .4 }}>◈</div>
          <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '.7rem', color: 'rgba(0,212,255,0.5)', letterSpacing: '.2em' }}>
            ENTER SEARCH QUERY TO ACCESS RECORDS
          </div>
        </div>
      )}

      {isAdmin && !hasSearched && employees.length > 0 && viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {employees.map(emp => (
            <EmployeeCard key={emp.id} employee={emp} isAdmin={isAdmin} onImageUpdate={handleImageUpdate} onClick={() => { setSelectedEmployee(emp); setShowDetailModal(true); }} />
          ))}
        </div>
      )}

      {isAdmin && !hasSearched && employees.length > 0 && viewMode === 'list' && (
        <EmployeeList employees={employees} isAdmin={isAdmin} onImageUpdate={handleImageUpdate} onEmployeeClick={(e) => { setSelectedEmployee(e); setShowDetailModal(true); }} />
      )}

      {hasSearched && filteredEmployees.length > 0 && viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {filteredEmployees.map(emp => (
            <EmployeeCard key={emp.id} employee={emp} isAdmin={isAdmin} onImageUpdate={handleImageUpdate} onClick={() => { setSelectedEmployee(emp); setShowDetailModal(true); }} />
          ))}
        </div>
      )}

      {hasSearched && filteredEmployees.length > 0 && viewMode === 'list' && (
        <EmployeeList employees={filteredEmployees} isAdmin={isAdmin} onImageUpdate={handleImageUpdate} onEmployeeClick={(e) => { setSelectedEmployee(e); setShowDetailModal(true); }} />
      )}

      {hasSearched && filteredEmployees.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: .3 }}>◉</div>
          <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '.7rem', color: 'rgba(0,212,255,0.4)', letterSpacing: '.15em' }}>
            NO RECORDS MATCH QUERY
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent style={{ background: 'rgba(6,20,45,0.98)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 10, maxWidth: 500 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Orbitron', monospace", color: '#00d4ff', fontSize: '.8rem', letterSpacing: '.15em' }}>
              PERSONNEL RECORD
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <EmployeeCard employee={selectedEmployee} isAdmin={isAdmin} onImageUpdate={handleImageUpdate} isDetailView />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeDirectory;
