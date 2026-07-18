import React, { useEffect, useRef, useState } from 'react';
import { useDiaryData } from './hooks/useDiaryData';
import { fetchTheoreticalConcepts } from './firebase';

export default function KnowledgeBaseGraphView({ onNavigateToEntry }) {
  const { conceptMetadataMap } = useDiaryData();
  const [kbData, setKbData] = useState({ nodes: [], links: [] });
  const iframeRef = useRef(null);

  useEffect(() => {
    // Fetch only the theoretical concepts from Firestore
    fetchTheoreticalConcepts()
      .then(data => {
        setKbData(data);
      })
      .catch(err => {
        console.error("Failed to fetch theoretical concepts:", err);
      });
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data) return;
      
      if (event.data.type === 'OPEN_LOCAL_FILE') {
        const absolutePath = `/Users/guy/webdiary/${event.data.path}`;
        window.open(`file://${absolutePath}`, '_blank');
      }
      
      if (event.data.type === 'GET_LINKED_ENTRIES') {
        const label = event.data.label || '';
        const meta = conceptMetadataMap[label.toLowerCase()];
        
        if (event.source) {
          event.source.postMessage({
            type: 'LINKED_ENTRIES_RESPONSE',
            label: label,
            entries: meta ? meta.entries : []
          }, '*');
        }
      }
      
      if (event.data.type === 'OPEN_ENTRY') {
        if (onNavigateToEntry && event.data.entryId) {
          onNavigateToEntry(event.data.entryId);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [conceptMetadataMap, onNavigateToEntry]);

  useEffect(() => {
    if (!iframeRef.current || !kbData.nodes.length) return;
    
    const sendData = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          type: 'UPDATE_GRAPH_DATA',
          nodes: kbData.nodes,
          links: kbData.links
        }, '*');
      }
    };

    const iframe = iframeRef.current;
    const handleLoad = () => {
      setTimeout(sendData, 300);
    };

    iframe.addEventListener('load', handleLoad);
    sendData(); // Trigger immediately in case it's already loaded

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [kbData]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0f172a' }}>
      <iframe 
        ref={iframeRef}
        src="/knowledge_graph.html?v=13" 
        title="Knowledge Graph"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </div>
  );
}
