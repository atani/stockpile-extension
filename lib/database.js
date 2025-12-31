// Database for managing download metadata

const DB_KEY = 'downloadHistory';

/**
 * Generate a unique ID
 * @returns {string} UUID
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * Get all download records
 * @returns {Promise<Array>} Array of download records
 */
export async function getAllRecords() {
  const result = await chrome.storage.local.get(DB_KEY);
  return result[DB_KEY] || [];
}

/**
 * Add a new download record
 * @param {Object} record - Download metadata
 * @returns {Promise<Object>} Created record with ID
 */
export async function addRecord(record) {
  const records = await getAllRecords();

  const newRecord = {
    id: generateId(),
    title: record.title || 'Unknown',
    fileName: record.fileName || '',
    filePath: record.filePath || '',
    category: record.category || 'Other',
    site: record.site || 'Unknown',
    sourceUrl: record.sourceUrl || '',
    tags: record.tags || [],
    duration: record.duration || null,
    downloadedAt: new Date().toISOString(),
    ...record,
    id: generateId() // Ensure ID is always new
  };

  records.unshift(newRecord); // Add to beginning (newest first)
  await chrome.storage.local.set({ [DB_KEY]: records });

  return newRecord;
}

/**
 * Update a record
 * @param {string} id - Record ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated record or null
 */
export async function updateRecord(id, updates) {
  const records = await getAllRecords();
  const index = records.findIndex(r => r.id === id);

  if (index === -1) return null;

  records[index] = { ...records[index], ...updates };
  await chrome.storage.local.set({ [DB_KEY]: records });

  return records[index];
}

/**
 * Delete a record
 * @param {string} id - Record ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteRecord(id) {
  const records = await getAllRecords();
  const filtered = records.filter(r => r.id !== id);

  if (filtered.length === records.length) return false;

  await chrome.storage.local.set({ [DB_KEY]: filtered });
  return true;
}

/**
 * Search records
 * @param {Object} filters - Search filters
 * @returns {Promise<Array>} Matching records
 */
export async function searchRecords(filters = {}) {
  let records = await getAllRecords();

  // Text search (title, tags)
  if (filters.query) {
    const query = filters.query.toLowerCase();
    records = records.filter(r => {
      const titleMatch = r.title?.toLowerCase().includes(query);
      const tagMatch = r.tags?.some(t => t.toLowerCase().includes(query));
      const fileMatch = r.fileName?.toLowerCase().includes(query);
      return titleMatch || tagMatch || fileMatch;
    });
  }

  // Category filter
  if (filters.category) {
    records = records.filter(r => r.category === filters.category);
  }

  // Site filter
  if (filters.site) {
    records = records.filter(r => r.site === filters.site);
  }

  // Date range filter
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    records = records.filter(r => new Date(r.downloadedAt) >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    records = records.filter(r => new Date(r.downloadedAt) <= end);
  }

  // Pagination
  if (filters.limit) {
    const offset = filters.offset || 0;
    records = records.slice(offset, offset + filters.limit);
  }

  return records;
}

/**
 * Get unique categories from records
 * @returns {Promise<Array<string>>} List of categories
 */
export async function getCategories() {
  const records = await getAllRecords();
  return [...new Set(records.map(r => r.category).filter(Boolean))];
}

/**
 * Get unique sites from records
 * @returns {Promise<Array<string>>} List of sites
 */
export async function getSites() {
  const records = await getAllRecords();
  return [...new Set(records.map(r => r.site).filter(Boolean))];
}

/**
 * Get record count
 * @returns {Promise<number>} Total record count
 */
export async function getRecordCount() {
  const records = await getAllRecords();
  return records.length;
}

/**
 * Export records as JSON
 * @returns {Promise<string>} JSON string
 */
export async function exportAsJson() {
  const records = await getAllRecords();
  return JSON.stringify(records, null, 2);
}

/**
 * Export records as CSV
 * @returns {Promise<string>} CSV string
 */
export async function exportAsCsv() {
  const records = await getAllRecords();

  if (records.length === 0) return '';

  const headers = ['id', 'title', 'fileName', 'filePath', 'category', 'site', 'sourceUrl', 'tags', 'duration', 'downloadedAt'];
  const rows = records.map(r => {
    return headers.map(h => {
      const value = r[h];
      if (Array.isArray(value)) {
        return `"${value.join(', ')}"`;
      }
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Import records from JSON
 * @param {string} jsonString - JSON data
 * @param {boolean} merge - Merge with existing records (default: true)
 * @returns {Promise<number>} Number of imported records
 */
export async function importFromJson(jsonString, merge = true) {
  const imported = JSON.parse(jsonString);

  if (!Array.isArray(imported)) {
    throw new Error('Invalid JSON format: expected array');
  }

  if (merge) {
    const existing = await getAllRecords();
    const existingIds = new Set(existing.map(r => r.id));
    const newRecords = imported.filter(r => !existingIds.has(r.id));
    const merged = [...newRecords, ...existing];
    await chrome.storage.local.set({ [DB_KEY]: merged });
    return newRecords.length;
  } else {
    await chrome.storage.local.set({ [DB_KEY]: imported });
    return imported.length;
  }
}
