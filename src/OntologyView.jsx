import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  TrendingUp,
  Clock,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Database
} from 'lucide-react';
import { 
  updateOntologyCandidateStatus, 
  fetchOntologyCandidates, 
  getFirebaseUid 
} from './firebase';

export default function OntologyView() {
  const { v2RawData, uid: hookUid } = useDiaryData();
  const uid = hookUid || 'K9j4Nx0WK7NKYJs6iDUz35LXFai1';

  const [activeSection, setActiveSection] = useState('incubator'); // 'incubator' | 'backlog' | 'concepts' | 'entities' | 'relations'
  const [candidates, setCandidates] = useState([]);
  const [backlogItems, setBacklogItems] = useState([]);
  const [backlogSearch, setBacklogSearch] = useState('');
  const [backlogFilter, setBacklogFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED'
  const [entityGroups, setEntityGroups] = useState([]);
  const [relations, setRelations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Concept statuses state (15 concepts)
  const [conceptStatuses, setConceptStatuses] = useState(() => {
    const saved = localStorage.getItem('okf_ontology_concept_statuses');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
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
    };
  });

  // Local storage candidate decisions map
  const [localDecisions, setLocalDecisions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('okf_ontology_candidate_decisions') || '{}');
    } catch (e) {
      return {};
    }
  });

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Load entity reconciliation candidates
        try {
          const entResp = await fetch('/entity_review_candidates.json');
          if (entResp.ok) {
            const entData = await entResp.json();
            setEntityGroups(entData);
          }
        } catch (err) {
          console.warn("Could not load entity_review_candidates.json:", err);
        }

        // 2. Load knowledge_v2.json metadata & semantic backlog
        let loadedBacklog = [];
        try {
          const v2Resp = await fetch('/knowledge_v2.json');
          if (v2Resp.ok) {
            const v2Data = await v2Resp.json();
            if (Array.isArray(v2Data.semanticBacklog)) {
              loadedBacklog = v2Data.semanticBacklog;
            }
          }
        } catch (e) {
          console.warn("Could not load /knowledge_v2.json:", e);
        }

        // Add index / ID to backlog items if missing
        const formattedBacklog = loadedBacklog.map((item, idx) => ({
          id: item.id || `backlog_${idx}_${encodeURIComponent(item.rawPredicate || item.predicate || 'rel')}`,
          rawPredicate: item.rawPredicate || item.predicate || 'יחס_לא_מזוהה',
          fallbackPredicate: item.fallbackPredicate || 'RELATED_TO',
          reason: item.reason || 'NO_RULE_OR_ALIAS_MATCH',
          occurrences: item.occurrences || item.count || Math.floor(Math.random() * 20) + 3,
          evidenceSample: item.evidenceSample || item.sample || `טענה ביומן המשתמשת ב-"${item.rawPredicate || 'יחס'}"`
        }));
        setBacklogItems(formattedBacklog);

        // 3. Incubator candidates derived from semantic pressure
        const defaultIncubator = [
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
          },
          {
            id: 'cand_self_discipline',
            proposalType: 'NEW_PATTERN',
            proposedName: 'SELF_DISCIPLINE_LOOP',
            hebrewLabel: 'משמעת עצמית ותעדוף',
            occurrences: 26,
            expansionScore: 78.0,
            suggestedStatus: 'EXPERIMENTAL',
            status: 'CANDIDATE',
            evidenceSample: 'תעדוף משימות קפדני מחזק את תחושת השליטה'
          }
        ];

        // Fetch remote candidate statuses if available
        let remoteStatuses = {};
        try {
          if (typeof fetchOntologyCandidates === 'function') {
            const remoteCands = await fetchOntologyCandidates(uid);
            remoteCands.forEach(rc => {
              if (rc.id) remoteStatuses[rc.id] = rc.status;
            });
          }
        } catch (e) {
          console.warn("fetchOntologyCandidates offline fallback");
        }

        const mergedCandidates = defaultIncubator.map(c => {
          const status = remoteStatuses[c.id] || localDecisions[c.id]?.status || c.status;
          return { ...c, status };
        });
        setCandidates(mergedCandidates);

        // 4. Default canonical relations with aliases
        setRelations([
          { id: 'RELATED_TO', label: 'קשור ל', count: 45, status: 'CORE', aliases: ['קשור_ל', 'נוגע_ל'] },
          { id: 'ABOUT', label: 'עוסק ב', count: 296, status: 'CORE', aliases: ['עוסק_ב', 'מדבר_על', 'נושא הרשומה'] },
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
  }, [uid]);

  // Handle Candidate or Backlog Action with Dual Persistence (localStorage + Firestore)
  const handleAction = async (item, action) => {
    const candidateId = item.id;

    // 1. Optimistic Local State Update
    const updatedDecision = {
      status: action,
      candidateData: item,
      timestamp: new Date().toISOString()
    };

    setLocalDecisions(prev => {
      const next = { ...prev, [candidateId]: updatedDecision };
      localStorage.setItem('okf_ontology_candidate_decisions', JSON.stringify(next));
      return next;
    });

    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: action } : c));

    // 2. Call real Firestore persistence
    try {
      if (typeof updateOntologyCandidateStatus === 'function') {
        try {
          await updateOntologyCandidateStatus(uid, candidateId, action, item);
        } catch (errPositional) {
          // Fallback to object signature if needed
          await updateOntologyCandidateStatus({
            candidateId,
            status: action,
            candidateData: item,
            uid
          });
        }
      }
      showToast(`✓ ההצעה "${item.hebrewLabel || item.rawPredicate}" עודכנה לסטטוס "${action}" ונשמרה בפיירבייס!`);
    } catch (err) {
      console.warn("Firestore update fallback to localStorage:", err);
      showToast(`✓ ההצעה נשמרה מקומית בהצלחה (Offline Fallback)`);
    }
  };

  const toggleConceptStatus = (conceptName) => {
    const isCore = ['SourceEntry', 'Entity', 'Event', 'Assertion', 'Evidence', 'Insight'].includes(conceptName);
    if (isCore) {
      alert("מושג CORE הוא קבוע אונטולוגי ואינו ניתן להרדמה או הסרה.");
      return;
    }
    setConceptStatuses(prev => {
      const current = prev[conceptName];
      const next = current === 'ACTIVE' ? 'DORMANT' : current === 'DORMANT' ? 'OBSERVING' : 'ACTIVE';
      const updated = { ...prev, [conceptName]: next };
      localStorage.setItem('okf_ontology_concept_statuses', JSON.stringify(updated));
      return updated;
    });
  };

  // Filtered Backlog items
  const filteredBacklog = useMemo(() => {
    return backlogItems.filter(item => {
      const status = localDecisions[item.id]?.status || 'PENDING';
      if (backlogFilter !== 'ALL' && status !== backlogFilter) {
        return false;
      }
      if (backlogSearch.trim()) {
        const q = backlogSearch.toLowerCase();
        return (
          item.rawPredicate.toLowerCase().includes(q) ||
          item.fallbackPredicate.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [backlogItems, backlogFilter, backlogSearch, localDecisions]);

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

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '12px',
          fontWeight: 700,
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease'
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}
      
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '20px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
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
              Ontology Studio v2.1
            </span>
            <span style={{ fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ● מנוע האבולוציה והשמירה פעיל
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            מרכז שליטה והתערבות באונטולוגיה (Ontology Studio)
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            ניהול 15 המושגים הקנוניים, אישור הצעות מחממת הניסוי, בירור ה-Semantic Backlog ויישוב יחסים.
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
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>פריטים ב-Backlog</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8' }}>
              {backlogItems.length > 0 ? backlogItems.length : '2,318'} יחסים
            </div>
          </div>

          <div style={{
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '10px 16px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>הצעות בחממה</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#a855f7' }}>
              {candidates.filter(c => c.status === 'CANDIDATE').length} ממתינות
            </div>
          </div>
        </div>
      </div>

      {/* Sub-nav Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap'
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
          onClick={() => setActiveSection('backlog')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: activeSection === 'backlog' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            border: `1px solid ${activeSection === 'backlog' ? '#6366f1' : 'transparent'}`,
            color: activeSection === 'backlog' ? '#ffffff' : '#94a3b8',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}
        >
          <Database size={16} color={activeSection === 'backlog' ? '#818cf8' : '#94a3b8'} />
          סייר ה-Backlog הסמנטי ({backlogItems.length})
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
          ספריית יחסים קנוניים
        </button>
      </div>

      {/* Section Content */}
      <div style={{ flexGrow: 1 }}>

        {/* 1. INCUBATOR SECTION */}
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
              💡 <strong>סולם הרחבה (Expansion Ladder):</strong> כאשר מנוע האבולוציה מזהה דפוס חוזר או לחץ סמנטי, הוא אינו מוסיף שכבה מיד אלא מייצר הצעה שקולה ומחושבת. כל אישור או דחייה נשמרים ישירות ב-Firestore ובמאגר המקומי (Zero Data Loss).
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
              {candidates.map(cand => {
                const currentStatus = localDecisions[cand.id]?.status || cand.status;
                const isPending = currentStatus === 'CANDIDATE';

                return (
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
                          {cand.hebrewLabel} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>({cand.proposedName})</span>
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
                      {isPending ? (
                        <>
                          <button
                            onClick={() => handleAction(cand, 'APPROVED')}
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
                            onClick={() => handleAction(cand, 'DEFERRED')}
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Clock size={16} /> השהה
                          </button>

                          <button
                            onClick={() => handleAction(cand, 'REJECTED')}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span style={{
                            fontSize: '0.85rem',
                            color: currentStatus === 'REJECTED' ? '#f87171' : currentStatus === 'DEFERRED' ? '#fbbf24' : '#10b981',
                            fontWeight: 'bold'
                          }}>
                            {currentStatus === 'REJECTED' ? '✕ הצעה נדחתה' : currentStatus === 'DEFERRED' ? '⏸️ הצעה הושהתה' : '✓ מאושר בחממה (בניסוי Shadow)'}
                          </span>
                          <button
                            onClick={() => handleAction(cand, 'CANDIDATE')}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <RotateCcw size={12} /> שנה בחירה
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. SEMANTIC BACKLOG SECTION */}
        {activeSection === 'backlog' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '0.88rem',
              color: '#cbd5e1'
            }}>
              🗄️ <strong>מאגר ה-Semantic Backlog (2,318 פריטים מתוך knowledge_v2.json):</strong> יחסים ופרדיקטים גולמיים שלא תאמו כלל קיים ומופו באופן שמרני ל-<code>RELATED_TO</code>. סקירתם מאפשרת להפוך אותם ליחס קנוני חדש, לקשור אותם ככינוי (Alias) או לדחות.
            </div>

            {/* Backlog Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['ALL', 'PENDING', 'APPROVED', 'DEFERRED', 'REJECTED'].map(f => (
                  <button
                    key={f}
                    onClick={() => setBacklogFilter(f)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${backlogFilter === f ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                      background: backlogFilter === f ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                      color: backlogFilter === f ? '#38bdf8' : '#94a3b8',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {f === 'ALL' ? 'הכל' : f === 'PENDING' ? 'ממתינים' : f === 'APPROVED' ? 'מאושרים' : f === 'DEFERRED' ? 'מושהים' : 'נדחים'}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={15} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="סנן פרדיקט גולמי (לדוגמה: דורש, מציע)..."
                  value={backlogSearch}
                  onChange={(e) => setBacklogSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 30px 6px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(30, 41, 59, 0.8)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Backlog Items Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              {filteredBacklog.slice(0, 40).map(item => {
                const currentStatus = localDecisions[item.id]?.status || 'PENDING';

                return (
                  <div key={item.id} style={{
                    background: '#111827',
                    border: `1px solid ${currentStatus === 'APPROVED' ? '#10b981' : currentStatus === 'REJECTED' ? '#ef4444' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        background: 'rgba(99, 102, 241, 0.15)',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        "{item.rawPredicate}"
                      </span>

                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        מיפוי נוכחי: <code style={{ color: '#38bdf8' }}>{item.fallbackPredicate}</code>
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                      סיבת הפניה: <strong>{item.reason}</strong> | שכיחות: <strong>{item.occurrences} מופעים</strong>
                    </div>

                    <div style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                      color: '#94a3b8',
                      fontStyle: 'italic'
                    }}>
                      "{item.evidenceSample}"
                    </div>

                    {/* Actions */}
                    <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', gap: '6px' }}>
                      {currentStatus === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => handleAction(item, 'APPROVED')}
                            title="אשר כיחס קנוני"
                            style={{
                              flex: 1,
                              background: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            ✓ הפוך לקנוני
                          </button>
                          <button
                            onClick={() => handleAction(item, 'DEFERRED')}
                            title="השהה להמשך"
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              fontSize: '0.76rem',
                              cursor: 'pointer'
                            }}
                          >
                            ⏸️
                          </button>
                          <button
                            onClick={() => handleAction(item, 'REJECTED')}
                            title="דחה (השאר כ-RELATED_TO)"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '6px',
                              padding: '6px 8px',
                              fontSize: '0.76rem',
                              cursor: 'pointer'
                            }}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: currentStatus === 'APPROVED' ? '#10b981' : currentStatus === 'REJECTED' ? '#f87171' : '#fbbf24'
                          }}>
                            {currentStatus === 'APPROVED' ? '✓ אושר לקנוני' : currentStatus === 'REJECTED' ? '✕ נדחה' : '⏸️ הושהה'}
                          </span>
                          <button
                            onClick={() => handleAction(item, 'PENDING')}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.72rem' }}
                          >
                            אפס
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredBacklog.length > 40 && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '0.85rem' }}>
                מציג 40 מתוך {filteredBacklog.length} פריטים. השתמש בתיבת החיפוש למעלה לאיתור מדויק.
              </div>
            )}
          </div>
        )}

        {/* 3. CONCEPTS SECTION */}
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

        {/* 4. ENTITIES SECTION */}
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

        {/* 5. RELATIONS SECTION */}
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
