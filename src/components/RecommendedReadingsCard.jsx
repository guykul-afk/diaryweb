import React, { useEffect, useState } from 'react';
import { BookOpen, Quote, Sparkles, HelpCircle, ArrowLeft, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react';
import { fetchAllRecommendedReadings } from '../firebase';

export default function RecommendedReadingsCard({ uid, onNavigateToNewEntry }) {
  const [history, setHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    fetchAllRecommendedReadings(uid)
      .then(data => {
        setHistory(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading readings history:", err);
        setLoading(false);
      });
  }, [uid]);

  const formatDate = (ts) => {
    if (!ts) return 'תאריך לא ידוע';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('he-IL', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'var(--panel-bg)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
        textAlign: 'center',
        marginBottom: '24px'
      }}>
        <RefreshCw size={20} className="spin" style={{ marginBottom: '8px' }} />
        <div>טוען המלצות קריאה והיסטוריית השראה...</div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div style={{
        background: 'var(--panel-bg)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '24px',
        direction: 'rtl',
        color: 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            background: 'var(--accent-color)',
            padding: '10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px var(--accent-light)'
          }}>
            <BookOpen size={22} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              המלצות קריאה וציטוטים מותאמים
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>מתעדכן אוטומטית כל 5 רשומות יומן חדשות</span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          המערכת תסרוק את 88 קבצי הידע והפילוסופיה שלנו ותתאים עבורך ציטוטים וטקסטים מעצימים ברגע שתכתוב רשומות נוספות.
        </p>
      </div>
    );
  }

  const currentHistoryItem = history[currentHistoryIndex] || { readings: [] };
  const readings = currentHistoryItem.readings || [];
  const currentReading = readings[activeTab] || readings[0];

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderRadius: '20px',
      padding: '28px',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-lg)',
      marginBottom: '28px',
      direction: 'rtl',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Subtle Accent Glow */}
      <div style={{
        position: 'absolute',
        top: '-50px',
        left: '-50px',
        width: '180px',
        height: '180px',
        background: 'radial-gradient(circle, var(--accent-light) 0%, rgba(0, 0, 0, 0) 70%)',
        pointerEvents: 'none'
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'var(--accent-color)',
            padding: '12px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px var(--accent-light)'
          }}>
            <BookOpen size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                ספריית השראה והמלצות קריאה
              </h3>
              {currentHistoryIndex === 0 && (
                <span style={{
                  background: 'var(--accent-light)',
                  color: 'var(--accent-color)',
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Sparkles size={12} />
                  סבב אחרון
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              טקסטים וציטוטים שנבחרו במיוחד עבורך מתוך בסיס הידע הפילוסופי והפסיכולוגי
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        {readings.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-color)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            {readings.map((r, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                style={{
                  background: activeTab === idx ? 'var(--accent-color)' : 'transparent',
                  color: activeTab === idx ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {r.thinker || `המלצה ${idx + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History Timeline Selector */}
      {history.length > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          backgroundColor: 'var(--bg-color)', 
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '8px 16px',
          marginBottom: '16px',
          fontSize: '0.85rem'
        }}>
          <button 
            disabled={currentHistoryIndex === history.length - 1}
            onClick={() => { setCurrentHistoryIndex(prev => prev + 1); setActiveTab(0); }}
            style={{
              background: 'var(--panel-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: currentHistoryIndex === history.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              padding: '6px 10px',
              cursor: currentHistoryIndex === history.length - 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'background-color 0.2s'
            }}
            title="המלצות ישנות יותר"
          >
            <ChevronRight size={16} />
            <span>המלצות ישנות יותר</span>
          </button>
          
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            סבב {history.length - currentHistoryIndex} מתוך {history.length} ({formatDate(currentHistoryItem.timestamp)})
          </span>

          <button 
            disabled={currentHistoryIndex === 0}
            onClick={() => { setCurrentHistoryIndex(prev => prev - 1); setActiveTab(0); }}
            style={{
              background: 'var(--panel-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: currentHistoryIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              padding: '6px 10px',
              cursor: currentHistoryIndex === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'background-color 0.2s'
            }}
            title="המלצות חדשות יותר"
          >
            <span>המלצות חדשות יותר</span>
            <ChevronLeft size={16} />
          </button>
        </div>
      )}

      {/* Main Content Card */}
      {currentReading ? (
        <div style={{
          background: 'var(--bg-color)',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          {/* Thinker Badge & Work Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {currentReading.thinker}
              </span>
              {currentReading.source_work && (
                <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  מתוך: "{currentReading.source_work}"
                </h4>
              )}
            </div>
            <Quote size={28} style={{ color: 'var(--accent-glow)' }} />
          </div>

          {/* Quote Block */}
          {currentReading.quote && (
            <blockquote style={{
              margin: 0,
              padding: '16px 20px',
              borderRight: '4px solid var(--accent-color)',
              background: 'var(--accent-light)',
              borderRadius: '0 12px 12px 0',
              fontSize: '1rem',
              fontStyle: 'italic',
              lineHeight: '1.6',
              color: 'var(--text-primary)',
              fontWeight: 500
            }}>
              "{currentReading.quote}"
            </blockquote>
          )}

          {/* Personal Relevance Explanation */}
          {currentReading.relevance && (
            <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.65', background: 'var(--panel-bg)', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>
                💡 למה זה רלוונטי ליומן שלך:
              </strong>
              {currentReading.relevance}
            </div>
          )}

          {/* Reflection Question & Action Button */}
          {currentReading.reflection_question && (
            <div style={{
              marginTop: '4px',
              padding: '16px',
              borderRadius: '12px',
              background: 'var(--accent-light)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                <HelpCircle size={20} color="var(--accent-color)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-color)', display: 'block', marginBottom: '2px' }}>
                    שאלה למחשבה ולכתיבה הבאה:
                  </span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    "{currentReading.reflection_question}"
                  </span>
                </div>
              </div>

              {onNavigateToNewEntry && (
                <button
                  onClick={() => onNavigateToNewEntry(currentReading.reflection_question)}
                  style={{
                    background: 'var(--accent-color)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px var(--accent-light)',
                    transition: 'background-color 0.2s',
                    flexShrink: 0
                  }}
                >
                  כתוב יומן על זה
                  <ArrowLeft size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
          אין המלצות זמינות בסבב זה.
        </div>
      )}
    </div>
  );
}
