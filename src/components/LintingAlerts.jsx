import React from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';

export default function LintingAlerts({ activeNodeId, relatedNodes }) {
  if (!activeNodeId || !relatedNodes || relatedNodes.length === 0) return null;

  // Simple heuristic for semantic linting:
  // If there is another node of the exact same type with very high sentiment correlation or identical topics,
  // suggest a merge. Here we just mock it for demonstration if there's a highly connected node.
  
  const suggestions = [];
  
  // Find nodes with similar names (e.g., "לחץ" and "סטרס") or high weight
  const similar = relatedNodes.find(n => 
    n.name && activeNodeId && 
    (n.name.includes(activeNodeId) || activeNodeId.includes(n.name)) && 
    n.id !== activeNodeId
  );

  if (similar) {
    suggestions.push(`המושג "${similar.name}" דומה מאוד ל-"${activeNodeId}". האם תרצה לאחד אותם?`);
  }
  
  // High connections suggestion
  if (relatedNodes.length > 5) {
    suggestions.push(`מושג זה מקושר ל-${relatedNodes.length} מושגים אחרים. ייתכן וניתן לפצל אותו לתת-נושאים (Sub-Topics).`);
  }

  if (suggestions.length === 0) return null;

  return (
    <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#d69e2e', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 4px 0' }}>
        <Sparkles size={14} /> המלצות AI לסדר בארכיון
      </h3>
      {suggestions.map((suggestion, idx) => (
        <div key={idx} style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(214, 158, 46, 0.1)',
          border: '1px solid rgba(214, 158, 46, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#b7791f',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span style={{ lineHeight: '1.4' }}>{suggestion}</span>
        </div>
      ))}
    </div>
  );
}
