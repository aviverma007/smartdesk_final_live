import React, { useState, useMemo, useEffect } from "react";
import { Search, Grid3X3, List, X, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useAuth } from "../context/AuthContext";
import { employeeAPI, utilityAPI } from "../services/api";
import EmployeeCard from "./EmployeeCard";
import EmployeeList from "./EmployeeList";

/* ── Stable SearchInput (defined outside to prevent re-mount on re-render) ── */
const SearchInput = ({ value, onChange, placeholder }) => (
  <div style={{ position:'relative' }}>
    <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'rgba(139,92,246,0.5)', pointerEvents:'none' }} />
    <input
      style={{ width:'100%', background:'rgba(139,92,246,0.06)', border:'1px solid rgba(139,92,246,0.2)', borderRadius:7, padding:'8px 32px 8px 32px', color:'var(--text-primary)', fontFamily:"'DM Sans', sans-serif", fontSize:'.82rem', outline:'none', transition:'border-color .2s' }}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={e => e.target.style.borderColor='rgba(139,92,246,0.5)'}
      onBlur={e => e.target.style.borderColor='rgba(139,92,246,0.2)'}
    />
    {value && (
      <button style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(139,92,246,0.6)', cursor:'pointer', padding:2 }} onClick={() => onChange("")}>
        <X size={12} />
      </button>
    )}
  </div>
);

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

const EmployeeDirectory = ({ onViewAttendance, restrictToEmpId, highlightEmpId, onHighlightDone }) => {
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

  // Auto-open employee card when coming from global search
  useEffect(() => {
    if (!highlightEmpId || !employees.length) return;
    const emp = employees.find(e => String(e.id).trim() === String(highlightEmpId).trim());
    if (emp) {
      setSelectedEmployee(emp);
      setShowDetailModal(true);
      if (onHighlightDone) onHighlightDone();
    }
  }, [highlightEmpId, employees]);

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

    // No search term — show all employees to everyone
    if (!has) return employees;

    // Filter by search terms — all users see all matching employees
    return employees.filter(emp => {
      const nm = (emp.name || '').toLowerCase();
      const id = String(emp.id || '').toLowerCase();
      const dp = (emp.department || '').toLowerCase();
      const dg = (emp.grade || emp.designation || '').toLowerCase();
      const lc = (emp.location || '').toLowerCase();
      const s = debouncedSearchTerms;
      return (!s.name       || nm.includes(s.name.toLowerCase()))
          && (!s.employeeId || id.includes(s.employeeId.toLowerCase()))
          && (!s.department  || dp.includes(s.department.toLowerCase()))
          && (!s.designation || dg.includes(s.designation.toLowerCase()))
          && (!s.location    || lc.includes(s.location.toLowerCase()));
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
    <div style={{ padding:'0 0 24px' }}>
      {/* Header */}
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:6 }}>
          <h2 style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontWeight:800, fontSize:'1.2rem', color:'var(--text-primary)', margin:0 }}>
            Employee Directory
          </h2>
          {isAdmin && hasSearched && (
            <span style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'.75rem', color:'var(--text-muted)', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:6, padding:'3px 10px' }}>
              {employees.length} total records
            </span>
          )}
        </div>
        <div style={{ height:1, background:'var(--border)' }} />
      </div>

      {/* Search Bar */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:14, boxShadow:'var(--shadow-card)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:8, marginBottom:10 }}>
          <SearchInput value={nameSearch} onChange={setNameSearch} placeholder="Search name..." />
          <SearchInput value={employeeIdSearch} onChange={setEmployeeIdSearch} placeholder="Employee ID..." />
          <SearchInput value={departmentSearch} onChange={setDepartmentSearch} placeholder="Department..." />
          <SearchInput value={designationSearch} onChange={setDesignationSearch} placeholder="Designation..." />
          <SearchInput value={locationSearch} onChange={setLocationSearch} placeholder="Location..." />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <button onClick={() => setViewMode('grid')} style={{ display:'flex', alignItems:'center', gap:4, background:viewMode==='grid'?'rgba(139,92,246,0.15)':'transparent', border:`1px solid ${viewMode==='grid'?'rgba(139,92,246,0.5)':'var(--border)'}`, color:viewMode==='grid'?'var(--accent-purple)':'var(--text-muted)', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:'.75rem', fontFamily:"'DM Sans', sans-serif", transition:'all .2s' }}>
            <Grid3X3 size={13}/> Grid
          </button>
          <button onClick={() => setViewMode('list')} style={{ display:'flex', alignItems:'center', gap:4, background:viewMode==='list'?'rgba(139,92,246,0.15)':'transparent', border:`1px solid ${viewMode==='list'?'rgba(139,92,246,0.5)':'var(--border)'}`, color:viewMode==='list'?'var(--accent-purple)':'var(--text-muted)', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:'.75rem', fontFamily:"'DM Sans', sans-serif", transition:'all .2s' }}>
            <List size={13}/> List
          </button>
          {hasSearched && (
            <button onClick={clearAllSearches} style={{ background:'transparent', border:'1px solid rgba(244,114,182,0.3)', color:'var(--accent-pink)', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontFamily:"'DM Sans', sans-serif", fontSize:'.75rem', transition:'all .2s' }}>
              ✕ Clear all
            </button>
          )}
          {hasSearched && filteredEmployees.length > 0 && (
            <span style={{ marginLeft:'auto', fontFamily:"'DM Sans', sans-serif", fontSize:'.75rem', color:'var(--text-muted)' }}>
              {filteredEmployees.length} result{filteredEmployees.length!==1?'s':''}
            </span>
          )}
        </div>
      </div>

      {/* Prompt when nothing searched */}
      {!hasSearched && (
        <div style={{ textAlign:'center', padding:'80px 0' }}>
          <div style={{ fontSize:48, marginBottom:16, opacity:.25 }}>
            <Search size={48} style={{ margin:'0 auto', color:'var(--accent-purple)' }}/>
          </div>
          <div style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontWeight:600, fontSize:'1rem', color:'var(--text-secondary)', marginBottom:8 }}>
            Search the employee directory
          </div>
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'.82rem', color:'var(--text-muted)' }}>
            Type a name, ID, department, designation, or location to find employees
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && filteredEmployees.length > 0 && viewMode === 'grid' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 }}>
          {filteredEmployees.map(emp => (
            <EmployeeCard key={emp.id} employee={emp} isAdmin={isAdmin} onImageUpdate={handleImageUpdate} onClick={() => { setSelectedEmployee(emp); setShowDetailModal(true); }} onViewAttendance={onViewAttendance} />
          ))}
        </div>
      )}

      {hasSearched && filteredEmployees.length > 0 && viewMode === 'list' && (
        <EmployeeList employees={filteredEmployees} isAdmin={isAdmin} onImageUpdate={handleImageUpdate} onEmployeeClick={(e) => { setSelectedEmployee(e); setShowDetailModal(true); }} />
      )}

      {hasSearched && filteredEmployees.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <div style={{ fontSize:36, marginBottom:12, opacity:.3 }}>
            <User size={36} style={{ margin:'0 auto', color:'var(--text-muted)' }}/>
          </div>
          <div style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontWeight:600, fontSize:'.9rem', color:'var(--text-secondary)', marginBottom:6 }}>
            No employees found
          </div>
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:'.8rem', color:'var(--text-muted)' }}>
            Try adjusting your search terms
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, maxWidth:500 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily:"'Plus Jakarta Sans', sans-serif", fontWeight:700, color:'var(--text-primary)', fontSize:'.95rem' }}>
              Employee Record
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
