import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { employeeAPI } from '../services/api';
import {
  ChevronLeft, ChevronRight, Users, PartyPopper,
  CheckSquare, Workflow, Newspaper, Image, Plus,
  X
} from "lucide-react";

const bannerImages = [
  "/images/smart-world-orchard.webp",
  "/images/smart-world-one-dxp.webp",
  "/images/smart-world-gems.webp",
  "/images/smart-world-the-edition.webp",
  "/images/smart-world-sky-arc.webp"
];

const galleryImages = [
  "/images/gallery-1.jpg",
  "/images/gallery-2.jpg",
  "/images/gallery-3.jpeg",
  "/images/gallery-4.jpg",
  "/images/gallery-5.jpg",
  "/images/gallery-6.jpg",
  "/images/gallery-7.jpg",
  "/images/gallery-8.jpg",
  "/images/gallery-9.jpg"
];

const projectLinks = [
  { name: "SKY ARC", url: "https://smartworlddevelopers.com/project/sky-arc/" },
  { name: "THE EDITION", url: "https://smartworlddevelopers.com/project/theedition/" },
  { name: "ONE DXP", url: "https://smartworlddevelopers.com/project/onedxp/" },
  { name: "ORCHARD STREET", url: "https://smartworlddevelopers.com/project/orchardstreet/" },
  { name: "ORCHARD", url: "https://smartworlddevelopers.com/project/orchard/" },
  { name: "GEMS", url: "https://smartworlddevelopers.com/project/gems/" },
];

const quickLinks = [
  { title: "Adrenaline", desc: "HR Portal", url: "https://maxhr.myadrenalin.com/AdrenalinMax/", img: "/images/adrenaline-logo.png", color: "#00d4ff" },
  { title: "BIMABRO", desc: "Employee Portal", url: "https://employee.bimabro.com/", img: "/images/bimabro-logo.jpg", color: "#7b2fff" },
  { title: "ZOHO", desc: "Manage Engine", url: "https://sdpondemand.manageengine.com/app/itdesk/HomePage.do", img: "/images/zoho-logo.png", color: "#00ff88" },
  { title: "QMS", desc: "Quote Comparison", url: "https://smartworlddevelopersonline.com/qms/home/logout", img: "/images/Qms-logo.jpg", color: "#0066ff" },
  { title: "4QT", desc: "CRM", url: "https://crm.smartworlddevelopers.com/4qt/", img: "/images/4QT-logo.png", color: "#ff6b00" },
  { title: "SFDC", desc: "Salesforce", url: "https://smartworld.my.salesforce.com/", img: "/images/Salesforce-logo.jpg", color: "#00d4ff" },

  // UPDATED: MAFOI changed to PRO HR
  { title: "PRO HR", desc: "HR Portal", url: "https://apps.prohr.in/N", img: "/images/prohr-logo.svg", color: "#7b2fff" },

  { title: "VENDORGLOBE", desc: "QMS Portal", url: "https://smartworlddevelopersonline.com/qms/", img: "/images/vendorglobe.png", color: "#00ff88" },
  { title: "Gift App", desc: "Vistaoffers", url: "https://vistaoffers.com/#login", img: "/images/GEMBA.png", color: "#ff6b00" },
  { title: "Vista-ERP", desc: "ERP System", url: "https://vistaerponline.com/#login", img: "/images/GEMBA.png", color: "#0066ff" },
  { title: "Company", desc: "Website", url: "https://smartworlddevelopers.com/", img: "/images/company-logo.png", color: "#00d4ff" },
  { title: "Projects", desc: "Developments", url: "#", img: "/images/projects-icon.png", color: "#7b2fff", isDropdown: true },
];

