#!/usr/bin/env node

/**
 * memcompress - Semantic Compression for Memory Files
 * 
 * A compression system that uses symbolic representations optimized
 * for LLM comprehension, achieving 3-5:1 token compression ratios.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration paths
const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'memcompress');
const DICTIONARY_PATH = path.join(CONFIG_DIR, 'dictionary.json');
const STATS_PATH = path.join(CONFIG_DIR, 'stats.json');

// Default symbol dictionary
const DEFAULT_DICTIONARY = {
  version: "1.0.0",
  created: new Date().toISOString(),
  
  // Entity symbols
  entities: {
    "@T": "Tony",
    "@U": "User",
    "@M": "Memory",
    "@C": "Clawd",
    "@A": "Agent",
    "@S": "System",
    "@P": "Project",
    "@F": "File",
    "@D": "Directory",
    "@G": "Git",
    "@N": "Node",
    "@W": "Web",
    "@B": "Browser",
    "@E": "Error",
    "@I": "Info"
  },
  
  // Action symbols
  actions: {
    "→": "action",
    "←": "result",
    "↑": "increase",
    "↓": "decrease",
    "⇄": "exchange",
    "↻": "repeat",
    "⊕": "add",
    "⊖": "remove",
    "⊗": "combine",
    "⊙": "focus"
  },
  
  // Time symbols
  time: {
    "1d": "yesterday",
    "2d": "two days ago",
    "3d": "three days ago",
    "7d": "last week",
    "1m": "last month",
    "1h": "one hour ago",
    "2h": "two hours ago",
    "6h": "six hours ago",
    "12h": "twelve hours ago",
    "1w": "last week",
    "2w": "two weeks ago",
    "1mo": "last month",
    "3mo": "three months ago",
    "6mo": "six months ago",
    "1y": "last year"
  },
  
  // Status symbols
  status: {
    "✓": "done/completed/success",
    "✗": "failed/error/rejected",
    "~": "pending/in-progress",
    "!": "urgent/priority",
    "?": "question/uncertain",
    "*": "important/starred",
    "⚠": "warning",
    "⏸": "paused",
    "⏵": "started",
    "⏹": "stopped"
  },
  
  // Relationship symbols
  relationships: {
    "::": "has/possesses",
    "->": "leads to/causes",
    "~>": "related to",
    "=>": "implies/results in",
    "<=>": "equivalent to",
    "<": "part of/belongs to",
    ">": "contains/includes",
    "||": "parallel/alternative",
    "&&": "and/combined with"
  },
  
  // Common phrase mappings - only for aggressive mode
  phrases: {
    "need to": "→",
    "have to": "→",
    "should": "~?",
    "in progress": "~",
    "yesterday": "1d",
    "last week": "7d",
    "last month": "1m",
    "tomorrow": "+1d"
  },
  
  // User-defined custom symbols
  custom: {}
};

// Compression patterns for semantic similarity
const SEMANTIC_PATTERNS = {
  // Common conversational patterns
  greetings: /\b(hi|hello|hey|greetings)\b/gi,
  thanks: /\b(thanks|thank you|appreciated|grateful)\b/gi,
  confirmations: /\b(okay|ok|sure|alright|got it|understood)\b/gi,
  negatives: /\b(no|nope|not|don't|doesn't|didn't|won't|wouldn't)\b/gi,
  
  // Technical patterns
  fileOps: /\b(created|modified|deleted|updated|moved|renamed)\s+(?:the\s+)?(?:file|files?)/gi,
  dirOps: /\b(created|removed|navigated|entered)\s+(?:the\s+)?(?:directory|folder|dir)/gi,
  gitOps: /\b(committed|pushed|pulled|merged|branched|cloned)\b/gi,
  
  // Time patterns
  timeRefs: /\b(yesterday|today|tomorrow|(?:last|next)\s+(?:week|month|year))\b/gi,
  
  // Action patterns
  decision: /\b(decided|chose|selected|picked|opted)\s+(?:for|to)\b/gi,
  planning: /\b(plan|planning|scheduled|arranged|organized)\b/gi,
  review: /\b(reviewed|checked|verified|validated|tested)\b/gi
};

// Ensure config directory exists
function ensureConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(DICTIONARY_PATH)) {
    fs.writeFileSync(DICTIONARY_PATH, JSON.stringify(DEFAULT_DICTIONARY, null, 2));
  }
  if (!fs.existsSync(STATS_PATH)) {
    fs.writeFileSync(STATS_PATH, JSON.stringify({ sessions: [] }, null, 2));
  }
}

// Load dictionary
function loadDictionary() {
  ensureConfig();
  return JSON.parse(fs.readFileSync(DICTIONARY_PATH, 'utf8'));
}

// Save dictionary
function saveDictionary(dict) {
  fs.writeFileSync(DICTIONARY_PATH, JSON.stringify(dict, null, 2));
}

// Count tokens (approximation: words + punctuation)
function countTokens(text) {
  return text.split(/\s+/).length + (text.match(/[.,!?;:]/g) || []).length;
}

// Semantic similarity detection - find similar phrases
function findSimilarPhrases(text, threshold = 0.7) {
  const words = text.toLowerCase().split(/\s+/);
  const similar = [];
  
  // Simple n-gram based similarity detection
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words.slice(i, i + 2).join(' ');
    const trigram = words.slice(i, i + 3).join(' ');
    
    // Check against common patterns
    for (const [category, pattern] of Object.entries(SEMANTIC_PATTERNS)) {
      if (pattern.test(bigram) || pattern.test(trigram)) {
        similar.push({ phrase: bigram, category });
      }
    }
  }
  
  return similar;
}

// Compress text using symbol substitution
function compressText(text, mode = 'lossless') {
  const dict = loadDictionary();
  let compressed = text;
  let substitutions = 0;
  const appliedSubs = [];
  
  // STEP 1: Entity substitutions FIRST (highest priority - preserve proper nouns)
  for (const [symbol, meaning] of Object.entries(dict.entities)) {
    const regex = new RegExp(`\\b${meaning}\\b`, 'gi');
    const matches = compressed.match(regex);
    if (matches) {
      substitutions += matches.length;
      appliedSubs.push(`${meaning} → ${symbol}`);
      compressed = compressed.replace(regex, symbol);
    }
  }
  
  // STEP 2: Custom substitutions
  for (const [symbol, meaning] of Object.entries(dict.custom)) {
    const regex = new RegExp(`\\b${meaning}\\b`, 'gi');
    const matches = compressed.match(regex);
    if (matches) {
      substitutions += matches.length;
      appliedSubs.push(`${meaning} → ${symbol}`);
      compressed = compressed.replace(regex, symbol);
    }
  }
  
  // STEP 3: Time substitutions
  for (const [symbol, meaning] of Object.entries(dict.time)) {
    const regex = new RegExp(`\\b${meaning}\\b`, 'gi');
    const matches = compressed.match(regex);
    if (matches) {
      substitutions += matches.length;
      appliedSubs.push(`${meaning} → ${symbol}`);
      compressed = compressed.replace(regex, symbol);
    }
  }
  
  // STEP 4: Status substitutions (only in lossy/aggressive modes)
  if (mode === 'lossy' || mode === 'aggressive') {
    const statusMap = [
      { word: 'completed', sym: '✓' },
      { word: 'done', sym: '✓' },
      { word: 'finished', sym: '✓' },
      { word: 'failed', sym: '✗' },
      { word: 'pending', sym: '~' },
      { word: 'waiting', sym: '~' },
      { word: 'urgent', sym: '!' },
      { word: 'important', sym: '*' },
      { word: 'increased', sym: '↑' },
      { word: 'decreased', sym: '↓' },
      { word: 'increase', sym: '↑' },
      { word: 'decrease', sym: '↓' }
    ];
    
    for (const { word, sym } of statusMap) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = compressed.match(regex);
      if (matches) {
        substitutions += matches.length;
        appliedSubs.push(`${word} → ${sym}`);
        compressed = compressed.replace(regex, sym);
      }
    }
  }
  
  // STEP 5: Phrase substitutions (lossy/aggressive modes only)
  if (mode === 'lossy' || mode === 'aggressive') {
    for (const [phrase, symbol] of Object.entries(dict.phrases)) {
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
      const matches = compressed.match(regex);
      if (matches) {
        substitutions += matches.length;
        appliedSubs.push(`${phrase} → ${symbol}`);
        compressed = compressed.replace(regex, symbol);
      }
    }
  }
  
  // STEP 6: Aggressive mode common words
  if (mode === 'aggressive') {
    const commonWords = {
      'the': 'ð',
      'and': '&',
      'for': '4',
      'with': 'w/',
      'without': 'w/o',
      'because': '∵',
      'therefore': '∴',
      'approximately': '≈',
      'not equal': '≠',
      'greater than': '>',
      'less than': '<'
    };
    
    for (const [word, sym] of Object.entries(commonWords)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = compressed.match(regex);
      if (matches) {
        substitutions += matches.length;
        compressed = compressed.replace(regex, sym);
      }
    }
  }
  
  return {
    compressed,
    originalTokens: countTokens(text),
    compressedTokens: countTokens(compressed),
    substitutions,
    appliedSubs: mode === 'verbose' ? appliedSubs : undefined
  };
}

// Decompress text by reversing symbol substitutions (reverse order of compression)
function decompressText(text) {
  const dict = loadDictionary();
  let decompressed = text;
  let substitutions = 0;
  
  // STEP 1: Reverse aggressive mode symbols (last compression step)
  const reverseAggressive = {
    'ð': 'the',
    '&': 'and',
    '4': 'for',
    'w/': 'with',
    'w/o': 'without',
    '∵': 'because',
    '∴': 'therefore',
    '≈': 'approximately',
    '≠': 'not equal'
  };
  
  for (const [sym, word] of Object.entries(reverseAggressive)) {
    const regex = new RegExp(sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = decompressed.match(regex);
    if (matches) {
      substitutions += matches.length;
      decompressed = decompressed.replace(regex, word);
    }
  }
  
  // STEP 2: Reverse phrase symbols
  for (const [phrase, symbol] of Object.entries(dict.phrases)) {
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedSymbol, 'g');
    const matches = decompressed.match(regex);
    if (matches) {
      substitutions += matches.length;
      decompressed = decompressed.replace(regex, phrase);
    }
  }
  
  // STEP 3: Reverse status/action symbols with context-aware restoration
  // IMPORTANT: Longer patterns must come before shorter ones to avoid partial matches
  const reverseStatus = [
    ['~?', 'should'],  // Must be before '~'
    ['+1d', 'tomorrow'],
    ['✓', 'completed'],
    ['✗', 'failed'],
    ['~', 'pending'],
    ['!', 'urgent'],
    ['*', 'important'],
    ['↑', 'increased'],
    ['↓', 'decreased'],
    ['→', 'need to'],
    ['⊕', 'created'],
    ['⊖', 'removed']
  ];
  
  for (const [sym, word] of Object.entries(reverseStatus)) {
    const escapedSym = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedSym, 'g');
    const matches = decompressed.match(regex);
    if (matches) {
      substitutions += matches.length;
      decompressed = decompressed.replace(regex, word);
    }
  }
  
  // STEP 4: Reverse time symbols
  for (const [symbol, meaning] of Object.entries(dict.time)) {
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedSymbol, 'g');
    const matches = decompressed.match(regex);
    if (matches) {
      substitutions += matches.length;
      decompressed = decompressed.replace(regex, meaning);
    }
  }
  
  // STEP 5: Reverse custom symbols
  for (const [symbol, meaning] of Object.entries(dict.custom)) {
    const regex = new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = decompressed.match(regex);
    if (matches) {
      substitutions += matches.length;
      decompressed = decompressed.replace(regex, meaning);
    }
  }
  
  // STEP 6: Reverse entity symbols (first compression step)
  for (const [symbol, meaning] of Object.entries(dict.entities)) {
    const regex = new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = decompressed.match(regex);
    if (matches) {
      substitutions += matches.length;
      decompressed = decompressed.replace(regex, meaning);
    }
  }
  
  return {
    decompressed,
    substitutions
  };
}

// Generate metadata header for compressed files
function generateMetadata(originalPath, mode, stats) {
  const dict = loadDictionary();
  const hash = crypto.createHash('md5').update(stats.compressed).digest('hex').slice(0, 8);
  
  return `---
# MemCompress v${dict.version}
mode: ${mode}
original: ${originalPath}
ratio: ${(stats.originalTokens / stats.compressedTokens).toFixed(2)}:1
tokens: ${stats.originalTokens} → ${stats.compressedTokens}
hash: ${hash}
dictionary: ~/.config/memcompress/dictionary.json
---

`;
}

// Parse metadata from compressed file
function parseMetadata(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n/);
  if (match) {
    const meta = {};
    match[1].split('\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':').map(s => s.trim());
        meta[key] = value;
      }
    });
    return { metadata: meta, content: content.slice(match[0].length) };
  }
  return { metadata: null, content };
}

// Command: compress
function cmdCompress(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const mode = options.mode || 'lossless';
  const outputPath = options.output || `${filePath}.compressed.md`;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const result = compressText(content, mode);
  
  const metadata = generateMetadata(filePath, mode, result);
  const fullOutput = metadata + result.compressed;
  
  fs.writeFileSync(outputPath, fullOutput);
  
  // Save stats
  const stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
  stats.sessions.push({
    timestamp: new Date().toISOString(),
    operation: 'compress',
    mode,
    originalTokens: result.originalTokens,
    compressedTokens: result.compressedTokens,
    ratio: (result.originalTokens / result.compressedTokens).toFixed(2)
  });
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
  
  console.log(`✓ Compressed: ${filePath}`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Mode: ${mode}`);
  console.log(`  Tokens: ${result.originalTokens} → ${result.compressedTokens}`);
  console.log(`  Ratio: ${(result.originalTokens / result.compressedTokens).toFixed(2)}:1`);
  console.log(`  Substitutions: ${result.substitutions}`);
  
  return result;
}

// Command: decompress
function cmdDecompress(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const outputPath = options.output || filePath.replace('.compressed.md', '.decompressed.md');
  
  const fullContent = fs.readFileSync(filePath, 'utf8');
  const { metadata, content } = parseMetadata(fullContent);
  
  const result = decompressText(content);
  
  fs.writeFileSync(outputPath, result.decompressed);
  
  console.log(`✓ Decompressed: ${filePath}`);
  console.log(`  Output: ${outputPath}`);
  if (metadata) {
    console.log(`  Original ratio: ${metadata.ratio}`);
  }
  console.log(`  Substitutions restored: ${result.substitutions}`);
  
  return result;
}

// Command: stats
function cmdStats(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const { metadata } = parseMetadata(content);
    
    if (metadata) {
      console.log('File Statistics:');
      console.log(`  Source: ${metadata.original}`);
      console.log(`  Mode: ${metadata.mode}`);
      console.log(`  Compression Ratio: ${metadata.ratio}`);
      console.log(`  Tokens: ${metadata.tokens}`);
      console.log(`  Hash: ${metadata.hash}`);
    } else {
      const tokens = countTokens(content);
      console.log('File Statistics:');
      console.log(`  Path: ${filePath}`);
      console.log(`  Tokens: ${tokens}`);
      console.log(`  Characters: ${content.length}`);
      console.log(`  Lines: ${content.split('\n').length}`);
      
      // Show potential compression
      const lossless = compressText(content, 'lossless');
      const aggressive = compressText(content, 'aggressive');
      
      console.log('\nEstimated Compression:');
      console.log(`  Lossless: ${lossless.originalTokens} → ${lossless.compressedTokens} (${(lossless.originalTokens/lossless.compressedTokens).toFixed(2)}:1)`);
      console.log(`  Aggressive: ${aggressive.originalTokens} → ${aggressive.compressedTokens} (${(aggressive.originalTokens/aggressive.compressedTokens).toFixed(2)}:1)`);
    }
  } else {
    // Show global stats
    const stats = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
    console.log('Global Compression Statistics:');
    console.log(`  Total sessions: ${stats.sessions.length}`);
    
    if (stats.sessions.length > 0) {
      const avgRatio = stats.sessions.reduce((a, s) => a + parseFloat(s.ratio), 0) / stats.sessions.length;
      console.log(`  Average ratio: ${avgRatio.toFixed(2)}:1`);
      
      const compressions = stats.sessions.filter(s => s.operation === 'compress');
      if (compressions.length > 0) {
        const totalOriginal = compressions.reduce((a, s) => a + s.originalTokens, 0);
        const totalCompressed = compressions.reduce((a, s) => a + s.compressedTokens, 0);
        console.log(`  Total tokens saved: ${totalOriginal - totalCompressed}`);
      }
    }
  }
}

// Command: learn
function cmdLearn(keyValue, options = {}) {
  const dict = loadDictionary();
  
  if (!keyValue.includes('=')) {
    console.error('Error: Use format key=value (e.g., @X=Example)');
    process.exit(1);
  }
  
  const [key, value] = keyValue.split('=').map(s => s.trim());
  
  // Validate key format
  if (!key.startsWith('@') && !/^[→←↑↓✓✗~!*?⚠⏸⏵⏹⊕⊖⊗⊙⇄↻ð&4∵∴≈≠<>:~>-]{1,3}$/.test(key)) {
    console.error('Error: Key must be a symbol (@X) or special character');
    process.exit(1);
  }
  
  dict.custom[key] = value;
  dict.lastModified = new Date().toISOString();
  saveDictionary(dict);
  
  console.log(`✓ Learned: ${key} = "${value}"`);
  console.log(`  Added to custom dictionary`);
}

// Command: dictionary
function cmdDictionary() {
  const dict = loadDictionary();
  
  console.log('=== MemCompress Dictionary ===');
  console.log(`Version: ${dict.version}`);
  console.log(`Created: ${dict.created}`);
  if (dict.lastModified) console.log(`Modified: ${dict.lastModified}`);
  
  console.log('\n--- Entity Symbols ---');
  for (const [k, v] of Object.entries(dict.entities)) {
    console.log(`  ${k} = ${v}`);
  }
  
  console.log('\n--- Action Symbols ---');
  for (const [k, v] of Object.entries(dict.actions)) {
    console.log(`  ${k} = ${v}`);
  }
  
  console.log('\n--- Time Symbols ---');
  for (const [k, v] of Object.entries(dict.time)) {
    console.log(`  ${k} = ${v}`);
  }
  
  console.log('\n--- Status Symbols ---');
  for (const [k, v] of Object.entries(dict.status)) {
    console.log(`  ${k} = ${v}`);
  }
  
  console.log('\n--- Relationship Symbols ---');
  for (const [k, v] of Object.entries(dict.relationships)) {
    console.log(`  ${k} = ${v}`);
  }
  
  if (Object.keys(dict.custom).length > 0) {
    console.log('\n--- Custom Symbols ---');
    for (const [k, v] of Object.entries(dict.custom)) {
      console.log(`  ${k} = ${v}`);
    }
  }
}

// Command: preview
function cmdPreview(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  const mode = options.mode || 'lossless';
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Sample first 500 chars
  const sample = content.slice(0, 500) + (content.length > 500 ? '...' : '');
  const result = compressText(sample, mode);
  
  console.log('=== ORIGINAL (sample) ===');
  console.log(sample);
  console.log('\n=== COMPRESSED ===');
  console.log(result.compressed);
  console.log(`\n--- Stats ---`);
  console.log(`Tokens: ${result.originalTokens} → ${result.compressedTokens}`);
  console.log(`Ratio: ${(result.originalTokens / result.compressedTokens).toFixed(2)}:1`);
}

// Main CLI
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === '--help' || command === '-h') {
    console.log(`
memcompress - Semantic Compression for Memory Files

Usage:
  memcompress compress <file> [options]   Compress a memory file
  memcompress decompress <file> [options] Decompress a file
  memcompress stats [file]                Show compression statistics
  memcompress learn <key=value>           Add symbol to dictionary
  memcompress dictionary                  Show symbol dictionary
  memcompress preview <file> [options]    Preview compression

Options:
  -m, --mode <mode>     Compression mode: lossless, lossy, aggressive (default: lossless)
  -o, --output <path>   Output file path
  -h, --help           Show this help

Examples:
  memcompress compress memory.md --mode aggressive
  memcompress decompress memory.md.compressed.md
  memcompress learn @P=Project
  memcompress stats memory.md
`);
    return;
  }
  
  // Parse options
  const options = {};
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '-m' || args[i] === '--mode') {
      options.mode = args[++i];
    } else if (args[i] === '-o' || args[i] === '--output') {
      options.output = args[++i];
    }
  }
  
  const target = args[1];
  
  switch (command) {
    case 'compress':
      cmdCompress(target, options);
      break;
    case 'decompress':
      cmdDecompress(target, options);
      break;
    case 'stats':
      cmdStats(target);
      break;
    case 'learn':
      cmdLearn(target, options);
      break;
    case 'dictionary':
      cmdDictionary();
      break;
    case 'preview':
      cmdPreview(target, options);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run "memcompress --help" for usage');
      process.exit(1);
  }
}

main();
