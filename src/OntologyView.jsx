import React, { useState, useEffect } from 'react';
import { useDiaryData } from './hooks/useDiaryData';
import { 
  Sparkles, 
  Layers, 
  GitPullRequest, 
  Users, 
  Link2, 
  Activity, 
  Check, 
  X, 
  Plus, 
  ShieldAlert, 
  BookOpen, 
  ChevronRight,
  TrendingUp
} from 'lucide-react';

export default function OntologyView() {
  const { v2RawData } = useDiaryData();
  const [activeSection, setActiveSection] = useState('incubator'); // 'incubator' | 'concepts' | 'entities' | 'relations'
  const [candidates, setCandidates] = useState([]);
  const [backlog, setBacklog] = useState([]);
  const [entityGroups, setEntityGroups] = useState([]);
  const [relations, setRelations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Concept statuses state (15 concepts)
  const [conceptStatuses, setConceptStatuses] = useState({
    SourceEntry: 'CORE',
    Entity: 'CORE',
    Event: 'CORE',
    Assertion: 'CORE',
    Evidence: 'CORE',
    Insight: 'CORE',
    Mention: 'ACTIVE',
    State: 'ACTIVE',
    RelationshipState: 'ACTIVE',
    Decision: 'ACTIVE',
    Stance: 'ACTIVE',
    Pattern: 'ACTIVE',
    Hypothesis: 'OBSERVING',
    Contradiction: 'ACTIVE',
    Question: 'ACTIVE'
  });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Load entity reconciliation candidates
        const entResp = await fetch('/entity_review_candidates.json');
        if (entResp.ok) {
          const entData = await entResp.json();
          setEntityGroups(entData);
        }

        // Load knowledge v2 metadata / backlog
        const v2Resp = await fetch('/knowledge_v2.json');
        if (v2Resp.ok) {
          const v2Data = await v2Resp.json();
          setBacklog(v2Data.semanticBacklog || []);
        }

        // Default incubator candidates derived from backlog pressure
        setCandidates([
          {
            id: 'cand_distancing',
            proposalType: 'NEW_RELATION',
            proposedName: 'RELATIONSHIP_DISTANCING',
            hebrewLabel: 'התרחקות / צינון יחסים',
            occurrences: 31,
            expansionScore: 84.5,
            suggestedStatus: 'EXPERIMENTAL',
            status: 'CANDIDATE',
            evidenceSample: 'הרגשתי שהוא מתחיל להתרחק ממני לאחרונה'
          },
          {
            id: 'cand_burnout',
            proposalType: 'NEW_SUBTYPE',
            proposedName: 'BURNOUT_STATE',
            hebrewLabel: 'מצב שחיקה',
            occurrences: 19,
            expansionScore: 62.0,
            suggestedStatus: 'OBSERVING',
            status: 'CANDIDATE',
            evidenceSample: 'עומס כבד בעבודה שמוביל לעייפות כרונית'
          }
        ]);

        // Default canonical relations
        setRelations([
          { id: 'RELATED_TO', label: 'קשור ל', count: 45, status: 'CORE', aliases: ['קשור_ל', 'נוגע_ל'] },
          { id: 'ABOUT', label: 'עוסק ב', count: 296, status: 'CORE', aliases: ['עוסק_ב', 'מדבר_על'] },
          { id: 'PARTICIPATED_IN', label: 'השתתף ב', count: 18, status: 'CORE', aliases: ['נפגש_עם', 'היה_ב'] },
          { id: 'CONTRIBUTES_TO', label: 'מוביל ל / משפיע על', count: 542, status: 'CORE', aliases: ['הוביל_ל', 'מוביל_ל', 'השפיע_על', 'גרם_ל'] },
          { id: 'EXPERIENCES', label: 'חווה / מרגיש', count: 936, status: 'CORE', aliases: ['חווה_את', 'מרגיש_כלפי'] },
          { id: 'COMMITTED_TO', label: 'מתחייב ל', count: 899, status: 'CORE', aliases: ['מתחייב_ל', 'מתכנן'] },
          { id: 'WORKS_ON', label: 'עובד על', count: 434, status: 'CORE', aliases: ['עובד_על', 'פועל_למען'] },
          { id: 'CONTRADICTS', label: 'סותר / מתנגש', count: 220, status: 'CORE', aliases: ['מתנגש_עם', 'סותר'] }
        ]);

      } catch (e) {
        console.error("Failed to load ontology data", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleApproveCandidate = (candId) => {
    setCandidates(prev => prev.map(c => c.id === candId ? { ...c, status: 'PROMOTED_TO_INCUBATOR' } : c));
    alert("ההצעה אושרה והועברה לחממת הניסוי (Shadow Extraction)!");
  };

  const handleRejectCandidate = (candId) => {
    setCandidates(prev => prev.map(c => c.id === candId ? { ...c, status: 'REJECTED' } : c));
  };

  const toggleConceptStatus = (conceptName) => {
    const isCore = ['SourceEntry', 'Entity', 'Event', 'Assertion', 'Evidence', 'Insight'].includes(conceptName);
    if (isCore) {
      alert("מושג CORE הוא קבוע ואינו ניתן להרדמה או הסרה.");
      return;
    }
    setConceptStatuses(prev => {
      const current = prev[conceptName];
      const next = current === 'ACTIVE' ? 'DORMANT' : current === 'DORMANT' ? 'OBSERVING' : 'ACTIVE';
      return { ...prev, [conceptName]: next };
    });
  };

  return (
    <div className="ontology-view-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f1f5f9',
      padding: '24px 32px',
      overflowY: 'auto'
    }} dir="rtl">
      
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '20px',
        marginBottom: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              Ontology v2 Adaptive
            </span>
            <span style={{ fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ● מנוע האבולוציה פעיל
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>
            מרכז שליטה והתערבות באונטולוגיה (Ontology Studio)
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            ניהול 15 המושגים הקנוניים, אישור הצעות הרחבה מהחממה, ויישוב זהויות ויחסים גולמיים.
          </p>
        </div>

        {/* Quick Metrics */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '10px 16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>לחץ סמנטי</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8' }}>נמוך (Low)</div>
          </div>
          <div style={{
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '10px 16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>הצעות בחממה</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#a855f7' }}>{candidates.filter(c => c.status === 'CANDIDATE').length} ממתינות</div>
          </div>
        </div>
      </div>

      {/* Sub-nav Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '12px',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => setActiveSection('incubator')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeSection === 'incubator' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            border: `1px solid ${activeSection === 'incubator' ? '#6366f1' : 'transparent'}`,
            color: activeSection === 'incubator' ? '#ffffff' : '#94a3b8',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}
        >
          <Sparkles size={16} color={activeSection === 'incubator' ? '#818cf8' : '#94a3b8'} />
          חממת הרחבות והצעות ({candidates.length})
        </button>

        <button
          onClick={() => setActiveSection('concepts')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeSection === 'concepts' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            border: `1px solid ${activeSection === 'concepts' ? '#6366f1' : 'transparent'}`,
            color: activeSection === 'concepts' ? '#ffffff' : '#94a3b8',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}
        >
          <Layers size={16} color={activeSection === 'concepts' ? '#818cf8' : '#94a3b8'} />
          15 המושגים וניהול סטטוסים
        </button>

        <button
          onClick={() => setActiveSection('entities')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeSection === 'entities' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            border: `1px solid ${activeSection === 'entities' ? '#6366f1' : 'transparent'}`,
            color: activeSection === 'entities' ? '#ffffff' : '#94a3b8',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}
        >
          <Users size={16} color={activeSection === 'entities' ? '#818cf8' : '#94a3b8'} />
          יישוב ישויות וכינויים
        </button>

        <button
          onClick={() => setActiveSection('relations')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeSection === 'relations' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            border: `1px solid ${activeSection === 'relations' ? '#6366f1' : 'transparent'}`,
            color: activeSection === 'relations' ? '#ffffff' : '#94a3b8',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}
        >
          <Link2 size={16} color={activeSection === 'relations' ? '#818cf8' : '#94a3b8'} />
          ספריית יחסים ו-Backlog
        </button>
      </div>

      {/* Section Content */}
      <div style={{ flexGrow: 1 }}>

        {/* 1. INCUBATOR */}
        {activeSection === 'incubator' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '0.88rem',
              color: '#cbd5e1'
            }}>
              💡 <strong>סולם הרחבה (Expansion Ladder):</strong> כאשר מנוע האבולוציה מזהה דפוס חוזר או לחץ סמנטי, הוא אינו מוסיף שכבה מיד אלא מייצר הצעה שקולה ומחושבת. התערבותך מאפשרת לאשר כניסה לחממת ניסוי (Shadow Extraction) או לדחות.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
              {candidates.map(cand => (
                <div key={cand.id} style={{
                  background: '#111827',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#a855f7', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {cand.proposalType}
                      </span>
                      <h3 style={{ margin: '4px 0 0 0', fontSize: '1.1rem', color: '#ffffff' }}>
                        {cand.hebrewLabel} <span style={{ fontSize: '0.8rem', color: '#64748b', fontMono: true }}>({cand.proposedName})</span>
                      </h3>
                    </div>
                    <span style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}>
                      ציון: {cand.expansionScore}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    מופעים שזוהו ביומן: <strong>{cand.occurrences} פעמים</strong>
                  </div>

                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRight: '3px solid #6366f1',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    color: '#e2e8f0',
                    fontStyle: 'italic'
                  }}>
                    "{cand.evidenceSample}"
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', gap: '8px' }}>
                    {cand.status === 'CANDIDATE' ? (
                      <>
                        <button
                          onClick={() => handleApproveCandidate(cand.id)}
                          style={{
                            flex: 1,
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px',
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Check size={16} /> אשר לחממה
                        </button>
                        <button
                          onClick={() => handleRejectCandidate(cand.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <X size={16} /> דחה
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: cand.status === 'REJECTED' ? '#f87171' : '#10b981', fontWeight: 'bold' }}>
                        {cand.status === 'REJECTED' ? '✕ הצעה נדחתה' : '✓ מאושר בחממה (בניסוי)'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. CONCEPTS */}
        {activeSection === 'concepts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              6 מושגי ליבה קבועים (Core) לעולם אינם מוסרים. 9 מושגים מורחבים ניתנים להפעלה או הרדמה בהתאם לצורך:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {Object.entries(conceptStatuses).map(([name, status]) => {
                const isCore = status === 'CORE';
                return (
                  <div key={name} style={{
                    background: '#111827',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '0.95rem' }}>{name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {isCore ? 'ליבה אפיסטמית בלתי-משתנה' : 'מושג קנוני מורחב'}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleConceptStatus(name)}
                      style={{
                        background: isCore ? 'rgba(99, 102, 241, 0.2)' : status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                        color: isCore ? '#818cf8' : status === 'ACTIVE' ? '#10b981' : '#94a3b8',
                        border: `1px solid ${isCore ? 'rgba(99, 102, 241, 0.4)' : status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(148, 163, 184, 0.3)'}`,
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        cursor: isCore ? 'default' : 'pointer'
                      }}
                    >
                      {status}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. ENTITIES */}
        {activeSection === 'entities' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              ניהול ואיחוד זהויות Person ללא מחיקה הרסנית (Reversible Canonical Resolution):
            </p>

            {entityGroups.map(group => (
              <div key={group.groupKey} style={{
                background: '#111827',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ fontWeight: 'bold', color: '#a5b4fc', marginBottom: '10px' }}>
                  קבוצת דמיון: "{group.groupKey}"
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {group.candidates.map(cand => (
                    <div key={cand.id} style={{
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      minWidth: '180px'
                    }}>
                      <div style={{ fontWeight: 'bold', color: '#ffffff' }}>{cand.canonicalName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{cand.occurrencesCount} מופעים ביומן</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 4. RELATIONS */}
        {activeSection === 'relations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              15 היחסים הקנוניים הפעילים וה-Aliases המשויכים אליהם:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
              {relations.map(rel => (
                <div key={rel.id} style={{
                  background: '#111827',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '14px 18px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '0.95rem' }}>{rel.label}</span>
                    <span style={{ fontMono: true, fontSize: '0.75rem', color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      {rel.id}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    שכיחות: <strong>{rel.count} טענות</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px' }}>
                    כינויים (Aliases): {rel.aliases.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
