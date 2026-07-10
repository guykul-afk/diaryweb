import React, { useMemo, useState } from 'react';
import { useDiaryData } from './hooks/useDiaryData';
import { Quote, Search, Calendar, ChevronLeft } from 'lucide-react';

export default function QuotesView({ onNavigateToEntry }) {
  const { entries, loading, error } = useDiaryData();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter entries containing the word "ציטוט"
  const quoteEntries = useMemo(() => {
    if (!entries) return [];
    return entries.filter(entry => {
      const content = (entry.content || '').toLowerCase();
      const title = (entry.frontmatter?.title || '').toLowerCase();
      
      const matchesQuote = content.includes('ציטוט') || title.includes('ציטוט');
      if (!matchesQuote) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return content.includes(query) || title.includes(query) || entry.frontmatter?.date?.includes(query);
      }

      return true;
    });
  }, [entries, searchQuery]);

  // Helper to extract paragraphs containing "ציטוט"
  const extractQuotes = (content) => {
    if (!content) return [];
    
    // Split content by newlines to find paragraphs
    const paragraphs = content.split(/\n+/);
    
    // Filter paragraphs that contain the word "ציטוט" (or are wrapped in quotation marks/markdown blockquotes)
    return paragraphs
      .map(p => p.trim())
      .filter(p => p.toLowerCase().includes('ציטוט') || p.startsWith('>') || (p.startsWith('"') && p.endsWith('"')));
  };

  return (
    <div style={{ flexGrow: 1, height: '100%', overflowY: 'auto', padding: '32px', backgroundColor: 'var(--bg-primary)', direction: 'rtl' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Header & Stats */}
        <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Quote size={32} style={{ color: 'var(--accent-color)' }} />
              ציטוטים מהיומן
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
              מרכז את כל הרשומות שבהן רשמת במפורש את המילים "ציטוט" או "ציטוטים".
            </p>
          </div>
          
          {/* Search bar */}
          <div style={{ position: 'relative', width: '260px' }}>
            <input
              type="text"
              placeholder="חפש בתוך הציטוטים..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 32px 8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--panel-bg)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            <Search size={14} style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--text-muted)' }} />
          </div>
        </div>

        {loading && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>טוען ציטוטים...</div>}
        {error && <div style={{ color: '#e53e3e', textAlign: 'center', padding: '40px' }}>שגיאה בטעינה: {error}</div>}

        {!loading && !error && quoteEntries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Quote size={48} style={{ opacity: 0.25, marginBottom: '12px' }} />
            <h3>לא נמצאו ציטוטים</h3>
            <p style={{ fontSize: '0.85rem', maxWidth: '400px', margin: '0 auto' }}>
              {searchQuery ? 'נסה לשנות את מונחי החיפוש.' : 'הרשומות יופיעו כאן ברגע שתוסיף את המילה "ציטוט" לתוכן היומן שלך.'}
            </p>
          </div>
        )}

        {/* Quotes list */}
        {!loading && !error && quoteEntries.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {quoteEntries.map(entry => {
              const quotes = extractQuotes(entry.content);
              
              return (
                <div 
                  key={entry.id} 
                  style={{
                    backgroundColor: 'var(--panel-bg)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    padding: '20px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    transition: 'transform 0.2s',
                    position: 'relative'
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      <Calendar size={14} />
                      <span>{entry.frontmatter?.date}</span>
                      {entry.frontmatter?.mood && (
                        <>
                          <span>•</span>
                          <span>רגש: {entry.frontmatter.mood}</span>
                        </>
                      )}
                    </div>
                    
                    <button
                      onClick={() => onNavigateToEntry && onNavigateToEntry(entry.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-color)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: 0
                      }}
                    >
                      קרא רשומה מלאה
                      <ChevronLeft size={14} />
                    </button>
                  </div>

                  {/* Extracted Quote Highlight(s) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {quotes.map((quote, qIdx) => (
                      <blockquote 
                        key={qIdx}
                        style={{
                          margin: 0,
                          padding: '10px 16px',
                          borderRight: '4px solid var(--accent-color)',
                          backgroundColor: 'rgba(0, 53, 95, 0.02)',
                          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                          fontSize: '0.95rem',
                          fontStyle: 'italic',
                          lineHeight: '1.5',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {quote}
                      </blockquote>
                    ))}

                    {/* If no exact matching sentence was clean, show first 200 chars as fallback */}
                    {quotes.length === 0 && (
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {entry.content?.slice(0, 200)}...
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
