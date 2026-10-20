export const CATEGORIES = ['Work', 'Home', 'Hospitality'];
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_BACKUP_BYTES = 80 * 1024 * 1024;
export const SAMPLE_IMAGES = ['assets/coffee.jpg', 'assets/workspace.jpg', 'assets/living.jpg'];
export function starterChecklist(category) {
  const labels = {
    Work:['Clear the work surface', 'Return tools and stationery', 'Check cables and equipment', 'Leave the space ready for next time'],
    Home:['Put loose items back', 'Clear and wipe surfaces', 'Arrange cushions and textiles', 'Check against your reference photo'],
    Hospitality:['Wipe down the counter', 'Return equipment to its place', 'Restock the essentials', 'Leave the space ready for the next guest']
  };
  return [...(labels[category] || labels.Work)];
}
export function sortSetups(setups, order) {
  return [...setups].sort(order === 'name' ? (a,b)=>a.name.localeCompare(b.name) :
    order === 'updated' ? (a,b)=>b.updatedAt-a.updatedAt : (a,b)=>b.createdAt-a.createdAt);
}

export function uid() { return globalThis.crypto.randomUUID(); }
export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
export function progress(items) {
  const done = items.filter(item => item.done).length;
  return {done, total:items.length, percent:items.length ? Math.round(done / items.length * 100) : 0};
}
export function filterSetups(setups, category, query) {
  const text = query.trim().toLocaleLowerCase();
  return setups.filter(s => (category === 'All' || s.category === category) &&
    `${s.name} ${s.location} ${s.description}`.toLocaleLowerCase().includes(text));
}
export function safeImage(value) {
  return typeof value === 'string' && value.length <= 8 * 1024 * 1024 &&
    (SAMPLE_IMAGES.includes(value) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value));
}
export function validateBackup(data) {
  if (!data || data.format !== 'snapback' || data.version !== 1 || !Array.isArray(data.setups) || data.setups.length > 250) {
    throw new Error('Choose a valid SnapBack backup (version 1, up to 250 setups).');
  }
  const seen = new Set();
  const bounded = (v, max) => typeof v === 'string' && v.length <= max;
  return data.setups.map(s => {
    if (!s || !bounded(s.id, 100) || !s.id || seen.has(s.id) || !bounded(s.name, 70) || !s.name.trim() ||
      !CATEGORIES.includes(s.category) || !bounded(s.location, 60) || !bounded(s.description, 300) ||
      !safeImage(s.reference) || (s.current !== null && !safeImage(s.current)) ||
      !Array.isArray(s.items) || s.items.length > 100 || !Number.isFinite(s.createdAt) || !Number.isFinite(s.updatedAt)) {
      throw new Error('This backup contains an invalid setup. Nothing was imported.');
    }
    seen.add(s.id);
    const itemIds = new Set();
    const items = s.items.map(item => {
      if (!item || !bounded(item.id, 100) || !item.id || itemIds.has(item.id) || !bounded(item.text, 180) ||
        !item.text.trim() || typeof item.done !== 'boolean') throw new Error('This backup contains an invalid checklist.');
      itemIds.add(item.id);
      return {id:item.id, text:item.text.trim(), done:item.done};
    });
    return {id:s.id, name:s.name.trim(), category:s.category, location:s.location, description:s.description,
      reference:s.reference, current:s.current, items, createdAt:s.createdAt, updatedAt:s.updatedAt, isDemo:s.isDemo === true};
  });
}
export function seedSetups(now = Date.now()) {
  const data = [
    ['sample-coffee', 'The coffee corner', 'Hospitality', 'Morning routine', 'Everything you need for a slow, good start.', SAMPLE_IMAGES[0], ['Wipe down the counter', 'Return cups to their place', 'Restock the coffee essentials', 'Leave everything ready for tomorrow']],
    ['sample-work', 'A little room to focus', 'Work', 'The studio', 'A clear desk, a clear head. Ready for the next good idea.', SAMPLE_IMAGES[1], ['Clear the work surface', 'Put stationery back', 'Check cables and chargers', 'Water the plants']],
    ['sample-home', 'The Sunday reset', 'Home', 'Living room', 'A calm space to come home to.', SAMPLE_IMAGES[2], ['Arrange the cushions', 'Clear the coffee table', 'Fold the throw', 'Put books back on the shelf']]
  ];
  return data.map(([id,name,category,location,description,reference,labels], index) => ({
    id,name,category,location,description,reference,current:null,isDemo:true,createdAt:now-index,updatedAt:now-index,
    items:labels.map((text,i)=>({id:`${id}-item-${i}`,text,done:false}))
  }));
}

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('snapback-local-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('setups', {keyPath:'id'});
      request.result.createObjectStore('meta');
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other SnapBack tabs, then reload.'));
  });
}
export function transaction(db, stores, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Local storage failed.'));
    tx.onabort = () => reject(tx.error || new Error('Local storage was interrupted.'));
    try { result = action(tx); } catch (error) { tx.abort(); reject(error); }
  });
}
export async function loadLibrary(db) {
  let initialized, records;
  await transaction(db, ['setups','meta'], 'readonly', tx => {
    const setupRequest = tx.objectStore('setups').getAll();
    setupRequest.onsuccess = () => { records = setupRequest.result; };
    const metaRequest = tx.objectStore('meta').get('initialized');
    metaRequest.onsuccess = () => { initialized = metaRequest.result; };
  });
  if (initialized) return records;
  records = seedSetups();
  await transaction(db, ['setups','meta'], 'readwrite', tx => {
    records.forEach(s => tx.objectStore('setups').put(s));
    tx.objectStore('meta').put(true, 'initialized');
  });
  return records;
}
export async function imageFromFile(file) {
  if (!file || !file.size) throw new Error('Choose a photo first.');
  if (file.size > MAX_FILE_BYTES) throw new Error('That photo is too large. Please choose one under 20 MB.');
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw new Error('Please choose a JPG, PNG or WebP photo.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try { await img.decode(); } catch { throw new Error('This browser cannot read that photo. Try exporting it as JPG or PNG.'); }
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 100_000_000) {
      throw new Error('Photo dimensions are too large. Please resize it first.');
    }
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable in this browser.');
    context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg', .86);
  } finally { URL.revokeObjectURL(url); }
}
