"use client";

import { useState, useEffect, useRef, ReactNode, useCallback } from "react";
import axios from "axios";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────
type Repo = { name: string; owner: string; url: string };
type PreviewData = { original: string; updated: string; diff: string };
type DiffLine = { type: "meta" | "hunk" | "add" | "remove" | "context"; text: string };
type PanelState = "normal" | "minimized" | "maximized";
type ActiveTab = "dashboard" | "history";

interface HistoryItem {
  repo: string;
  owner: string;
  pr: number;
  status: string;
  created_at: string;
  updated_readme: string;
  diff: string;
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────
function parseDiff(diff: string): DiffLine[] {
  if (!diff) return [];
  return diff.split("\n").map((line) => {
    if (line.startsWith("+++") || line.startsWith("---")) return { type: "meta", text: line };
    if (line.startsWith("@@")) return { type: "hunk", text: line };
    if (line.startsWith("+")) return { type: "add", text: line.slice(1) };
    if (line.startsWith("-")) return { type: "remove", text: line.slice(1) };
    return { type: "context", text: line };
  });
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconMinimize = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="6.5" width="10" height="1.5" rx="0.75" fill="currentColor" />
  </svg>
);
const IconMaximize = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);
const IconRestore = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="3.5" width="8.5" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M4.5 3.5V2.5A.5.5 0 015 2h6.5a.5.5 0 01.5.5V9a.5.5 0 01-.5.5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M9.5 2.5l2 2L5 11H3v-2l6.5-6.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
    <path d="M8 4l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const IconSave = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2h8l2 2v8H2V2z" stroke="currentColor" strokeWidth="1.4" fill="none" />
    <rect x="4" y="2" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
    <rect x="3.5" y="7.5" width="7" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
  </svg>
);
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M3 7.5L6.5 11L12 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M12 7A5 5 0 112 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 4V7H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconLoader = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="spin-icon">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
  </svg>
);
const IconDashboard = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M2 2h5v5H2V2zm6 0h5v5H8V2zM2 8h5v5H2V8zm6 0h5v5H8V8z" stroke="currentColor" strokeWidth="1.3" fill="none" />
  </svg>
);
const IconHistory = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M7.5 4.5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

// ─── Terminal Panel ───────────────────────────────────────────────────────────
interface TerminalPanelProps {
  title: string;
  subtitle?: string;
  accentColor: string;
  children: ReactNode;
  editable?: boolean;
  content?: string;
  onContentChange?: (val: string) => void;
  onSave?: () => void;
}

