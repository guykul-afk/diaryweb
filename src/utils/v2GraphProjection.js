/**
 * v2GraphProjection.js
 * Projects Canonical Knowledge v2 (Assertions + Entities) into the standard
 * Node/Edge graph format consumed by DiaryWeb visualizers.
 */

export function projectV2ToGraph(v2Data) {
  if (!v2Data || !v2Data.entities || !v2Data.assertions) {
    return { nodes: [], links: [] };
  }

  const entityMap = new Map();
  const nodes = [];
  const links = [];
  
  // Exclude the author/user super-nodes to prevent graph hairballs
  const EXCLUDED_IDS = new Set(['גיא', 'concept_גיא', 'Guy']);
  const EXCLUDED_NAMES = new Set(['גיא']);

  // 1. Build Nodes from Entities
  v2Data.entities.forEach(ent => {
    if (EXCLUDED_IDS.has(ent.id) || EXCLUDED_NAMES.has(ent.canonicalName)) {
      return;
    }
    const nodeObj = {
      id: ent.id,
      name: ent.canonicalName,
      label: ent.canonicalName,
      type: ent.type || 'CONCEPT',
      aliases: ent.aliases || [],
      weight: 1,
      isPersonal: true,
      isTheoretical: false,
      epistemicOrigin: 'ONTOLOGY_V2_CORE'
    };
    entityMap.set(ent.id, nodeObj);
    nodes.push(nodeObj);
  });

  // 2. Build Links and Weights from Assertions
  const linkKeySet = new Set();

  v2Data.assertions.forEach(ast => {
    const sourceId = ast.subjectId;
    const targetId = ast.objectId;

    if (EXCLUDED_IDS.has(sourceId) || EXCLUDED_IDS.has(targetId)) {
      return;
    }
    // Also skip if it mapped to the excluded name
    if (sourceId === 'גיא' || targetId === 'גיא') {
      return; 
    }

    // Ensure subject node exists
    if (!entityMap.has(sourceId)) {
      const fallbackNode = {
        id: sourceId,
        name: sourceId.replace('entry_', 'רשומה: '),
        label: sourceId.replace('entry_', 'רשומה: '),
        type: sourceId.startsWith('entry_') ? 'EVENT' : 'CONCEPT',
        weight: 1,
        isPersonal: true,
        isTheoretical: false,
        epistemicOrigin: 'ONTOLOGY_V2_CORE'
      };
      entityMap.set(sourceId, fallbackNode);
      nodes.push(fallbackNode);
    }

    // Ensure object node exists if present
    if (targetId && !entityMap.has(targetId)) {
      const fallbackNode = {
        id: targetId,
        name: targetId.replace('concept_', ''),
        label: targetId.replace('concept_', ''),
        type: 'CONCEPT',
        weight: 1,
        isPersonal: true,
        isTheoretical: false,
        epistemicOrigin: 'ONTOLOGY_V2_CORE'
      };
      entityMap.set(targetId, fallbackNode);
      nodes.push(fallbackNode);
    }

    if (sourceId && targetId) {
      // Increase weights
      const sNode = entityMap.get(sourceId);
      const tNode = entityMap.get(targetId);
      if (sNode) sNode.weight = (sNode.weight || 1) + 1;
      if (tNode) tNode.weight = (tNode.weight || 1) + 1;

      const linkKey = `${sourceId}->${ast.predicate}->${targetId}`;
      if (!linkKeySet.has(linkKey)) {
        linkKeySet.add(linkKey);
        links.push({
          id: ast.id,
          source: sourceId,
          target: targetId,
          relation: ast.predicate,
          label: ast.predicate,
          rawPredicate: ast.rawPredicate || ast.predicate,
          epistemicStatus: ast.epistemicStatus || 'SELF_REPORTED',
          evidence: ast.evidence || null,
          weight: 1,
          isPersonal: true,
          isTheoretical: false
        });
      }
    }
  });

  return { nodes, links };
}
