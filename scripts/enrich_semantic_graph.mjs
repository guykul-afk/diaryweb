import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { enrichGraphData } from '../src/utils/semanticGraphEnricher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const inputFilePath = process.argv.find(arg => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1])
  ? path.resolve(process.argv.find(arg => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1]))
  : path.join(rootDir, 'tkb_graph.json');

console.log(`Loading graph file from: ${inputFilePath}`);

if (!fs.existsSync(inputFilePath)) {
  console.error(`Error: File not found at ${inputFilePath}`);
  process.exit(1);
}

try {
  const rawData = fs.readFileSync(inputFilePath, 'utf8');
  const graphData = JSON.parse(rawData);

  const initialNodesCount = graphData.nodes?.length || 0;
  const initialEdgesCount = graphData.edges?.length || graphData.links?.length || 0;
  console.log(`Initial graph data loaded: ${initialNodesCount} nodes, ${initialEdgesCount} edges.`);

  const startTime = Date.now();
  const enriched = enrichGraphData(graphData);
  const duration = Date.now() - startTime;

  console.log(`Enrichment complete in ${duration}ms.`);
  console.log(`Enriched ${enriched.nodes.length} nodes and ${enriched.edges.length} edges.`);

  // Calculate statistics
  const categoryStats = {};
  const sentimentStats = {};
  enriched.nodes.forEach(node => {
    categoryStats[node.parent_category] = (categoryStats[node.parent_category] || 0) + 1;
    sentimentStats[node.sentiment] = (sentimentStats[node.sentiment] || 0) + 1;
  });

  const edgeTypeStats = {};
  const directionStats = {};
  enriched.edges.forEach(edge => {
    edgeTypeStats[edge.edge_type] = (edgeTypeStats[edge.edge_type] || 0) + 1;
    directionStats[edge.direction] = (directionStats[edge.direction] || 0) + 1;
  });

  console.log('\n--- Node Parent Categories ---');
  console.table(categoryStats);

  console.log('\n--- Node Sentiments ---');
  console.table(sentimentStats);

  console.log('\n--- Edge Types ---');
  console.table(edgeTypeStats);

  console.log('\n--- Edge Directions ---');
  console.table(directionStats);

  console.log('\n--- Sample Enriched Nodes ---');
  console.log(JSON.stringify(enriched.nodes.slice(0, 3), null, 2));

  console.log('\n--- Sample Enriched Edges ---');
  console.log(JSON.stringify(enriched.edges.slice(0, 3), null, 2));

  if (process.argv.includes('--write')) {
    const outputPath = inputFilePath.replace('.json', '_enriched.json');
    fs.writeFileSync(outputPath, JSON.stringify(enriched, null, 2), 'utf8');
    console.log(`\nSuccessfully wrote enriched graph to ${outputPath}`);
  }

} catch (err) {
  console.error('Error executing semantic graph enricher:', err);
  process.exit(1);
}
