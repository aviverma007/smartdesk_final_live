import React, { useState } from 'react';
import { ExternalLink, BarChart3, TrendingUp, Users, FileText, BarChart2 } from 'lucide-react';

const ACCENT_COLORS = ['#00d4ff','#0066ff','#00ff88','#7b2fff','#ff6b00','#00d4ff','#ff6b00','#7b2fff','#00ff88'];

const dashboards = [
  { id: 'po', title: 'PO DASHBOARD', description: 'Purchase Order Analytics', icon: FileText, url: 'https://app.powerbi.com/view?r=eyJrIjoiYWI3MmFhNmEtZGY4Yy00MjhkLTgwOTYtZDM2ZjEwMDFkY2QzIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9' },
  { id: 'pr', title: 'PR DASHBOARD', description: 'Purchase Request Analytics', icon: FileText, url: 'https://app.powerbi.com/view?r=eyJrIjoiMjgyNTI0NzgtMmZiMS00MWFlLTkyMzUtNTMyNTYyY2I1MTZjIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9' },
  { id: 'qms', title: 'QMS DASHBOARD', description: 'Quality Management System', icon: TrendingUp, url: 'https://app.powerbi.com/view?r=eyJrIjoiY2Y0YjA4ZDUtZjg5ZC00YjE5LThjYzYtY2QyOTE5YzlmYzk1IiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9' },
  { id: 'cost', title: 'COST DASHBOARD', description: 'Cost Analytics', icon: BarChart3, url: 'https://app.powerbi.com/view?r=eyJrIjoiZjBjYjk1MTItMjI4OS00Y2MzLTg1OGUtZWU1NjgzMTk3MDJlIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9' },
  { id: 'sales', title: 'SALES DASHBOARD', description: 'Sales Analytics', icon: BarChart2, url: 'https://app.powerbi.com/view?r=eyJrIjoiNjQyODljZDItYmVkNy00YTE0LWE0MGMtYTAxNDk4NGQ1YWE0IiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9' },
  { id: 'assets', title: 'ASSET DASHBOARD', description: 'Asset Management & Tracking', icon: BarChart3, url: 'https://app.powerbi.com/view?r=eyJrIjoiNWM4YzRkMjctOTZmMC00ZDJhLWFhYmMtZWQ2MWU1ZDUyMzMzIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9' },
  { id: 'dpr', title: 'DAILY PROGRESS', description: 'Daily Progress Report', icon: Users, url: 'https://app.powerbi.com/view?r=eyJrIjoiOWJlZmRlYWMtYTkwMC00NWY4LWIzNTEtYzcxNDg2Zjg2Mjg0IiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9' },
  { id: 'crm', title: 'CASE MANAGEMENT', description: 'CRM Case Management', icon: Users, url: 'https://app.powerbi.com/view?r=eyJrIjoiZjk0NjE0YTgtNDAyMy00ZWEwLThkMjYtNzFlYmVlMmY5ZmUxIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9' },
  { id: 'attendance', title: 'ATTENDANCE', description: 'Employee Attendance Analytics', icon: Users, url: 'https://app.powerbi.com/view?r=eyJrIjoiM2ZjM2JlMTMtYmRjYi00MTViLTljOTQtM2UyODAwNDkyNTQxIiwidCI6IjcxMWY0MDY2LTA3YjctNDVhMS05ZTMyLTk3OGU4NjUyOGNhZCJ9' },
];

const DashCard = ({ item, color, idx }) => {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;
  return (
    <div
      onClick={() => window.open(item.url, '_blank')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? `rgba(${color === '#00d4ff' ? '0,212,255' : color === '#0066ff' ? '0,102,255' : color === '#00ff88' ? '0,255,136' : color === '#7b2fff' ? '123,47,255' : '255,107,0'},0.1)` : 'rgba(6,20,45,0.8)',
        border: `1px solid ${hovered ? color : 'rgba(0,212,255,0.2)'}`,
        borderRadius: 8,
        padding: '20px 16px',
        cursor: 'pointer',
        transition: 'all 0.3s',
        boxShadow: hovered ? `0 0 20px ${color}33, 0 4px 20px rgba(0,0,0,0.4)` : '0 4px 20px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Top accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: hovered ? 1 : 0.3, transition: 'opacity 0.3s',
      }} />

      {/* Corner number */}
      <div style={{
        position: 'absolute', top: 8, right: 10,
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: '0.55rem', color: `${color}60`,
        letterSpacing: '0.1em',
      }}>
        {String(idx + 1).padStart(2, '0')}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 6,
          background: `${color}18`,
          border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: hovered ? `0 0 12px ${color}40` : 'none',
          transition: 'box-shadow 0.3s',
        }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Orbitron, monospace', fontSize: '0.6rem',
            fontWeight: 700, letterSpacing: '0.1em',
            color: hovered ? color : '#e0f4ff',
            marginBottom: 4, transition: 'color 0.3s',
            lineHeight: 1.3,
          }}>
            {item.title}
          </div>
          <div style={{
            fontFamily: 'Exo 2, sans-serif', fontSize: '0.65rem',
            color: 'rgba(122,184,212,0.6)', lineHeight: 1.4,
          }}>
            {item.description}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{
          width: 4, height: 4, borderRadius: '50%',
          background: color, boxShadow: `0 0 5px ${color}`,
        }} />
        <span style={{
          fontFamily: 'Share Tech Mono, monospace', fontSize: '0.55rem',
          color: `${color}80`, letterSpacing: '0.1em',
        }}>
          LAUNCH REPORT
        </span>
        <ExternalLink size={10} style={{ color: `${color}80`, marginLeft: 'auto' }} />
      </div>
    </div>
  );
};

const Dashboard = () => (
  <div style={{ padding: '0 0 24px' }}>
    {/* Header */}
    <div style={{ marginBottom: 24 }}>
      <div className="section-title" style={{ marginBottom: 8 }}>// ANALYTICS HUB</div>
      <h2 style={{
        fontFamily: 'Orbitron, monospace', fontWeight: 800,
        fontSize: '1.4rem', color: '#e0f4ff',
        margin: 0, lineHeight: 1,
      }}>
        POWER BI <span className="neon-text">DASHBOARDS</span>
      </h2>
      <div className="cyber-divider" style={{ marginTop: 12 }} />
    </div>

    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 12,
    }}>
      {dashboards.map((d, i) => (
        <DashCard key={d.id} item={d} color={ACCENT_COLORS[i % ACCENT_COLORS.length]} idx={i} />
      ))}
    </div>
  </div>
);

export default Dashboard;
