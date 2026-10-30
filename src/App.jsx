import React, { useState, useEffect } from 'react';
import FeedView from './FeedView';
import PersonalityAnalysisView from './PersonalityAnalysisView';
import InsightsView from './InsightsView';
import AskView from './AskView';
import DeepKnowledgeView from './DeepKnowledgeView';
import OntologyView from './OntologyView';
import TokenCostTracker from './components/TokenCostTracker';
import EntityReconciliationModal from './components/EntityReconciliationModal';
import EpistemicTraceabilityView from './components/EpistemicTraceabilityView';
import EpistemicHealthModal from './components/EpistemicHealthModal';
import { 
  BookOpen, 
  Network, 
  Loader2, 
  Brain, 
  Sparkles, 
  Scale, 
  Settings, 
  X,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { getFirebaseUid, verifyPasscode, fetchSyncedIsaData } from './firebase';
import { useDiaryData, DiaryDataProvider } from './hooks/useDiaryData';

const FIREBASE_UID_FALLBACK = import.meta.env.VITE_FIREBASE_UID || 'K9j4Nx0WK7NKYJs6iDUz35LXFai1';

function PasscodeGate({ onVerified }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleKeyPress = (num) => {
    if (passcode.length < 6) {
      setError('');
      setPasscode(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setError('');
    setPasscode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError('');
    setPasscode('');
  };

  useEffect(() => {
    if (passcode.length === 6) {
      handleSubmit();
    }
  }, [passcode]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await verifyPasscode(passcode);
      if (response.status === 'success') {
        sessionStorage.setItem('okf_auth_token', response.token);
        onVerified();
      } else {
        setError(response.message || 'קוד גישה שגוי');
        setIsShaking(true);
        setPasscode('');
        setTimeout(() => setIsShaking(false), 500);
      }
    } catch (err) {
      console.error(err);
      setError('שגיאת תקשורת עם השרת');
      setIsShaking(true);
      setPasscode('');
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lockscreen-container">
      <div className="lockscreen-glow" />
      <div className={`lockscreen-card ${isShaking ? 'shake' : ''}`}>
        <div className="lockscreen-logo-area">
          <div className="lockscreen-logo-icon" style={{ background: 'transparent', boxShadow: 'none', width: 'auto', height: 'auto', padding: 0 }}>
            <img src="/logo.png" alt="לוגו זריחה בים" style={{ width: '64px', height: '64px', borderRadius: '14px', boxShadow: '0 8px 30px rgba(255, 126, 64, 0.25)' }} />
          </div>
          <h1 className="lockscreen-title">צלילה עמוקה</h1>
          <p className="lockscreen-subtitle">מערכת מוגנת. אנא הזן קוד גישה לכניסה.</p>
        </div>

        <div className="passcode-dots-container">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div 
              key={index} 
              className={`passcode-dot ${index < passcode.length ? 'active' : ''}`}
            />
          ))}
        </div>

        <div className="lockscreen-error">
          {error}
        </div>

        {loading ? (
          <div className="lockscreen-loader">
            <Loader2 className="spin" size={20} />
            <span>מאמת קוד גישה...</span>
          </div>
        ) : (
          <div className="lockscreen-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button 
                key={num} 
                className="lockscreen-key" 
                onClick={() => handleKeyPress(num.toString())}
              >
                {num}
              </button>
            ))}
            <button className="lockscreen-key utility-key" onClick={handleClear}>
              איפוס
            </button>
            <button className="lockscreen-key" onClick={() => handleKeyPress('0')}>
              0
            </button>
            <button className="lockscreen-key utility-key" onClick={handleBackspace}>
              מחק
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AppContent({
  activeTab,
  setActiveTab,
  selectedEntryId,
  setSelectedEntryId,
  dataSource,
  uid,
  isaData,
  isaLoading,
  authLoading,
  handleNavigateToEntry,
  renderContent,
  traceabilityTarget,
  setTraceabilityTarget
}) {
  const diaryData = useDiaryData();
  const { ontologyVersion, setOntologyVersion } = diaryData;
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);

  const openReconciliation = async () => {
    try {
      const resp = await fetch('/entity_review_candidates.json');
      if (resp.ok) {
        const data = await resp.json();
        setCandidates(data);
      }
    } catch (e) {
      console.warn("Failed to load entity_review_candidates.json", e);
    }
    setIsReconcileOpen(true);
  };

  return (
    <div className="three-column-layout">
      {/* Right Navigation Sidebar (RTL) - 5 Clean Core Pillars + Footer Drawer */}
      <aside className="sidebar-right">
        <div className="sidebar-logo" style={{ gap: '10px' }}>
          <img src="/logo.png" alt="לוגו זריחה בים" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span>צלילה עמוקה</span>
        </div>

        {/* 5 Focused Core Pillars Navigation */}
        <nav className="sidebar-nav" style={{ marginTop: '8px' }}>
          <button
            className={`sidebar-btn ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
            title="📖 יומן וציר זמן"
          >
            <BookOpen size={18} />
            <span>📖 יומן וציר זמן</span>
          </button>

          <button
            className={`sidebar-btn ${(activeTab === 'mirror' || activeTab === 'ask') ? 'active' : ''}`}
            onClick={() => setActiveTab('mirror')}
            title="⚖️ מראת החלטות וכיול"
          >
            <Scale size={18} />
            <span>⚖️ מראת החלטות וכיול</span>
          </button>

          <button
            className={`sidebar-btn ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
            title="💡 תובנות ומכ&quot;ם גוף–נפש"
          >
            <Sparkles size={18} />
            <span>💡 תובנות ומכ"ם גוף–נפש</span>
          </button>

          <button
            className={`sidebar-btn ${(activeTab === 'graph-deep' || activeTab.startsWith('graph')) ? 'active' : ''}`}
            onClick={() => setActiveTab('graph-deep')}
            title="🧭 מפת עומק וקשרים"
          >
            <Network size={18} />
            <span>🧭 מפת עומק וקשרים</span>
          </button>

          <button
            className={`sidebar-btn ${(activeTab === 'analysis' || activeTab === 'readings') ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
            title="🧠 דיוקן פסיכולוגי"
          >
            <Brain size={18} />
            <span>🧠 דיוקן פסיכולוגי</span>
          </button>
        </nav>

        {/* Discreet Footer Maintenance Drawer Button (⚙️) & Status */}
        <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box' }}>
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#cbd5e1',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            title="פתיחת פאנל ניהול אונטולוגיה, עלויות מערכת ומיזוג ישויות"
          >
            <Settings size={14} />
            <span>⚙️ ניהול אונטולוגיה ומערכת</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div 
                style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: authLoading ? 'var(--text-muted)' : 'var(--accent-color)' 
                }} 
                title={authLoading ? "מתחבר..." : "מחובר ל-Firebase"}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>פיירבייס</span>
            </div>
            {isaLoading ? (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>סנכרון ISA...</span>
            ) : isaData ? (
              <span style={{ fontSize: '0.7rem', color: '#10b981' }} title="נתוני ISA מסונכרנים">ISA מסונכרן ✓</span>
            ) : (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ללא ISA</span>
            )}
          </div>
        </div>
      </aside>

      {/* Main View Area */}
      {renderContent(diaryData)}

      {/* Sleek Admin / Settings Modal Drawer */}
      {isSettingsOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 110,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          direction: 'rtl'
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '20px',
            padding: '24px',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Settings size={20} style={{ color: '#818cf8' }} />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  ⚙️ ניהול אונטולוגיה ומערכת (Admin Drawer)
                </h2>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Ontology Version Toggle */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: ontologyVersion === 'v2' ? '#818cf8' : '#94a3b8' }}>
                  {ontologyVersion === 'v2' ? '🌟 אונטולוגיה v2 (קנונית)' : '🏛️ ארכיון Legacy'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  מקור הנתונים והאונטולוגיה הפעיל בממשק
                </div>
              </div>

              <button
                onClick={() => setOntologyVersion(prev => prev === 'v2' ? 'legacy' : 'v2')}
                style={{
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#c7d2fe',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                החלף ל-{ontologyVersion === 'v2' ? 'Legacy' : 'v2 (קנונית)'}
              </button>
            </div>

            {/* Token Cost Tracker */}
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>מעקב עלויות טוקנים ו-AI:</div>
              <TokenCostTracker uid={uid} />
            </div>

            {/* Quick Action Navigation Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  setActiveTab('ontology');
                  setIsSettingsOpen(false);
                }}
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#c7d2fe',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>🧬 מרכז שליטה וניהול אונטולוגיה ומועמדים</span>
                <span>➔</span>
              </button>

              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  openReconciliation();
                }}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#a7f3d0',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>🔗 מיזוג וסקירת ישויות כפולות (Reconciliation)</span>
                <span>➔</span>
              </button>

              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  setIsHealthModalOpen(true);
                }}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#bae6fd',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>⚖️ בריאות הידע, החלטות וכיול אפיסטמי</span>
                <span>➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entity Reconciliation Modal */}
      <EntityReconciliationModal
        isOpen={isReconcileOpen}
        onClose={() => setIsReconcileOpen(false)}
        candidates={candidates}
      />

      {/* Epistemic Health Modal */}
      <EpistemicHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        uid={uid}
        entries={diaryData.entries || []}
        graphNodes={diaryData.rawGraphData?.nodes || []}
        v2RawData={diaryData.v2RawData}
      />

      {/* Epistemic Traceability Modal Overlay */}
      {traceabilityTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 120,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{ maxWidth: '860px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <EpistemicTraceabilityView 
              insight={traceabilityTarget}
              entries={diaryData.entries || []}
              graphNodes={diaryData.rawGraphData?.nodes || []}
              v2RawData={diaryData.v2RawData}
              onClose={() => setTraceabilityTarget(null)}
              onNavigateToEntry={(entryId) => {
                setTraceabilityTarget(null);
                handleNavigateToEntry(entryId);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('okf_auth_token') === 'session_approved_270107';
  });
  const [activeTab, setActiveTab] = useState('feed');
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [traceabilityTarget, setTraceabilityTarget] = useState(null);
  const uid = FIREBASE_UID_FALLBACK;
  const dataSource = 'firebase';

  const [isaData, setIsaData] = useState(null);
  const [isaLoading, setIsaLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !uid) return;
    setIsaLoading(true);
    fetchSyncedIsaData(uid)
      .then(data => {
        setIsaData(data);
        setIsaLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch synced ISA data:", err);
        setIsaLoading(false);
      });
  }, [uid, authLoading]);

  useEffect(() => {
    getFirebaseUid()
      .then(() => {
        setAuthLoading(false);
      })
      .catch((err) => {
        console.error("Failed to authenticate automatically:", err);
        setAuthLoading(false);
      });
  }, []);

  const handleNavigateToEntry = (entryId) => {
    setSelectedEntryId(entryId);
    setActiveTab('feed');
  };

  const renderContent = (diaryData) => {
    if (authLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, gap: '12px' }}>
          <Loader2 className="spin" size={32} style={{ color: 'var(--text-primary)' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>מתחבר לפיירבייס בצורה מאובטחת...</div>
        </div>
      );
    }

    const props = { dataSource, uid, isaData };

    switch (activeTab) {
      case 'feed':
        return (
          <FeedView 
            {...props} 
            entries={diaryData.entries || []}
            graphNodes={diaryData.rawGraphData?.nodes || []}
            selectedEntryId={selectedEntryId} 
            onSelectEntry={setSelectedEntryId} 
            onNavigateToTab={setActiveTab}
            onNavigateToEntry={handleNavigateToEntry}
          />
        );
      case 'mirror':
      case 'ask':
        return (
          <div style={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
            <AskView 
              {...props} 
              entries={diaryData.entries || []}
              graphNodes={diaryData.rawGraphData?.nodes || []}
              v2RawData={diaryData.v2RawData}
              onNavigateToEntry={handleNavigateToEntry} 
              onOpenTraceability={(item) => setTraceabilityTarget(item)}
            />
          </div>
        );
      case 'insights':
        return (
          <div style={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
            <InsightsView 
              {...props} 
              entries={diaryData.entries || []}
              graphNodes={diaryData.rawGraphData?.nodes || []}
              onNavigateToEntry={handleNavigateToEntry}
              onOpenTraceability={(item) => setTraceabilityTarget(item)}
            />
          </div>
        );
      case 'graph-deep':
      case 'deep-graph':
      case 'graph':
      case 'graph-stars':
        return (
          <div style={{ flexGrow: 1, height: '100%' }}>
            <DeepKnowledgeView 
              {...props} 
              entries={diaryData.entries || []}
              graphNodes={diaryData.rawGraphData?.nodes || []}
              v2RawData={diaryData.v2RawData}
              onNavigateToEntry={handleNavigateToEntry} 
              onOpenTraceability={(item) => setTraceabilityTarget(item)}
            />
          </div>
        );
      case 'analysis':
      case 'readings':
        return (
          <div style={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
            <PersonalityAnalysisView 
              {...props} 
              entries={diaryData.entries || []}
              graphNodes={diaryData.rawGraphData?.nodes || []}
              onNavigateToEntry={handleNavigateToEntry}
            />
          </div>
        );
      case 'ontology':
        return (
          <div style={{ flexGrow: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', color: '#c7d2fe', fontWeight: 600 }}>⚙️ מסך ניהול אונטולוגיה (Developer Mode)</span>
              <button 
                onClick={() => setActiveTab('feed')} 
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: '6px', padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                חזרה ליומן ➔
              </button>
            </div>
            <div style={{ flexGrow: 1, overflow: 'hidden' }}>
              <OntologyView />
            </div>
          </div>
        );
      default:
        return (
          <FeedView 
            {...props} 
            entries={diaryData.entries || []}
            graphNodes={diaryData.rawGraphData?.nodes || []}
            selectedEntryId={selectedEntryId} 
            onSelectEntry={setSelectedEntryId} 
            onNavigateToTab={setActiveTab}
            onNavigateToEntry={handleNavigateToEntry}
          />
        );
    }
  };

  if (!isAuthenticated) {
    return <PasscodeGate onVerified={() => setIsAuthenticated(true)} />;
  }

  return (
    <DiaryDataProvider uid={uid}>
      <AppContent
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedEntryId={selectedEntryId}
        setSelectedEntryId={setSelectedEntryId}
        dataSource={dataSource}
        uid={uid}
        isaData={isaData}
        isaLoading={isaLoading}
        authLoading={authLoading}
        handleNavigateToEntry={handleNavigateToEntry}
        renderContent={renderContent}
        traceabilityTarget={traceabilityTarget}
        setTraceabilityTarget={setTraceabilityTarget}
      />
    </DiaryDataProvider>
  );
}

export default App;
