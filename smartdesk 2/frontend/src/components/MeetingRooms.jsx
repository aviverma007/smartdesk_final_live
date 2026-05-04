import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { meetingRoomAPI, employeeAPI, utilityAPI } from '../services/api';
import SearchableEmployeeDropdown from './ui/SearchableEmployeeDropdown';

const cs = { // cyber styles helpers
  card: { background:'rgba(6,20,45,0.85)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:8, backdropFilter:'blur(12px)', position:'relative', overflow:'hidden' },
  topLine: { position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,#00d4ff,transparent)', opacity:.5 },
  label: { fontFamily:"'Orbitron', monospace", fontSize:'.55rem', letterSpacing:'.15em', color:'rgba(0,212,255,0.5)', textTransform:'uppercase', marginBottom:5 },
  select: { width:'100%', background:'rgba(0,20,40,0.8)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:5, padding:'8px 10px', color:'#e0f4ff', fontFamily:"'Exo 2', sans-serif", fontSize:'.8rem', outline:'none', cursor:'pointer' },
  input: { width:'100%', background:'rgba(0,20,40,0.8)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:5, padding:'8px 10px', color:'#e0f4ff', fontFamily:"'Exo 2', sans-serif", fontSize:'.8rem', outline:'none' },
  btn: (color='#00d4ff') => ({ background:`rgba(${color==='#00d4ff'?'0,212,255':color==='#ff6b00'?'255,107,0':'255,60,60'},0.12)`, border:`1px solid ${color}60`, color, fontFamily:"'Orbitron', monospace", fontSize:'.6rem', letterSpacing:'.1em', padding:'7px 14px', borderRadius:5, cursor:'pointer', transition:'all .25s', display:'flex', alignItems:'center', gap:5 }),
};

const StatusBadge = ({ status }) => (
  <div style={{
    fontFamily:"'Share Tech Mono', monospace", fontSize:'.6rem', letterSpacing:'.1em',
    padding:'3px 10px', borderRadius:3,
    background: status==='vacant' ? 'rgba(0,255,136,0.1)' : 'rgba(255,107,0,0.1)',
    border: `1px solid ${status==='vacant' ? 'rgba(0,255,136,0.4)' : 'rgba(255,107,0,0.4)'}`,
    color: status==='vacant' ? '#00ff88' : '#ff6b00',
  }}>
    {status==='vacant' ? '◈ VACANT' : '◉ OCCUPIED'}
  </div>
);

const MeetingRooms = () => {
  const { isAdmin } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({ location:'', floor:'', status:'' });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [bookingData, setBookingData] = useState({ employee_name:'', employee_id:'', start_time:'', end_time:'', purpose:'' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchRooms(); fetchEmployees(); fetchLocations(); }, []);
  useEffect(() => { fetchRooms(); }, [filters]);

  const fetchRooms = async () => {
    try { setLoading(true); setRooms(await meetingRoomAPI.getAll(filters)); }
    catch(e) { console.error(e); toast.error('Failed to load meeting rooms'); }
    finally { setLoading(false); }
  };
  const fetchEmployees = async () => { try { setEmployees(await employeeAPI.getAll()); } catch(e){} };
  const fetchLocations = async () => { try { const d = await utilityAPI.getLocations(); setLocations(d.filter(l=>l!=='All Locations')); } catch(e){} };

  const handleBookRoom = async () => {
    if (!selectedRoom || !bookingData.employee_id || !bookingData.start_time || !bookingData.end_time) {
      toast.error('Please fill in all required fields'); return;
    }
    try {
      const emp = employees.find(e => e.id === bookingData.employee_id);
      await meetingRoomAPI.book(selectedRoom.id, { ...bookingData, employee_name: emp?.name || bookingData.employee_name, room_name: selectedRoom.name });
      toast.success('Room booked successfully!');
      setSelectedRoom(null);
      setBookingData({ employee_name:'', employee_id:'', start_time:'', end_time:'', purpose:'' });
      fetchRooms();
    } catch(e) { toast.error('Failed to book room'); }
  };

  const handleCancelBooking = async (roomId, bookingId) => {
    try { await meetingRoomAPI.cancelSpecificBooking(roomId, bookingId); toast.success('Booking cancelled'); fetchRooms(); }
    catch(e) { toast.error('Failed to cancel booking'); }
  };

  const handleClearAllBookings = async () => {
    if (!window.confirm('Clear ALL bookings across all rooms?')) return;
    try { await meetingRoomAPI.cancelAllBookings(); toast.success('All bookings cleared'); fetchRooms(); }
    catch(e) { toast.error('Failed to clear bookings'); }
  };

  const handleClearRoomBookings = async (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!window.confirm(`Clear all ${room?.bookings?.length || 0} bookings for ${room?.name}?`)) return;
    try {
      for (const b of room.bookings) await meetingRoomAPI.cancelSpecificBooking(roomId, b.id);
      toast.success(`Bookings cleared for ${room.name}`); fetchRooms();
    } catch(e) { toast.error('Failed to clear bookings'); }
  };

  const getBookingStatus = (b) => {
    const now = new Date(), s = new Date(b.start_time), e = new Date(b.end_time);
    if (s <= now && now <= e) return { label: 'ACTIVE', color: '#ff6b00' };
    if (s > now) return { label: 'UPCOMING', color: '#00d4ff' };
    return { label: 'DONE', color: 'rgba(122,184,212,0.4)' };
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'60px 0', flexDirection:'column', gap:14 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:32, height:32, border:'2px solid rgba(0,212,255,0.1)', borderTop:'2px solid #00d4ff', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
      <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.6rem', color:'rgba(0,212,255,0.5)', letterSpacing:'.15em' }}>LOADING ROOM DATA...</div>
    </div>
  );

  return (
    <div style={{ padding:'0 0 24px' }}>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <div className="section-title" style={{ marginBottom:6 }}>// SPACE ALLOCATION</div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <h2 style={{ fontFamily:"'Orbitron', monospace", fontWeight:800, fontSize:'1.2rem', color:'#e0f4ff', margin:0 }}>
            MEETING <span className="neon-text">ROOMS</span>
          </h2>
          {isAdmin && (
            <button style={cs.btn('#ff6b00')} onClick={handleClearAllBookings}>
              <XCircle size={12}/> CLEAR ALL BOOKINGS
            </button>
          )}
        </div>
        <div className="cyber-divider" style={{ marginTop:10 }} />
      </div>

      {/* Filters */}
      <div style={{ ...cs.card, padding:'14px 16px', marginBottom:16 }}>
        <div style={cs.topLine} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:10, alignItems:'end' }}>
          <div>
            <div style={cs.label}>LOCATION</div>
            <select style={cs.select} value={filters.location} onChange={e=>setFilters({...filters, location:e.target.value})}>
              <option value="">All Locations</option>
              {locations.map(l=><option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <div style={cs.label}>FLOOR</div>
            <select style={cs.select} value={filters.floor} onChange={e=>setFilters({...filters, floor:e.target.value})}>
              <option value="">All Floors</option>
              {[...new Set(rooms.map(r=>r.floor))].sort().map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <div style={cs.label}>STATUS</div>
            <select style={cs.select} value={filters.status} onChange={e=>setFilters({...filters, status:e.target.value})}>
              <option value="">All Status</option>
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
            </select>
          </div>
          <div>
            <button style={{ ...cs.btn(), width:'100%', justifyContent:'center' }} onClick={()=>setFilters({location:'',floor:'',status:''})}>
              CLEAR FILTERS
            </button>
          </div>
        </div>
      </div>

      {/* Room Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
        {rooms.map(room => (
          <div key={room.id} style={{ ...cs.card, transition:'all .3s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,212,255,0.45)'; e.currentTarget.style.boxShadow='0 0 18px rgba(0,212,255,0.12)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(0,212,255,0.2)'; e.currentTarget.style.boxShadow='none'}}
          >
            <div style={cs.topLine} />
            <div style={{ padding:'14px 16px' }}>
              {/* Room header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ fontFamily:"'Orbitron', monospace", fontWeight:700, fontSize:'.8rem', color:'#e0f4ff' }}>{room.name}</div>
                <StatusBadge status={room.status} />
              </div>

              {/* Room details */}
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, fontFamily:"'Exo 2', sans-serif", fontSize:'.7rem', color:'rgba(122,184,212,0.7)' }}>
                  <MapPin size={12} style={{ color:'rgba(0,212,255,0.5)' }} />{room.location} — {room.floor}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:7, fontFamily:"'Exo 2', sans-serif", fontSize:'.7rem', color:'rgba(122,184,212,0.7)' }}>
                  <Users size={12} style={{ color:'rgba(0,212,255,0.5)' }} />Capacity: {room.capacity} people
                </div>
                {room.amenities && (
                  <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.68rem', color:'rgba(122,184,212,0.5)', lineHeight:1.4 }}>
                    {room.amenities}
                  </div>
                )}
              </div>

              {/* Bookings */}
              {room.bookings && room.bookings.length > 0 ? (
                <div style={{ background:'rgba(0,212,255,0.04)', border:'1px solid rgba(0,212,255,0.12)', borderRadius:5, padding:'10px', marginBottom:12, maxHeight:140, overflowY:'auto' }}>
                  <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.55rem', color:'rgba(0,212,255,0.5)', letterSpacing:'.1em', marginBottom:8 }}>
                    ◈ {room.bookings.length} BOOKING{room.bookings.length>1?'S':''}
                  </div>
                  {room.bookings.map((b, i) => {
                    const bs = getBookingStatus(b);
                    return (
                      <div key={b.id||i} style={{ background:'rgba(6,20,45,0.8)', border:'1px solid rgba(0,212,255,0.1)', borderRadius:4, padding:'7px 9px', marginBottom:6 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                          <span style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.7rem', color:'#e0f4ff', fontWeight:600 }}>{b.employee_name}</span>
                          <span style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.55rem', color:bs.color, letterSpacing:'.08em' }}>{bs.label}</span>
                        </div>
                        <div style={{ fontFamily:"'Share Tech Mono', monospace", fontSize:'.6rem', color:'rgba(122,184,212,0.5)' }}>
                          <Clock size={10} style={{ display:'inline', marginRight:4 }} />
                          {new Date(b.start_time).toLocaleString()} → {new Date(b.end_time).toLocaleString()}
                        </div>
                        {b.purpose && <div style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.65rem', color:'rgba(122,184,212,0.5)', marginTop:3 }}>{b.purpose}</div>}
                        <button style={{ ...cs.btn('#ff6b00'), marginTop:5, padding:'3px 8px', fontSize:'.55rem' }} onClick={()=>handleCancelBooking(room.id,b.id)}>
                          CANCEL
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ background:'rgba(0,255,136,0.04)', border:'1px solid rgba(0,255,136,0.15)', borderRadius:5, padding:'8px 10px', marginBottom:12, display:'flex', alignItems:'center', gap:7 }}>
                  <CheckCircle size={12} style={{ color:'#00ff88' }} />
                  <span style={{ fontFamily:"'Exo 2', sans-serif", fontSize:'.7rem', color:'#00ff88' }}>Available — No bookings</span>
                </div>
              )}

              {/* Actions */}
              <div style={{ display:'flex', gap:8 }}>
                <button style={{ ...cs.btn(), flex:1, justifyContent:'center' }} onClick={()=>setSelectedRoom(room)}>
                  <CheckCircle size={12}/> BOOK ROOM
                </button>
                {room.bookings?.length > 0 && (
                  <button style={{ ...cs.btn('#ff6b00'), flex:1, justifyContent:'center' }} onClick={()=>handleClearRoomBookings(room.id)}>
                    <XCircle size={12}/> CLEAR ({room.bookings.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {rooms.length === 0 && (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <div style={{ fontSize:40, opacity:.3, marginBottom:12 }}>◫</div>
          <div style={{ fontFamily:"'Orbitron', monospace", fontSize:'.7rem', color:'rgba(0,212,255,0.4)', letterSpacing:'.15em' }}>NO ROOMS MATCH CURRENT FILTERS</div>
        </div>
      )}

      {/* Booking Modal */}
      {selectedRoom && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 }}>
          <div style={{ ...cs.card, width:'100%', maxWidth:440, padding:'20px 24px' }}>
            <div style={cs.topLine} />
            <div style={{ fontFamily:"'Orbitron', monospace", fontWeight:700, fontSize:'.75rem', color:'#00d4ff', marginBottom:16, letterSpacing:'.1em' }}>
              BOOK SPACE: {selectedRoom.name}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <div style={cs.label}>EMPLOYEE</div>
                <SearchableEmployeeDropdown employees={employees} selectedEmployeeId={bookingData.employee_id} onEmployeeSelect={id=>{ const e=employees.find(x=>x.id===id); setBookingData({...bookingData, employee_id:id, employee_name:e?.name||''}); }} placeholder="Search employee..." />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <div style={cs.label}>START TIME</div>
                  <input type="datetime-local" style={cs.input} value={bookingData.start_time} onChange={e=>setBookingData({...bookingData, start_time:e.target.value})} />
                </div>
                <div>
                  <div style={cs.label}>END TIME</div>
                  <input type="datetime-local" style={cs.input} value={bookingData.end_time} onChange={e=>setBookingData({...bookingData, end_time:e.target.value})} />
                </div>
              </div>
              <div>
                <div style={cs.label}>PURPOSE</div>
                <input style={cs.input} value={bookingData.purpose} onChange={e=>setBookingData({...bookingData, purpose:e.target.value})} placeholder="Meeting purpose..." />
              </div>
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button style={{ ...cs.btn(), flex:1, justifyContent:'center' }} onClick={handleBookRoom}>CONFIRM BOOKING</button>
                <button style={{ ...cs.btn('#7b2fff'), flex:1, justifyContent:'center' }} onClick={()=>setSelectedRoom(null)}>CANCEL</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingRooms;
