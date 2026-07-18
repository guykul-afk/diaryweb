import React, { useEffect, useState } from 'react';
import { BookOpen, Quote, Sparkles, HelpCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { fetchRecommendedReadings } from '../firebase';

export default function RecommendedReadingsCard({ uid, onNavigateToNewEntry }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    fetchRecommendedReadings(uid)
      .then(data => {
        setReadings(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading readings:", err);
        setLoading(false);
      });
  }, [uid]);

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'var(--panel-bg, #1e1e2d)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        color: 'var(--text-muted, #94a3b8)',
        textAlign: 'center',
        marginBottom: '24px'
      }}>
        <RefreshCw size={20} className="spin" style={{ marginBottom: '8px' }} />
        <div>טוען המלצות קריאה מותאמות אישית...</div>
      </div>
    );
  }

  if (!readings || readings.length === 0) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(148, 163, 184, 0.15)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(12px)',
        marginBottom: '24px',
        direction: 'rtl',
        color: '#f8fafc'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            padding: '10px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}>
            <BookOpen size={22} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              המלצות קריאה וציטוטים מותאמים
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>מתעדכן אוטומטית כל 5 רשומות יומן חדשות</span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6 }}>
          המערכת תסרוק את 88 קבצי הידע והפילוסופיה שלנו ותתאים עבורך ציטוטים וטקסטים מעצימים ברגע שתכתוב רשומות נוספות.
        </p>
      </div>
    );
  }

  const currentReading = readings[activeTab] || readings[0];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.85) 100%)',
      borderRadius: '20px',
      padding: '28px',
      border: '1px solid rgba(168, 85, 247, 0.25)',
      boxShadow: '0 12px 36px rgba(0, 0, 0, 0.3)',
      backdropFilter: 'blur(16px)',
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
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
        pointerEvents: 'none'
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
            padding: '12px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(168, 85, 247, 0.35)'
          }}>
            <BookOpen size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                ספריית השראה והמלצות קריאה
              </h3>
              <span style={{
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#d8b4fe',
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 600,
                border: '1px solid rgba(168, 85, 247, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={12} />
                סבב 5 רשומות
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              טקסטים וציטוטים שנבחרו במיוחד עבורך מתוך בסיס הידע הפילוסופי והפסיכולוגי
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        {readings.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {readings.map((r, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                style={{
                  background: activeTab === idx ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' : 'transparent',
                  color: activeTab === idx ? '#ffffff' : '#94a3b8',
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

      {/* Main Content Card */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>
        {/* Thinker Badge & Work Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {currentReading.thinker}
            </span>
            {currentReading.source_work && (
              <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>
                מתוך: "{currentReading.source_work}"
              </h4>
            )}
          </div>
          <Quote size={28} style={{ color: 'rgba(168, 85, 247, 0.4)' }} />
        </div>

        {/* Quote Block */}
        {currentReading.quote && (
          <blockquote style={{
            margin: 0,
            padding: '16px 20px',
            borderRight: '4px solid #a855f7',
            background: 'rgba(168, 85, 247, 0.06)',
            borderRadius: '0 12px 12px 0',
            fontSize: '1rem',
            fontStyle: 'italic',
            lineHeight: '1.6',
            color: '#f8fafc',
            fontWeight: 500
          }}>
            "{currentReading.quote}"
          </blockquote>
        )}

        {/* Personal Relevance Explanation */}
        {currentReading.relevance && (
          <div style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.65', background: 'rgba(255, 255, 255, 0.02)', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '4px', fontSize: '0.85rem' }}>
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
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
              <HelpCircle size={20} color="#818cf8" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#818cf8', display: 'block', marginBottom: '2px' }}>
                  שאלה למחשבה ולכתיבה הבאה:
                </span>
                <span style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 500 }}>
                  "{currentReading.reflection_question}"
                </span>
              </div>
            </div>

            {onNavigateToNewEntry && (
              <button
                onClick={() => onNavigateToNewEntry(currentReading.reflection_question)}
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
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
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  transition: 'transform 0.2s',
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
    </div>
  );
}
