import React, { useState, useEffect } from 'react';
import FeedView from './FeedView';
import GraphView from './GraphView';
import PersonalityAnalysisView from './PersonalityAnalysisView';
import InsightsView from './InsightsView';
import { BookOpen, Network, Loader2, Brain, Sparkles } from 'lucide-react';
import { getFirebaseUid } from './firebase';

const FIREBASE_UID_FALLBACK = 'K9j4Nx0WK7NKYJs6iDUz35LXFai1';

function App() {
  const [activeTab, setActiveTab] = useState('feed');
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const dataSource = 'firebase';
  const uid = FIREBASE_UID_FALLBACK;

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

    const props = { dataSource, uid };

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
        return (
          <div style={{ flexGrow: 1, height: '100%' }}>
            <GraphView 
              {...props} 
              onNavigateToEntry={handleNavigateToEntry} 
            />
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
      default:
        return null;
    }
  };

  return (
    <div className="three-column-layout">
      {/* Right Navigation Sidebar (RTL) */}
      <aside className="sidebar-right">
        <div className="sidebar-logo" title="יומן">
          <span>י</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-btn ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
            title="יומן רשומות"
          >
            <BookOpen size={20} />
          </button>
          <button
            className={`sidebar-btn ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
            title="מפת קשרים מלאה"
          >
            <Network size={20} />
          </button>
          <button
            className={`sidebar-btn ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
            title="ניתוח אישיות רב-סוכני"
          >
            <Brain size={20} />
          </button>
          <button
            className={`sidebar-btn ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
            title="תובנות ומאגר ידע"
          >
            <Sparkles size={20} />
          </button>
        </nav>

        {/* Mini Database Connection Status Indicator */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: authLoading ? '#eab308' : '#22c55e' 
              }} 
            title={authLoading ? "מתחבר..." : "מחובר ל-Firebase"}
          />
        </div>
      </aside>

      {/* Main View Area */}
      {renderContent()}
    </div>
  );
}

export default App;