const TerminalPanel = ({
  title, subtitle, accentColor, children,
  editable = false, content = "", onContentChange, onSave,
}: TerminalPanelProps) => {
  const [panelState, setPanelState] = useState<PanelState>("normal");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  useEffect(() => { setEditContent(content); }, [content]);

  const handleSave = () => {
    onContentChange?.(editContent);
    onSave?.();
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  return (
    <div
      className={`terminal-panel state-${panelState}`}
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      <div className="panel-chrome">
        <div className="chrome-left">
          <div className="traffic-lights">
            <span className="tl tl-close" />
            <span className="tl tl-min" />
            <span className="tl tl-max" />
          </div>
          <div className="panel-title-block">
            <span className="panel-title">{title}</span>
            {subtitle && <span className="panel-subtitle">{subtitle}</span>}
          </div>
        </div>
        <div className="chrome-actions">
          {editable && !isEditing && (
            <button className="chrome-btn" onClick={() => setIsEditing(true)} title="Edit content">
              <IconEdit /><span>Edit</span>
            </button>
          )}
          {isEditing && (
            <>
              <button className="chrome-btn chrome-btn-save" onClick={handleSave} title="Save">
                <IconSave /><span>Save</span>
              </button>
              <button className="chrome-btn" onClick={handleCancelEdit} title="Cancel">
                <IconX /><span>Cancel</span>
              </button>
            </>
          )}
          <div className="chrome-divider" />
          <button
            className="chrome-btn"
            onClick={() => setPanelState(panelState === "minimized" ? "normal" : "minimized")}
            title={panelState === "minimized" ? "Restore" : "Minimize"}
          >
            <IconMinimize />
          </button>
          <button
            className="chrome-btn"
            onClick={() => setPanelState(panelState === "maximized" ? "normal" : "maximized")}
            title={panelState === "maximized" ? "Restore" : "Maximize"}
          >
            {panelState === "maximized" ? <IconRestore /> : <IconMaximize />}
          </button>
        </div>
      </div>

      {panelState !== "minimized" && (
        <div className="panel-body">
          <div className="panel-gutter">
            {Array.from({ length: 30 }, (_, i) => (
              <span key={i} className="line-num">{i + 1}</span>
            ))}
          </div>
          {isEditing ? (
            <textarea
              className="panel-editor"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <pre className="panel-content">{children}</pre>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Diff Viewer ──────────────────────────────────────────────────────────────
const DiffViewer = ({ diff }: { diff: string }) => {
  const lines = parseDiff(diff);
  return (
    <div className="diff-body">
      {lines.map((line, idx) => (
        <div key={idx} className={`diff-line dl-${line.type}`}>
          <span className="dl-prefix">
            {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
          </span>
          <span className="dl-text">{line.text}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ count, loading }: { count: number; loading: boolean }) => (
  <div className="status-badge">
    <span className={`status-dot ${loading ? "dot-pulse" : "dot-live"}`} />
    <span className="status-text">
      {loading ? "Connecting..." : `${count} repositories`}
    </span>
  </div>
);

// ─── Loading Overlay ──────────────────────────────────────────────────────────
const LoadingOverlay = ({ message }: { message: string }) => (
  <div className="loading-veil">
    <div className="loading-card">
      <div className="loading-ring">
        <svg viewBox="0 0 50 50" className="ring-svg">
          <circle cx="25" cy="25" r="20" fill="none" stroke="var(--amber)" strokeWidth="2.5"
            strokeDasharray="100" strokeDashoffset="60" strokeLinecap="round" />
        </svg>
      </div>
      <p className="loading-msg">{message}</p>
      <div className="loading-bar"><div className="loading-progress" /></div>
    </div>
  </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type }: { message: string; type: "success" | "error" }) => (
  <div className={`toast toast-${type}`}>
    <span className="toast-icon">{type === "success" ? <IconCheck /> : <IconX />}</span>
    <span className="toast-msg">{message}</span>
  </div>
);

// ─── History Card ─────────────────────────────────────────────────────────────
const HistoryCard = ({ item }: { item: HistoryItem }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`history-card ${expanded ? "history-card-expanded" : ""}`}>
      <div className="history-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="history-card-meta">
          <span className="history-repo">{item.owner}/{item.repo}</span>
          <span className={`history-status status-${item.status}`}>{item.status}</span>
        </div>
        <div className="history-card-info">
          <span className="history-pr">PR #{item.pr}</span>
          <span className="history-date">{formatDate(item.created_at)}</span>
          <span className={`history-chevron ${expanded ? "chevron-open" : ""}`}>
            <IconChevron />
          </span>
        </div>
      </div>

      {expanded && (
        <div className="history-panels">
          <TerminalPanel title="README.md" subtitle="Generated" accentColor="#10b981">
            {item.updated_readme || "No content available"}
          </TerminalPanel>
          {item.diff && (
            <TerminalPanel title="Changes" subtitle="Diff" accentColor="#f59e0b">
              <DiffViewer diff={item.diff} />
            </TerminalPanel>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [prNumber, setPrNumber] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [reposLoading, setReposLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [editedUpdated, setEditedUpdated] = useState("");
  // FIX: use a ref-backed state so that tab switching is always reliable
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFetched, setHistoryFetched] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // FIX: robust fetchHistory that tries both token keys and handles errors gracefully
  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      // Try both possible token storage keys
      const token = localStorage.getItem("token") || localStorage.getItem("github_token");
      if (!token) {
        showToast("Authentication required", "error");
        setHistoryLoading(false);
        return;
      }
      const res = await axios.get("https://auto-doc-latest.onrender.com/history/", 
        {                      
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      // Backend returns the array directly
      const data = Array.isArray(res.data) ? res.data : (res.data?.history ?? []);
      setHistory(data);
      setHistoryFetched(true);
    } catch (err: any) {
      if (!axios.isCancel(err)) {
        showToast("Failed to load history", "error");
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [showToast]);

  // Token handling — extract from URL on first load
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (token) {
      localStorage.setItem("token", token);
      window.history.replaceState({}, document.title, "/dashboard");
    }
  }, []);

  // FIX: fetch history when tab becomes "history", but only if not already fetched
  // or on manual refresh
  useEffect(() => {
    if (activeTab === "history" && !historyFetched) {
      fetchHistory();
    }
  }, [activeTab, historyFetched, fetchHistory]);

  // Three.js background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 12;

    const grid = new THREE.GridHelper(40, 40, 0x1e2030, 0x1e2030);
    (grid.material as THREE.Material).opacity = 0.6;
    (grid.material as THREE.Material).transparent = true;
    grid.rotation.x = Math.PI / 5;
    grid.position.y = -4;
    scene.add(grid);

    const nodeGroup = new THREE.Group();
    const sphereGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const colors = [0xf59e0b, 0x6366f1, 0x10b981, 0xef4444];
    for (let i = 0; i < 60; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.5 });
      const node = new THREE.Mesh(sphereGeo, mat);
      node.position.set((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8);
      nodeGroup.add(node);
    }
    scene.add(nodeGroup);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = Date.now() * 0.0002;
      nodeGroup.rotation.y = t * 0.15;
      grid.position.z = (t * 0.3) % 1;
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
    };
  }, []);

  // Load repos
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setReposLoading(true);
        const token = localStorage.getItem("token") || localStorage.getItem("github_token");
        if (!token) { showToast("Authentication required", "error"); return; }
        const res = await axios.get("https://auto-doc-latest.onrender.com/repo/list", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 10000,
        });
        if (!res.data?.repos) throw new Error("Invalid response");
        setRepos(res.data.repos);
      } catch (err: any) {
        if (!axios.isCancel(err)) showToast("Failed to load repositories", "error");
      } finally {
        setReposLoading(false);
      }
    })();
    return () => controller.abort();
  }, [showToast]);

  const handlePreview = async () => {
    if (!selectedRepo || !prNumber) {
      showToast("Select a repository and enter a PR number", "error");
      return;
    }
    const token = localStorage.getItem("token") || localStorage.getItem("github_token");
    if (!token) return showToast("Not authenticated", "error");

    const msgs = [
      "Fetching pull request data...",
      "Analysing changeset...",
      "Generating README update...",
      "Finalising preview...",
    ];
    let i = 0;
    let interval: NodeJS.Timeout | null = null;

    try {
      setLoading(true);
      setPreview(null);
      setLoadingMsg(msgs[0]);
      interval = setInterval(() => {
        i = Math.min(i + 1, msgs.length - 1);
        setLoadingMsg(msgs[i]);
      }, 900);

      const res = await axios.post<PreviewData>(
        `https://auto-doc-latest.onrender.com/pr/preview`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { owner: selectedRepo.owner, repo: selectedRepo.name, pr: prNumber },
        }
      );

      setPreview(res.data);
      setEditedUpdated(res.data.updated);
      showToast("Preview generated successfully", "success");
    } catch {
      showToast("Preview generation failed", "error");
    } finally {
      if (interval) clearInterval(interval);
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handleAccept = async () => {
    if (!selectedRepo || !preview) return;
    try {
      setLoading(true);
      const token = localStorage.getItem("token") || localStorage.getItem("github_token");
      await axios.post(
        `https://auto-doc-latest.onrender.com/pr/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            owner: selectedRepo.owner,
            repo: selectedRepo.name,
            pr: prNumber,
            updated: editedUpdated,
            original: preview.original,
          },
        }
      );
      showToast("Changes pushed to GitHub successfully", "success");
      setPreview(null);
      // Invalidate history cache so next visit re-fetches
      setHistoryFetched(false);
    } catch {
      showToast("Push to GitHub failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    setPreview(null);
    showToast("Changes discarded", "error");
  };

  // FIX: Use button elements instead of anchor tags for tab navigation.
  // Anchor tags with href="#" interact with Next.js router and can cause
  // page re-renders or scroll jumps that reset component state.
  const handleNav = (tab: ActiveTab) => {
    setActiveTab(tab);
    // If switching to history, allow re-fetch if not fetched yet
    if (tab === "history" && !historyFetched) {
      fetchHistory();
    }
  };

  const handleHistoryRefresh = () => {
    setHistoryFetched(false);
    fetchHistory();
  };

  return (
    <div className="root">
      <canvas ref={canvasRef} className="bg-canvas" />

      <div className="shell">
        {/* ── Sidebar ─────────────────────────────── */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
                <rect x="2" y="2" width="10" height="10" rx="2" fill="var(--amber)" />
                <rect x="16" y="2" width="10" height="10" rx="2" fill="var(--slate-500)" />
                <rect x="2" y="16" width="10" height="10" rx="2" fill="var(--slate-500)" />
                <rect x="16" y="16" width="10" height="10" rx="2" fill="var(--amber)" opacity="0.4" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-name">AutoDoc</span>
              <span className="brand-sub">AI</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <span className="nav-section-label">Workspace</span>
            {/* FIX: Use <button> instead of <a href="#"> to prevent Next.js router interference */}
            <button
              type="button"
              className={`nav-item ${activeTab === "dashboard" ? "nav-active" : ""}`}
              onClick={() => handleNav("dashboard")}
            >
              <IconDashboard />
              Dashboard
            </button>
            <button
              type="button"
              className={`nav-item ${activeTab === "history" ? "nav-active" : ""}`}
              onClick={() => handleNav("history")}
            >
              <IconHistory />
              History
            </button>
          </nav>

          <div className="sidebar-footer">
            <StatusBadge count={repos.length} loading={reposLoading} />
          </div>
        </aside>

        {/* ── Main ────────────────────────────────── */}
        <main className="main">

          {/* Top bar */}
          <header className="topbar">
            <div className="topbar-left">
              <h1 className="page-title">
                {activeTab === "dashboard" ? "Documentation Generator" : "History"}
              </h1>
              <p className="page-sub">
                {activeTab === "dashboard"
                  ? "Analyse pull requests and auto-update README files"
                  : "Previously generated README updates"}
              </p>
            </div>
            <div className="topbar-right">
              {activeTab === "dashboard" && preview && (
                <div className="action-group">
                  <button className="btn btn-ghost" onClick={handleReject} disabled={loading}>
                    <IconX />Discard
                  </button>
                  <button className="btn btn-primary" onClick={handleAccept} disabled={loading}>
                    {loading ? <IconLoader /> : <IconCheck />}
                    {loading ? "Pushing..." : "Accept & Push"}
                  </button>
                </div>
              )}
              {activeTab === "history" && (
                <button className="btn btn-ghost" onClick={handleHistoryRefresh} disabled={historyLoading}>
                  {historyLoading ? <IconLoader /> : <IconRefresh />}
                  Refresh
                </button>
              )}
            </div>
          </header>

          {/* ══════════════════════════════
              DASHBOARD TAB
          ══════════════════════════════ */}
          {activeTab === "dashboard" && (
            <>
              <section className="control-card">
                <div className="control-card-inner">
                  <div className="field-group">
                    <label className="field-label">Repository</label>
                    <div className="select-wrapper">
                      <select
                        className="field-select"
                        value={selectedRepo ? `${selectedRepo.owner}/${selectedRepo.name}` : ""}
                        onChange={(e) => {
                          if (!e.target.value) { setSelectedRepo(null); return; }
                          const [owner, name] = e.target.value.split("/");
                          const repo = repos.find((r) => r.name === name && r.owner === owner);
                          if (repo) setSelectedRepo(repo);
                        }}
                        disabled={reposLoading || loading}
                      >
                        <option value="">Select a repository</option>
                        {repos.map((r) => (
                          <option key={`${r.owner}/${r.name}`} value={`${r.owner}/${r.name}`}>
                            {r.owner}/{r.name}
                          </option>
                        ))}
                      </select>
                      <span className="select-arrow"><IconChevron /></span>
                    </div>
                  </div>

                  <div className="field-divider" />

                  <div className="field-group field-group-sm">
                    <label className="field-label">PR Number</label>
                    <input
                      type="number"
                      className="field-input"
                      placeholder="#"
                      value={prNumber}
                      onChange={(e) => setPrNumber(e.target.value)}
                      disabled={loading}
                      min="1"
                    />
                  </div>

                  <button
                    className="btn btn-generate"
                    onClick={handlePreview}
                    disabled={loading || !selectedRepo || !prNumber}
                  >
                    {loading
                      ? <><IconLoader /> Processing</>
                      : <><IconRefresh /> Generate Preview</>
                    }
                  </button>
                </div>

                {selectedRepo && (
                  <div className="control-meta">
                    <span className="meta-tag">{selectedRepo.owner}</span>
                    <span className="meta-sep">/</span>
                    <span className="meta-tag meta-tag-primary">{selectedRepo.name}</span>
                    {prNumber && (
                      <><span className="meta-sep">·</span><span className="meta-tag">PR #{prNumber}</span></>
                    )}
                  </div>
                )}
              </section>

              {preview && (
                <section className="panels-section">
                  <div className="panels-header">
                    <h2 className="panels-title">README Comparison</h2>
                    <span className="panels-hint">Panels can be minimised or expanded independently</span>
                  </div>
                  <div className="panels-grid">
                    <TerminalPanel title="README.md" subtitle="Current" accentColor="#6366f1">
                      {preview.original}
                    </TerminalPanel>
                    <TerminalPanel title="Changes" subtitle="Diff" accentColor="#f59e0b">
                      <DiffViewer diff={preview.diff} />
                    </TerminalPanel>
                    <TerminalPanel
                      title="README.md" subtitle="Generated" accentColor="#10b981"
                      editable content={editedUpdated} onContentChange={setEditedUpdated}
                    >
                      {editedUpdated}
                    </TerminalPanel>
                  </div>
                </section>
              )}

              {!preview && !loading && (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                      <rect x="4" y="4" width="28" height="36" rx="3" stroke="var(--slate-500)" strokeWidth="1.5" />
                      <path d="M10 14h16M10 20h12M10 26h8" stroke="var(--slate-500)" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="34" cy="34" r="8" fill="var(--bg-1)" stroke="var(--amber)" strokeWidth="1.5" />
                      <path d="M31 34h6M34 31v6" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="empty-title">No preview generated</p>
                  <p className="empty-sub">Select a repository, enter a PR number, and click Generate Preview</p>
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════
              HISTORY TAB
          ══════════════════════════════ */}
          {activeTab === "history" && (
            <section className="history-section">
              {historyLoading ? (
                <div className="empty-state">
                  <div className="loading-ring" style={{ width: 40, height: 40 }}>
                    <svg viewBox="0 0 50 50" className="ring-svg" style={{ width: 40, height: 40 }}>
                      <circle cx="25" cy="25" r="20" fill="none" stroke="var(--amber)"
                        strokeWidth="3" strokeDasharray="100" strokeDashoffset="60" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="empty-title">Loading history...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <circle cx="20" cy="20" r="16" stroke="var(--slate-500)" strokeWidth="1.5" />
                      <path d="M20 12v9l5 4" stroke="var(--slate-500)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="empty-title">No history found</p>
                  <p className="empty-sub">Accepted README updates will appear here</p>
                </div>
              ) : (
                <div className="history-list">
                  {history.map((item, idx) => (
                    <HistoryCard key={`${item.repo}-${item.pr}-${idx}`} item={item} />
                  ))}
                </div>
              )}
            </section>
          )}

        </main>
      </div>

      {loading && <LoadingOverlay message={loadingMsg} />}
      {toast && <Toast message={toast.message} type={toast.type} />}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --amber: #f59e0b;
          --amber-dim: rgba(245, 158, 11, 0.12);
          --amber-border: rgba(245, 158, 11, 0.25);
          --indigo: #6366f1;
          --emerald: #10b981;
          --red: #ef4444;

          --bg-0: #07090f;
          --bg-1: #0d1117;
          --bg-2: #111620;
          --bg-3: #161c28;
          --bg-4: #1c2333;

          --slate-500: #4a5880;
          --slate-400: #6b7ea8;
          --slate-300: #8fa0c4;
          --slate-200: #b8c5df;
          --slate-700: #263045;
          --slate-600: #334060;

          --text-primary:   #eef2fa;
          --text-secondary: #8fa0c4;
          --text-muted:     #4a5880;

          --border:        rgba(255,255,255,0.06);
          --border-strong: rgba(255,255,255,0.10);

          --font-mono: 'IBM Plex Mono', 'SF Mono', 'Fira Code', monospace;
          --font-sans: 'IBM Plex Sans', system-ui, sans-serif;

          --radius-sm: 6px;
          --radius:    10px;
          --radius-lg: 16px;
          --radius-xl: 20px;
        }

        html, body {
          background: var(--bg-0);
          color: var(--text-primary);
          font-family: var(--font-sans);
          font-size: 14px;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
        }

        .root { min-height: 100vh; position: relative; overflow-x: hidden; }

        .bg-canvas {
          position: fixed; inset: 0; width: 100%; height: 100%;
          z-index: 0; pointer-events: none; opacity: 0.4;
        }

        .shell { display: flex; min-height: 100vh; position: relative; z-index: 1; }

        /* ── Sidebar ─────────────────── */
        .sidebar {
          width: 220px; flex-shrink: 0;
          background: var(--bg-1); border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          padding: 24px 0;
          position: sticky; top: 0; height: 100vh; overflow-y: auto;
        }

        .brand {
          display: flex; align-items: center; gap: 12px;
          padding: 0 20px 28px;
          border-bottom: 1px solid var(--border); margin-bottom: 16px;
        }

        .brand-mark { flex-shrink: 0; }
        .brand-text { display: flex; align-items: baseline; gap: 4px; }

        .brand-name {
          font-family: var(--font-mono); font-weight: 600;
          font-size: 15px; color: var(--text-primary); letter-spacing: -0.02em;
        }

        .brand-sub {
          font-family: var(--font-mono); font-size: 11px; font-weight: 500;
          color: var(--amber); background: var(--amber-dim);
          border: 1px solid var(--amber-border);
          padding: 1px 6px; border-radius: 4px; letter-spacing: 0.05em;
        }

        .sidebar-nav {
          flex: 1; padding: 0 12px;
          display: flex; flex-direction: column; gap: 2px;
        }

        .nav-section-label {
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--text-muted);
          padding: 0 8px; margin-bottom: 6px; margin-top: 4px;
        }

        /* FIX: nav-item is now a button — reset button defaults, keep visual style */
        .nav-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%;
          padding: 9px 10px; border-radius: var(--radius-sm);
          color: var(--slate-400); text-decoration: none;
          font-size: 13.5px; font-weight: 500;
          transition: all 0.15s ease; cursor: pointer;
          border: 1px solid transparent;
          background: transparent;
          font-family: var(--font-sans);
          text-align: left;
          user-select: none;
        }

        .nav-item:hover { background: var(--bg-3); color: var(--text-primary); }

        .nav-active {
          background: var(--amber-dim) !important;
          color: var(--amber) !important;
          border-color: var(--amber-border) !important;
        }

        .sidebar-footer {
          padding: 16px 20px 0; border-top: 1px solid var(--border); margin-top: 16px;
        }

        .status-badge { display: flex; align-items: center; gap: 8px; }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; }
        .dot-live { background: var(--emerald); box-shadow: 0 0 6px var(--emerald); }
        .dot-pulse { background: var(--amber); animation: pulse 1.2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

        .status-text {
          font-size: 12px; color: var(--text-secondary); font-family: var(--font-mono);
        }

        /* ── Main ────────────────────── */
        .main {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column;
          background: var(--bg-0); overflow-y: auto;
        }

        .topbar {
          display: flex; align-items: flex-start;
          justify-content: space-between;
          padding: 28px 32px 20px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-1); gap: 24px; flex-shrink: 0;
        }

        .page-title {
          font-family: var(--font-sans); font-size: 22px; font-weight: 700;
          color: var(--text-primary); letter-spacing: -0.02em; line-height: 1.2;
        }

        .page-sub { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

        .topbar-right { display: flex; align-items: center; padding-top: 4px; }

        .action-group { display: flex; gap: 10px; align-items: center; }

        /* ── Buttons ─────────────────── */
        .btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; border-radius: var(--radius-sm);
          font-size: 13.5px; font-weight: 600; font-family: var(--font-sans);
          cursor: pointer; border: none;
          transition: all 0.15s ease; white-space: nowrap; line-height: 1;
        }
        .btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .btn svg { flex-shrink: 0; }

        .btn-primary {
          background: var(--emerald); color: #fff;
          box-shadow: 0 0 16px rgba(16,185,129,0.3);
        }
        .btn-primary:hover:not(:disabled) {
          background: #0ea572; box-shadow: 0 0 24px rgba(16,185,129,0.45);
        }

        .btn-ghost {
          background: transparent; color: var(--text-secondary);
          border: 1px solid var(--border-strong);
        }
        .btn-ghost:hover:not(:disabled) {
          background: var(--bg-3); color: var(--text-primary); border-color: var(--slate-600);
        }

        .btn-generate {
          background: var(--amber); color: #0a0a0a;
          font-weight: 700; flex-shrink: 0;
          padding: 10px 22px; border-radius: var(--radius-sm);
          box-shadow: 0 0 18px rgba(245,158,11,0.25); height: 42px;
        }
        .btn-generate:hover:not(:disabled) {
          background: #fbbf24; box-shadow: 0 0 28px rgba(245,158,11,0.4);
        }
        .btn-generate:disabled {
          background: var(--slate-700); color: var(--text-muted); box-shadow: none;
        }

        /* ── Control Card ────────────── */
        .control-card {
          margin: 24px 32px;
          background: var(--bg-1); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden; flex-shrink: 0;
        }

        .control-card-inner {
          display: flex; align-items: flex-end; gap: 0; padding: 20px 24px;
        }

        .field-group { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
        .field-group-sm { max-width: 140px; }

        .field-label {
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted);
        }

        .select-wrapper { position: relative; }

        .field-select, .field-input {
          width: 100%; padding: 10px 14px;
          background: var(--bg-3); border: 1px solid var(--border-strong);
          border-radius: var(--radius-sm); color: var(--text-primary);
          font-family: var(--font-mono); font-size: 13px;
          transition: all 0.15s ease;
          appearance: none; -webkit-appearance: none; height: 42px;
        }
        .field-select:focus, .field-input:focus {
          outline: none; border-color: var(--amber);
          background: var(--bg-4); box-shadow: 0 0 0 3px var(--amber-dim);
        }
        .field-select:disabled, .field-input:disabled { opacity: 0.4; cursor: not-allowed; }

        .select-arrow {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%); color: var(--text-muted); pointer-events: none; display: flex;
        }

        .field-divider {
          width: 1px; height: 42px; background: var(--border);
          margin: 0 20px; align-self: flex-end;
        }

        .control-meta {
          padding: 12px 24px; border-top: 1px solid var(--border);
          background: var(--bg-2); display: flex; align-items: center; gap: 6px;
        }

        .meta-tag {
          font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);
          background: var(--bg-4); border: 1px solid var(--border);
          padding: 2px 8px; border-radius: 4px;
        }

        .meta-tag-primary {
          color: var(--amber); border-color: var(--amber-border); background: var(--amber-dim);
        }

        .meta-sep { color: var(--text-muted); font-size: 12px; }

        /* ── Panels Section ──────────── */
        .panels-section { padding: 0 32px 32px; }

        .panels-header {
          display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px;
        }

        .panels-title {
          font-size: 16px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em;
        }

        .panels-hint { font-size: 12px; color: var(--text-muted); font-family: var(--font-mono); }

        .panels-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

        /* ── Terminal Panel ──────────── */
        .terminal-panel {
          background: var(--bg-1); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
          display: flex; flex-direction: column; transition: all 0.25s ease;
        }

        .terminal-panel.state-maximized {
          position: fixed; inset: 24px; z-index: 600; max-height: none;
          border-color: var(--accent, var(--border));
          box-shadow: 0 40px 80px rgba(0,0,0,0.85);
        }

        .panel-chrome {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 14px; height: 44px;
          background: var(--bg-2); border-bottom: 1px solid var(--border);
          flex-shrink: 0; gap: 10px;
        }

        .chrome-left { display: flex; align-items: center; gap: 12px; min-width: 0; }

        .traffic-lights { display: flex; gap: 5px; flex-shrink: 0; }
        .tl { width: 10px; height: 10px; border-radius: 50%; }
        .tl-close { background: #ff5f57; }
        .tl-min   { background: #febc2e; }
        .tl-max   { background: #28c840; }

        .panel-title-block { display: flex; align-items: baseline; gap: 8px; min-width: 0; }

        .panel-title {
          font-family: var(--font-mono); font-size: 12.5px; font-weight: 600;
          color: var(--text-primary); white-space: nowrap;
        }

        .panel-subtitle {
          font-family: var(--font-mono); font-size: 10.5px; font-weight: 500;
          color: var(--accent, var(--text-muted));
          background: color-mix(in srgb, var(--accent, var(--slate-500)) 15%, transparent);
          border: 1px solid color-mix(in srgb, var(--accent, var(--slate-500)) 30%, transparent);
          padding: 1px 7px; border-radius: 3px;
        }

        .chrome-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

        .chrome-divider { width: 1px; height: 16px; background: var(--border); margin: 0 4px; }

        .chrome-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 9px; border-radius: 4px;
          background: transparent; border: 1px solid transparent;
          color: var(--text-muted); font-size: 11.5px; font-weight: 500;
          font-family: var(--font-sans); cursor: pointer;
          transition: all 0.12s ease; line-height: 1;
        }
        .chrome-btn:hover {
          background: var(--bg-4); border-color: var(--border-strong); color: var(--text-primary);
        }
        .chrome-btn-save { color: var(--emerald); }
        .chrome-btn-save:hover {
          background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: var(--emerald);
        }

        .panel-body {
          display: flex; flex: 1; overflow: hidden; min-height: 0; max-height: 520px;
        }
        .state-maximized .panel-body { max-height: none; height: calc(100% - 44px); }

        .panel-gutter {
          display: flex; flex-direction: column; align-items: flex-end;
          padding: 16px 10px 16px 14px;
          background: var(--bg-2); border-right: 1px solid var(--border);
          min-width: 40px; user-select: none; overflow: hidden; flex-shrink: 0;
        }

        .line-num {
          font-family: var(--font-mono); font-size: 11px;
          line-height: 1.8; color: var(--text-muted); opacity: 0.5;
        }

        .panel-content {
          flex: 1; padding: 16px;
          font-family: var(--font-mono); font-size: 12px;
          line-height: 1.8; color: var(--slate-200);
          white-space: pre-wrap; word-break: break-word;
          overflow-y: auto; background: transparent; min-width: 0;
        }

        .panel-editor {
          flex: 1; padding: 16px;
          font-family: var(--font-mono); font-size: 12px;
          line-height: 1.8; color: var(--slate-200);
          background: var(--bg-4); border: none; outline: none;
          resize: none; min-height: 100%; width: 100%;
        }

        /* ── Diff ────────────────────── */
        .diff-body { font-family: var(--font-mono); font-size: 12px; line-height: 1.8; width: 100%; }

        .diff-line { display: flex; align-items: flex-start; gap: 8px; padding: 0 2px; border-radius: 2px; }
        .dl-prefix { flex-shrink: 0; width: 14px; text-align: center; font-weight: 700; opacity: 0.7; }
        .dl-text { flex: 1; word-break: break-all; }

        .dl-meta    { color: #a78bfa; }
        .dl-hunk    { color: var(--amber); background: rgba(245,158,11,0.08); border-radius: 3px; padding: 0 4px; }
        .dl-add     { color: var(--emerald); background: rgba(16,185,129,0.1); border-radius: 2px; }
        .dl-remove  { color: #f87171; background: rgba(239,68,68,0.1); border-radius: 2px; text-decoration: line-through; opacity: 0.85; }
        .dl-context { color: var(--slate-300); }

        /* ── History ─────────────────── */
        .history-section { padding: 24px 32px; flex: 1; }
        .history-list { display: flex; flex-direction: column; gap: 12px; }

        .history-card {
          background: var(--bg-1); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
          transition: border-color 0.2s ease;
        }
        .history-card:hover { border-color: var(--border-strong); }
        .history-card-expanded { border-color: var(--slate-600); }

        .history-card-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; cursor: pointer; transition: background 0.15s ease;
        }
        .history-card-header:hover { background: var(--bg-2); }

        .history-card-meta { display: flex; align-items: center; gap: 12px; }

        .history-repo {
          font-family: var(--font-mono); font-size: 13px;
          font-weight: 600; color: var(--text-primary);
        }

        .history-status {
          font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
          text-transform: uppercase; letter-spacing: 0.06em;
        }

        .status-accepted {
          background: rgba(16,185,129,0.15); color: var(--emerald);
          border: 1px solid rgba(16,185,129,0.3);
        }
        .status-rejected {
          background: rgba(239,68,68,0.12); color: #f87171;
          border: 1px solid rgba(239,68,68,0.25);
        }
        .status-pending {
          background: var(--amber-dim); color: var(--amber);
          border: 1px solid var(--amber-border);
        }

        .history-card-info { display: flex; align-items: center; gap: 16px; }

        .history-pr {
          font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);
          background: var(--bg-4); border: 1px solid var(--border);
          padding: 2px 8px; border-radius: 4px;
        }

        .history-date { font-family: var(--font-mono); font-size: 11.5px; color: var(--text-muted); }

        .history-chevron { color: var(--text-muted); display: flex; transition: transform 0.2s ease; }
        .chevron-open { transform: rotate(180deg); }

        .history-panels {
          padding: 0 16px 16px;
          display: flex; flex-direction: column; gap: 12px;
          border-top: 1px solid var(--border);
        }

        /* ── Empty State ─────────────── */
        .empty-state {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 80px 32px; gap: 12px; color: var(--text-muted);
        }
        .empty-icon { opacity: 0.5; margin-bottom: 8px; }
        .empty-title { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
        .empty-sub {
          font-size: 13px; color: var(--text-muted);
          text-align: center; max-width: 360px; line-height: 1.6;
        }

        /* ── Loading Overlay ─────────── */
        .loading-veil {
          position: fixed; inset: 0; background: rgba(7,9,15,0.85);
          backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center; z-index: 900;
        }
        .loading-card {
          background: var(--bg-1); border: 1px solid var(--border-strong);
          border-radius: var(--radius-xl); padding: 40px 48px;
          display: flex; flex-direction: column; align-items: center;
          gap: 20px; min-width: 260px;
        }
        .loading-ring { width: 52px; height: 52px; }
        .ring-svg { width: 52px; height: 52px; animation: spin-ring 1.2s linear infinite; }
        @keyframes spin-ring { to { transform: rotate(360deg); } }
        .loading-msg {
          font-family: var(--font-mono); font-size: 13px;
          color: var(--text-secondary); text-align: center;
        }
        .loading-bar { width: 100%; height: 2px; background: var(--bg-4); border-radius: 2px; overflow: hidden; }
        .loading-progress {
          height: 100%;
          background: linear-gradient(90deg, transparent, var(--amber), transparent);
          width: 40%; animation: sweep 1.5s ease-in-out infinite;
        }
        @keyframes sweep { 0%{transform:translateX(-200%)} 100%{transform:translateX(400%)} }

        /* ── Toast ───────────────────── */
        .toast {
          position: fixed; top: 24px; right: 24px;
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px; border-radius: var(--radius);
          font-size: 13.5px; font-weight: 600; z-index: 1100;
          animation: slide-in 0.25s cubic-bezier(0.4,0,0.2,1) forwards;
          backdrop-filter: blur(20px); box-shadow: 0 16px 32px rgba(0,0,0,0.4);
        }
        .toast-success { background: rgba(16,185,129,0.92); color: #fff; border: 1px solid rgba(16,185,129,0.5); }
        .toast-error   { background: rgba(239,68,68,0.92);  color: #fff; border: 1px solid rgba(239,68,68,0.5); }
        .toast-icon { display: flex; }
        @keyframes slide-in {
          from { transform: translateX(calc(100% + 32px)); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }

        /* ── Spin ────────────────────── */
        .spin-icon { animation: spin-ring 0.9s linear infinite; }

        /* ── Scrollbars ──────────────── */
        .panel-content::-webkit-scrollbar,
        .panel-editor::-webkit-scrollbar  { width: 6px; }
        .panel-content::-webkit-scrollbar-track,
        .panel-editor::-webkit-scrollbar-track { background: transparent; }
        .panel-content::-webkit-scrollbar-thumb,
        .panel-editor::-webkit-scrollbar-thumb { background: var(--slate-700); border-radius: 3px; }

        /* ── Responsive ──────────────── */
        @media (max-width: 1100px) {
          .panels-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 860px) {
          .sidebar { display: none; }
          .control-card-inner { flex-direction: column; align-items: stretch; }
          .field-divider { width: 100%; height: 1px; margin: 12px 0; }
          .field-group-sm { max-width: none; }
          .topbar { flex-direction: column; gap: 12px; padding: 20px 16px; }
          .panels-section, .control-card, .history-section { margin-left: 16px; margin-right: 16px; }
        }
      `}</style>
    </div>
  );
}