const CyberCard = ({ children, style = {}, color = "#00d4ff", hover = true }) => {
  const [hov, setHov] = useState(false);

  return (
    <div
      className="home-card"
      onMouseEnter={() => hover && setHov(true)}
      onMouseLeave={() => hover && setHov(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        transition: "all .3s",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg,transparent,${color}80,transparent)`,
          opacity: .4
        }}
      />
      {children}
    </div>
  );
};

const Home = () => {
  const { isAdmin } = useAuth();
  const [bannerIdx, setBannerIdx] = useState(0);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [joineeIdx, setJoineeIdx] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [todoItems, setTodoItems] = useState([
    { id: 1, text: "Review monthly reports", completed: false },
    { id: 2, text: "Schedule team meeting", completed: true },
    { id: 3, text: "Update employee profiles", completed: false },
  ]);
  const [newTodoText, setNewTodoText] = useState("");
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("userTodos");
    if (saved) setTodoItems(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await employeeAPI.getAll();
        const now = new Date();
        const ago = new Date();
        ago.setDate(now.getDate() - 30);

        let recent = data.filter(e => {
          const df = e.dateOfJoining || e.date_of_joining;
          if (!df) return false;

          const d =
            typeof df === "string"
              ? new Date(df)
              : new Date(new Date(1900, 0, 1).getTime() + (df - 2) * 86400000);

          return !isNaN(d) && d >= ago && d <= now;
        });

        if (!recent.length) {
          recent = data
            .filter(e => e.dateOfJoining || e.date_of_joining)
            .sort(
              (a, b) =>
                new Date(b.dateOfJoining || b.date_of_joining) -
                new Date(a.dateOfJoining || a.date_of_joining)
            )
            .slice(0, 15);
        }

        setEmployees(recent.slice(0, 15));
      } catch (e) {
        setEmployees([]);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setBannerIdx(i => (i + 1) % bannerImages.length);
    }, 5000);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setGalleryIdx(i => (i + 1) % galleryImages.length);
    }, 4000);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (employees.length > 3) {
      const t = setInterval(() => {
        setJoineeIdx(i => (i + 1) % employees.length);
      }, 3000);

      return () => clearInterval(t);
    }
  }, [employees.length]);

  const saveTodos = items => {
    setTodoItems(items);
    localStorage.setItem("userTodos", JSON.stringify(items));
  };

  const addTodo = () => {
    if (newTodoText.trim()) {
      saveTodos([
        ...todoItems,
        {
          id: Date.now(),
          text: newTodoText.trim(),
          completed: false
        }
      ]);
      setNewTodoText("");
      setShowAddTodo(false);
    }
  };

  const toggleTodo = id =>
    saveTodos(
      todoItems.map(t =>
        t.id === id ? { ...t, completed: !t.completed } : t
      )
    );

  const removeTodo = id =>
    saveTodos(todoItems.filter(t => t.id !== id));

  const fmtDate = d => {
    try {
      const dt = new Date(d);
      return isNaN(dt)
        ? "N/A"
        : dt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });
    } catch (e) {
      return "N/A";
    }
  };

  const cs = {
    sectionTitle: {
      fontFamily: "'Orbitron', monospace",
      fontSize: ".55rem",
      letterSpacing: ".2em",
      color: "rgba(0,212,255,0.5)",
      textTransform: "uppercase",
      marginBottom: 8
    },
    btn: (c = "#00d4ff") => ({
      background: "transparent",
      border: `1px solid ${c}50`,
      color: c,
      fontFamily: "'Orbitron', monospace",
      fontSize: ".58rem",
      letterSpacing: ".1em",
      padding: "5px 12px",
      borderRadius: 4,
      cursor: "pointer",
      transition: "all .2s",
      display: "flex",
      alignItems: "center",
      gap: 4
    }),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 16 }}>

      {/* === BANNER === */}
      <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", height: 180 }}>
        <div
          style={{
            display: "flex",
            transition: "transform .7s ease",
            transform: `translateX(-${bannerIdx * 100}%)`,
            height: "100%"
          }}
        >
          {bannerImages.map((src, i) => (
            <div key={i} style={{ minWidth: "100%", height: "100%", position: "relative", flexShrink: 0 }}>
              <img
                src={src}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={e => e.target.style.display = "none"}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(135deg, rgba(2,8,22,0.6) 0%, rgba(2,8,22,0.2) 100%)"
                }}
              />
              <div style={{ position: "absolute", bottom: 16, left: 20 }}>
                <div
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontWeight: 800,
                    fontSize: "1.3rem",
                    color: "#fff",
                    textShadow: "0 0 20px rgba(0,212,255,0.5)",
                    letterSpacing: ".1em"
                  }}
                >
                  WELCOME TO SMARTWORLD
                </div>
                <div
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: ".7rem",
                    color: "rgba(0,212,255,0.8)",
                    letterSpacing: ".2em",
                    marginTop: 4
                  }}
                >
                  BUILDING FUTURE HOMES
                </div>
              </div>
            </div>
          ))}
        </div>

        {[["prev", "left", 4], ["next", "right", 4]].map(([d, side, pos]) => (
          <button
            key={d}
            onClick={() =>
              setBannerIdx(i =>
                d === "next"
                  ? (i + 1) % bannerImages.length
                  : (i - 1 + bannerImages.length) % bannerImages.length
              )
            }
            style={{
              position: "absolute",
              [side]: pos,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(0,212,255,0.4)",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#00d4ff"
            }}
          >
            {d === "prev" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        ))}

        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 5
          }}
        >
          {bannerImages.map((_, i) => (
            <div
              key={i}
              onClick={() => setBannerIdx(i)}
              style={{
                width: i === bannerIdx ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === bannerIdx ? "#00d4ff" : "rgba(0,212,255,0.3)",
                cursor: "pointer",
                transition: "all .3s"
              }}
            />
          ))}
        </div>
      </div>

      {/* === QUICK LINKS GRID === */}
      <div>
        <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:".62rem", fontWeight:700, color:"var(--text-muted)", letterSpacing:".12em", textTransform:"uppercase", marginBottom:10 }}>
          Quick Access Portals
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(12, minmax(0, 1fr))", gap:6 }}>
          {quickLinks.map((lnk, i) => (
            <div key={i} style={{ position:"relative", minWidth:0 }}>
              <div
                className="ql-card"
                onClick={() => lnk.isDropdown ? setShowProjects(!showProjects) : window.open(lnk.url, "_blank")}
                title={`${lnk.title} — ${lnk.desc}`}
              >
                {/* Image only, no background box */}
                <div className="ql-img-wrap">
                  <img
                    src={lnk.img}
                    alt={lnk.title}
                    onError={e => {
                      e.currentTarget.parentNode.innerHTML = `<div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,${lnk.color}40,${lnk.color}20);display:flex;align-items:center;justify-content:center;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:800;color:${lnk.color}">${lnk.title.slice(0,2)}</div>`;
                    }}
                  />
                </div>
                <div className="ql-label">{lnk.title}</div>
                <div className="ql-sublabel">{lnk.desc}</div>
              </div>

              {/* Projects dropdown */}
              {lnk.isDropdown && showProjects && (
                <div style={{ position:"absolute", top:"105%", right:0, zIndex:50, background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, overflow:"hidden", minWidth:180, boxShadow:"var(--shadow-card)" }}>
                  {projectLinks.map((p, j) => (
                    <div key={j}
                      onClick={() => { window.open(p.url, "_blank"); setShowProjects(false); }}
                      style={{ padding:"8px 14px", fontFamily:"'DM Sans',sans-serif", fontSize:".75rem", color:"var(--text-secondary)", borderBottom:"1px solid var(--border)", transition:"background .15s" }}
                      onMouseEnter={e => e.currentTarget.style.background="rgba(139,92,246,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}
                    >{p.name}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* === MAIN 3-COLUMN GRID === */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

        <CyberCard style={{ overflow: "hidden", height: 240 }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <img
              src={galleryImages[galleryIdx]}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity .5s" }}
              onError={e => e.target.style.opacity = "0"}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(2,8,22,0.5) 0%, rgba(2,8,22,0.2) 50%, rgba(2,8,22,0.7) 100%)"
              }}
            />
            <div style={{ position: "absolute", top: 10, left: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Image size={13} style={{ color: "#00d4ff" }} />
              <span
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: ".6rem",
                  color: "rgba(255,255,255,0.9)",
                  letterSpacing: ".1em"
                }}
              >
                GALLERY
              </span>
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 4
              }}
            >
              {galleryImages.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setGalleryIdx(i)}
                  style={{
                    width: i === galleryIdx ? 16 : 5,
                    height: 5,
                    borderRadius: 3,
                    background: i === galleryIdx ? "#00d4ff" : "rgba(255,255,255,0.3)",
                    cursor: "pointer",
                    transition: "all .3s"
                  }}
                />
              ))}
            </div>
          </div>
        </CyberCard>

        <CyberCard color="#7b2fff">
          <div style={{ padding: "12px 14px", height: 240, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Users size={13} style={{ color: "#7b2fff" }} />
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: ".62rem",
                    fontWeight: 700,
                    color: "#e0f4ff",
                    letterSpacing: ".08em"
                  }}
                >
                  NEW JOINEES
                </span>
              </div>
              <span
                style={{
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: ".55rem",
                  color: "#7b2fff",
                  letterSpacing: ".05em"
                }}
              >
                {employees.length} RECENT
              </span>
            </div>

            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
              {employees.length > 0 ? (
                <div style={{ transform: `translateY(-${joineeIdx * 46}px)`, transition: "transform 1s ease" }}>
                  {[...employees, ...employees.slice(0, 5)].map((emp, i) => (
                    <div
                      key={`${emp.id}-${i}`}
                      onClick={() => setSelectedEmployee(emp)}
                      style={{
                        background: "rgba(123,47,255,0.1)",
                        border: "1px solid rgba(123,47,255,0.25)",
                        borderRadius: 5,
                        padding: "7px 10px",
                        marginBottom: 6,
                        cursor: "pointer",
                        transition: "border-color .2s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(123,47,255,0.5)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(123,47,255,0.25)"}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span
                          style={{
                            fontFamily: "'Exo 2', sans-serif",
                            fontSize: ".72rem",
                            fontWeight: 600,
                            color: "#e0f4ff"
                          }}
                        >
                          {emp.name}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: ".55rem",
                            color: "rgba(122,184,212,0.5)"
                          }}
                        >
                          {fmtDate(emp.dateOfJoining)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontFamily: "'Exo 2', sans-serif",
                          fontSize: ".62rem",
                          color: "rgba(122,184,212,0.6)",
                          marginTop: 2
                        }}
                      >
                        {emp.department?.substring(0, 22)}
                        {emp.department?.length > 22 ? "…" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8 }}>
                  <Users size={24} style={{ color: "rgba(123,47,255,0.4)" }} />
                  <span
                    style={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: ".6rem",
                      color: "rgba(122,184,212,0.4)",
                      letterSpacing: ".1em"
                    }}
                  >
                    LOADING...
                  </span>
                </div>
              )}
            </div>
          </div>
        </CyberCard>

        <CyberCard color="#00ff88">
          <div style={{ padding: "12px 14px", height: 240, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CheckSquare size={13} style={{ color: "#00ff88" }} />
                <span
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: ".62rem",
                    fontWeight: 700,
                    color: "#e0f4ff",
                    letterSpacing: ".08em"
                  }}
                >
                  TO-DO LIST
                </span>
              </div>
              <button
                onClick={() => setShowAddTodo(!showAddTodo)}
                style={{
                  background: "rgba(0,255,136,0.1)",
                  border: "1px solid rgba(0,255,136,0.3)",
                  borderRadius: 4,
                  width: 22,
                  height: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#00ff88"
                }}
              >
                <Plus size={12} />
              </button>
            </div>

            {showAddTodo && (
              <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                <input
                  value={newTodoText}
                  onChange={e => setNewTodoText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTodo()}
                  placeholder="New task..."
                  style={{
                    flex: 1,
                    background: "rgba(0,20,40,0.8)",
                    border: "1px solid rgba(0,255,136,0.3)",
                    borderRadius: 4,
                    padding: "5px 8px",
                    color: "#e0f4ff",
                    fontFamily: "'Exo 2', sans-serif",
                    fontSize: ".7rem",
                    outline: "none"
                  }}
                />
                <button onClick={addTodo} style={{ ...cs.btn("#00ff88"), padding: "5px 8px", fontSize: ".6rem" }}>
                  ADD
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
              {todoItems.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    background: "rgba(0,255,136,0.04)",
                    border: "1px solid rgba(0,255,136,0.1)",
                    borderRadius: 5
                  }}
                >
                  <div
                    onClick={() => toggleTodo(item.id)}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: `1px solid ${item.completed ? "#00ff88" : "rgba(0,255,136,0.3)"}`,
                      background: item.completed ? "rgba(0,255,136,0.2)" : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    {item.completed && <span style={{ color: "#00ff88", fontSize: 9 }}>✓</span>}
                  </div>
                  <span
                    style={{
                      flex: 1,
                      fontFamily: "'Exo 2', sans-serif",
                      fontSize: ".7rem",
                      color: item.completed ? "rgba(122,184,212,0.4)" : "rgba(224,244,255,0.85)",
                      textDecoration: item.completed ? "line-through" : "none",
                      lineHeight: 1.3
                    }}
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => removeTodo(item.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(122,184,212,0.3)",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex"
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </CyberCard>
      </div>

      {/* === BOTTOM ROW === */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <CyberCard color="#ff6b00">
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <PartyPopper size={14} style={{ color: "#ff6b00" }} />
              <span
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: ".62rem",
                  fontWeight: 700,
                  color: "#e0f4ff",
                  letterSpacing: ".08em"
                }}
              >
                CELEBRATIONS
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: ".72rem",
                color: "rgba(122,184,212,0.6)",
                textAlign: "center",
                padding: "16px 0"
              }}
            >
              Birthdays, anniversaries &<br />achievements — coming soon
            </div>
          </div>
        </CyberCard>

        <CyberCard color="#0066ff">
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Newspaper size={14} style={{ color: "#0066ff" }} />
              <span
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: ".62rem",
                  fontWeight: 700,
                  color: "#e0f4ff",
                  letterSpacing: ".08em"
                }}
              >
                COMPANY NEWS
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: ".72rem",
                color: "rgba(122,184,212,0.6)",
                textAlign: "center",
                padding: "16px 0"
              }}
            >
              Daily updates & announcements<br />— coming soon
            </div>
          </div>
        </CyberCard>

        <CyberCard color="#7b2fff">
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Workflow size={14} style={{ color: "#7b2fff" }} />
              <span
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: ".62rem",
                  fontWeight: 700,
                  color: "#e0f4ff",
                  letterSpacing: ".08em"
                }}
              >
                WORKFLOW
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: ".72rem",
                color: "rgba(122,184,212,0.6)",
                textAlign: "center",
                padding: "16px 0"
              }}
            >
              Process management &<br />task tracking — coming soon
            </div>
          </div>
        </CyberCard>
      </div>

      {selectedEmployee && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200
          }}
          onClick={() => setSelectedEmployee(null)}
        >
          <div
            style={{
              background: "rgba(6,20,45,0.98)",
              border: "1px solid rgba(0,212,255,0.35)",
              borderRadius: 10,
              padding: "20px 24px",
              width: 320,
              position: "relative"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                background: "linear-gradient(90deg,transparent,#00d4ff,transparent)"
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: ".7rem",
                  fontWeight: 700,
                  color: "#00d4ff",
                  letterSpacing: ".1em"
                }}
              >
                PERSONNEL RECORD
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(122,184,212,0.6)",
                  cursor: "pointer"
                }}
              >
                <X size={16} />
              </button>
            </div>

            {[
              ["Name", selectedEmployee.name],
              ["ID", selectedEmployee.id || selectedEmployee.employeeId],
              ["Department", selectedEmployee.department],
              ["Designation", selectedEmployee.designation],
              ["Location", selectedEmployee.location],
              ["Joined", fmtDate(selectedEmployee.dateOfJoining)]
            ].map(([k, v]) => v ? (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px solid rgba(0,212,255,0.07)"
                }}
              >
                <span
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: ".6rem",
                    color: "rgba(0,212,255,0.5)",
                    letterSpacing: ".1em"
                  }}
                >
                  {k.toUpperCase()}
                </span>
                <span
                  style={{
                    fontFamily: "'Exo 2', sans-serif",
                    fontSize: ".72rem",
                    color: "#e0f4ff"
                  }}
                >
                  {v}
                </span>
              </div>
            ) : null)}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;