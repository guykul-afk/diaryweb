import React, { useState, useEffect } from 'react';
import FeedView from './FeedView';
import GraphView from './GraphView';
import PersonalityAnalysisView from './PersonalityAnalysisView';
import InsightsView from './InsightsView';
import { DiaryDataProvider } from './hooks/useDiaryData';
import QuotesView from './QuotesView';
import MindMapBuilderView from './MindMapBuilderView';
import { BookOpen, Network, Loader2, Brain, Sparkles, Lock } from 'lucide-react';
import { getFirebaseUid, verifyPasscode, fetchSyncedIsaData } from './firebase';

const FIREBASE_UID_FALLBACK = 'K9j4Nx0WK7NKYJs6iDUz35LXFai1';

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
            <img src="/favicon.svg" alt="לוגו זריחה בים" style={{ width: '64px', height: '64px', borderRadius: '14px', boxShadow: '0 8px 30px rgba(255, 126, 64, 0.25)' }} />
          </div>
          <h1 className="lockscreen-title">היומן של גיא</h1>
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('okf_auth_token') === 'session_approved_270107';
  });
  const [activeTab, setActiveTab] = useState('feed');
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
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

  const renderContent = () => {
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
            selectedEntryId={selectedEntryId} 
            onSelectEntry={setSelectedEntryId} 
          />
        );
      case 'graph':
      case 'graph-stars':
        return (
          <div style={{ flexGrow: 1, height: '100%' }}>
            <GraphView 
              {...props} 
              onNavigateToEntry={handleNavigateToEntry} 
            />
          </div>
        );
      case 'graph-mindmap':
        return (
          <div style={{ flexGrow: 1, height: '100%' }}>
            <MindMapBuilderView />
          </div>
        );
      case 'analysis':
        return (
          <div style={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
            <PersonalityAnalysisView {...props} />
          </div>
        );
      case 'insights':
        return (
          <div style={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
            <InsightsView {...props} />
          </div>
        );
      case 'quotes':
        return (
          <QuotesView 
            onNavigateToEntry={handleNavigateToEntry} 
          />
        );
      default:
        return null;
    }
  };

  if (!isAuthenticated) {
    return <PasscodeGate onVerified={() => setIsAuthenticated(true)} />;
  }

  return (
    <DiaryDataProvider uid={uid}>
      <div className="three-column-layout">
        {/* Right Navigation Sidebar (RTL) */}
        <aside className="sidebar-right">
          <div className="sidebar-logo" style={{ gap: '10px' }}>
            <img src="/favicon.svg" alt="לוגו זריחה בים" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
            <span>היומן של גיא</span>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`sidebar-btn ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
              title="יומן רשומות"
            >
              <span>יומן רשומות</span>
            </button>
            
            <button
              className={`sidebar-btn ${activeTab === 'quotes' ? 'active' : ''}`}
              onClick={() => setActiveTab('quotes')}
              title="ציטוטים נבחרים"
            >
              <span>ציטוטים</span>
            </button>
            
            <button
              className={`sidebar-btn ${activeTab.startsWith('graph') ? 'active' : ''}`}
              onClick={() => setActiveTab('graph-stars')}
              title="מפת קשרים ומבטים מורחבים"
            >
              <span>מפות וקשרים</span>
            </button>

            {activeTab.startsWith('graph') && (
              <div className="sidebar-submenu">
                <button 
                  className={`submenu-btn ${activeTab === 'graph' || activeTab === 'graph-stars' ? 'active' : ''}`}
                  onClick={() => setActiveTab('graph-stars')}
                >
                  מפת כוכבים
                </button>
                <button 
                  className={`submenu-btn ${activeTab === 'graph-mindmap' ? 'active' : ''}`}
                  onClick={() => setActiveTab('graph-mindmap')}
                >
                  עורך מפת מוח (GRIND)
                </button>
              </div>
            )}

            <button
              className={`sidebar-btn ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => setActiveTab('analysis')}
              title="ניתוח אישיות רב-סוכני"
            >
              <span>ניתוח אישיות</span>
            </button>
            <button
              className={`sidebar-btn ${activeTab === 'insights' ? 'active' : ''}`}
              onClick={() => setActiveTab('insights')}
              title="תובנות ומאגר ידע"
            >
              <span>תובנות ומאגר</span>
            </button>
          </nav>

          {/* Connection status */}
          <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>פיירבייס</span>
              </div>
              {isaLoading ? (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>סנכרון ISA...</span>
              ) : isaData ? (
                <span style={{ fontSize: '0.7rem', color: '#10b981' }} title="נתוני ISA מסונכרנים אוטומטית בכל יום ב-23:59">ISA מסונכרן ✓</span>
              ) : (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ללא נתוני ISA</span>
              )}
            </div>
          </div>
        </aside>


        {/* Main View Area */}
        {renderContent()}
      </div>
    </DiaryDataProvider>
  );
}

export default App;
