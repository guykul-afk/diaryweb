import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Coins, Activity, Calendar, ShieldCheck, ChevronDown, Sparkles } from 'lucide-react';

export default function TokenCostTracker({ uid }) {
  const [stats, setStats] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const statsRef = doc(db, 'users', uid, 'stats', 'token_usage');
    const unsubscribe = onSnapshot(statsRef, (snapshot) => {
      if (snapshot.exists()) {
        setStats(snapshot.data());
      } else {
        setStats({
          day_cost_usd: 0,
          week_cost_usd: 0,
          month_cost_usd: 0,
          total_cost_usd: 0,
          day_input_tokens: 0,
          day_output_tokens: 0,
          week_input_tokens: 0,
          week_output_tokens: 0,
          month_input_tokens: 0,
          month_output_tokens: 0,
          total_input_tokens: 0,
          total_output_tokens: 0
        });
      }
    }, (err) => {
      console.error("Failed to listen to token usage stats:", err);
    });

    return () => unsubscribe();
  }, [uid]);

  const formatCostUSD = (val) => {
    if (!val || isNaN(val)) return '$0.0000';
    if (val < 0.01) return `$${val.toFixed(4)}`;
    return `$${val.toFixed(3)}`;
  };

  const formatCostILS = (valUSD) => {
    if (!valUSD || isNaN(valUSD)) return '₪0.00';
    const ils = valUSD * 3.7; // Approx USD to ILS conversion
    return `₪${ils.toFixed(2)}`;
  };

  const formatTokens = (count) => {
    if (!count) return '0';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toLocaleString();
  };

  const dayCost = stats?.day_cost_usd || 0;
  const weekCost = stats?.week_cost_usd || 0;
  const monthCost = stats?.month_cost_usd || 0;
  const totalCost = stats?.total_cost_usd || 0;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Top Header Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          padding: '6px 14px',
          cursor: 'pointer',
          color: 'var(--text-primary, #f3f4f6)',
          fontSize: '0.82rem',
          fontWeight: 600,
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease-in-out',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'}
        title="לחץ לצפייה במונה עלויות ושימוש בטוקנים"
      >
        <Coins size={15} style={{ color: '#f59e0b' }} />
        <span>עלות AI: </span>
        <span style={{ color: '#10b981', fontWeight: 700 }}>{formatCostUSD(dayCost)}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)' }}>({formatCostILS(dayCost)})</span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>

      {/* Popover / Modal Breakdown */}
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <div 
            onClick={() => setIsOpen(false)} 
            style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
          />

          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 999,
              width: '320px',
              backgroundColor: 'var(--panel-bg, #1e293b)',
              border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
              borderRadius: '16px',
              padding: '18px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(16px)',
              color: 'var(--text-primary, #f8fafc)',
              direction: 'rtl'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                <Sparkles size={18} style={{ color: '#f59e0b' }} />
                <span>מעקב עלויות טוקנים (Gemini AI)</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '10px' }}>זמן אמת</span>
            </div>

            {/* Timeframe Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Daily */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>יום נוכחי</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)' }}>
                    {formatTokens(stats?.day_input_tokens)} in / {formatTokens(stats?.day_output_tokens)} out
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, color: '#10b981', fontSize: '0.9rem' }}>{formatCostUSD(dayCost)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)' }}>{formatCostILS(dayCost)}</div>
                </div>
              </div>

              {/* Weekly */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>שבוע נוכחי</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)' }}>
                    {formatTokens(stats?.week_input_tokens)} in / {formatTokens(stats?.week_output_tokens)} out
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, color: '#3b82f6', fontSize: '0.9rem' }}>{formatCostUSD(weekCost)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)' }}>{formatCostILS(weekCost)}</div>
                </div>
              </div>

              {/* Monthly */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>חודש נוכחי</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)' }}>
                    {formatTokens(stats?.month_input_tokens)} in / {formatTokens(stats?.month_output_tokens)} out
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, color: '#8b5cf6', fontSize: '0.9rem' }}>{formatCostUSD(monthCost)}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #9ca3af)' }}>{formatCostILS(monthCost)}</div>
                </div>
              </div>

              {/* Total Cumulative */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)' }}>סה"כ מצטבר:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatCostUSD(totalCost)} ({(stats?.total_input_tokens || 0) + (stats?.total_output_tokens || 0)} טוקנים)
                </span>
              </div>
            </div>

            {/* Pricing Rates Footer Note */}
            <div style={{ marginTop: '12px', paddingTop: '8px', fontSize: '0.68rem', color: 'var(--text-muted, #9ca3af)', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              תעריף Gemini 2.5 Flash: $0.075 / 1M קלט | $0.30 / 1M פלט
            </div>
          </div>
        </>
      )}
    </div>
  );
}
