import React from 'react';

export default function EntityTimeline({ entries, onNavigateToEntry }) {
  if (!entries || entries.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
        אין אזכורים ישירים ברשומות היומן.
      </div>
    );
  }

  // Sort entries by date assuming date format allows sorting (e.g., ISO string)
  const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div style={{ position: 'relative', paddingLeft: '20px', margin: '20px 0', borderLeft: '2px solid var(--border-color)' }}>
      {sortedEntries.map((entry, idx) => (
        <div key={idx} style={{ position: 'relative', marginBottom: '16px' }}>
          {/* Timeline Dot */}
          <div style={{
            position: 'absolute',
            left: '-26px',
            top: '4px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-color)',
            border: '2px solid var(--bg-primary)'
          }}></div>
          
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'var(--panel-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.date}</span>
              {entry.preview && (
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  "...{entry.preview}..."
                </p>
              )}
            </div>
            
            <button
              onClick={() => onNavigateToEntry && onNavigateToEntry(entry.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-color)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline'
              }}
            >
              צפה ברשומה
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
