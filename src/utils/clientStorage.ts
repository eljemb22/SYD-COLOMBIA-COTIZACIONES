import { doc, setDoc, deleteDoc, getDocs, collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SavedQuote, TenderClientProject, OCTrackingContract } from '../types';

export interface ClientRecord {
  id: string;
  name: string;
  nit?: string;
  city?: string;
  department?: string;
  sede?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
  source?: 'cotizacion' | 'licitacion' | 'oc' | 'manual' | 'quote' | 'tender';
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientPendingField {
  key: string;
  label: string;
  isMissing: boolean;
  value?: string;
}

export function getClientDataStatus(client: Partial<ClientRecord> | null | undefined) {
  if (!client) {
    return {
      fields: [],
      missingFields: [],
      isComplete: false,
      completedCount: 0,
      totalFields: 5,
      completionPercentage: 0,
    };
  }

  const isValueMissing = (val?: string) => {
    if (!val) return true;
    const trimmed = val.trim();
    return (
      !trimmed ||
      trimmed === '-' ||
      trimmed === 'N/A' ||
      trimmed.toLowerCase() === 'pendiente' ||
      trimmed.toLowerCase() === 'completar nit' ||
      trimmed.toLowerCase() === 'sin nit'
    );
  };

  const fields: ClientPendingField[] = [
    { key: 'nit', label: 'NIT / RUT', isMissing: isValueMissing(client.nit), value: client.nit },
    { key: 'city', label: 'Ciudad / Departamento', isMissing: isValueMissing(client.city), value: client.city },
    { key: 'contactPerson', label: 'Persona de Contacto', isMissing: isValueMissing(client.contactPerson), value: client.contactPerson },
    { key: 'contactPhone', label: 'Teléfono', isMissing: isValueMissing(client.contactPhone), value: client.contactPhone },
    { key: 'contactEmail', label: 'Correo Electrónico', isMissing: isValueMissing(client.contactEmail), value: client.contactEmail },
  ];

  const missingFields = fields.filter((f) => f.isMissing);
  const isComplete = missingFields.length === 0;
  const completedCount = fields.length - missingFields.length;
  const completionPercentage = Math.round((completedCount / fields.length) * 100);

  return {
    fields,
    missingFields,
    isComplete,
    completedCount,
    totalFields: fields.length,
    completionPercentage,
  };
}

const CLIENTS_STORAGE_KEY = 'syd_clients_directory_v1';

export const COLOMBIA_CITY_DEPARTMENTS: Record<string, string> = {
  // La Guajira
  'uribia': 'La Guajira',
  'riohacha': 'La Guajira',
  'maicao': 'La Guajira',
  'manaure': 'La Guajira',
  'albania': 'La Guajira',
  'fonseca': 'La Guajira',
  'san juan del cesar': 'La Guajira',
  'barrancas': 'La Guajira',
  'dibulla': 'La Guajira',
  'hatonuevo': 'La Guajira',
  'distraccion': 'La Guajira',
  'villanueva': 'La Guajira',
  'el molino': 'La Guajira',
  'urumita': 'La Guajira',
  'la jagua del pilar': 'La Guajira',
  // Atlántico
  'barranquilla': 'Atlántico',
  'soledad': 'Atlántico',
  'malambo': 'Atlántico',
  'sabanalarga': 'Atlántico',
  'puerto colombia': 'Atlántico',
  'galapa': 'Atlántico',
  'baranoa': 'Atlántico',
  'palmar de varela': 'Atlántico',
  'santo tomas': 'Atlántico',
  // Bolívar
  'cartagena': 'Bolívar',
  'cartagena de indias': 'Bolívar',
  'magangue': 'Bolívar',
  'turbaco': 'Bolívar',
  'arjona': 'Bolívar',
  'el carmen de bolivar': 'Bolívar',
  // Magdalena
  'santa marta': 'Magdalena',
  'cienaga': 'Magdalena',
  'fundacion': 'Magdalena',
  'el banco': 'Magdalena',
  'plato': 'Magdalena',
  // Cesar
  'valledupar': 'Cesar',
  'aguachica': 'Cesar',
  'agustin codazzi': 'Cesar',
  'bosconia': 'Cesar',
  'curumani': 'Cesar',
  // Córdoba
  'monteria': 'Córdoba',
  'cerete': 'Córdoba',
  'lorica': 'Córdoba',
  'sahagun': 'Córdoba',
  'montelibano': 'Córdoba',
  'tierralta': 'Córdoba',
  // Sucre
  'sincelejo': 'Sucre',
  'corozal': 'Sucre',
  'san marcos': 'Sucre',
  'tolu': 'Sucre',
  // Cundinamarca / Bogotá
  'bogota': 'Cundinamarca',
  'bogota d.c.': 'Cundinamarca',
  'soacha': 'Cundinamarca',
  'chia': 'Cundinamarca',
  'zipaquira': 'Cundinamarca',
  'facatativa': 'Cundinamarca',
  'fusagasuga': 'Cundinamarca',
  'girardot': 'Cundinamarca',
  'mosquera': 'Cundinamarca',
  'madrid': 'Cundinamarca',
  'funza': 'Cundinamarca',
  'cajica': 'Cundinamarca',
  // Antioquia
  'medellin': 'Antioquia',
  'bello': 'Antioquia',
  'itagui': 'Antioquia',
  'envigado': 'Antioquia',
  'apartado': 'Antioquia',
  'rionegro': 'Antioquia',
  'turbo': 'Antioquia',
  'caucasia': 'Antioquia',
  'sabaneta': 'Antioquia',
  // Valle del Cauca
  'cali': 'Valle del Cauca',
  'buenaventura': 'Valle del Cauca',
  'palmira': 'Valle del Cauca',
  'tulua': 'Valle del Cauca',
  'yumbo': 'Valle del Cauca',
  'cartago': 'Valle del Cauca',
  'jamundi': 'Valle del Cauca',
  'buga': 'Valle del Cauca',
  // Santander
  'bucaramanga': 'Santander',
  'floridablanca': 'Santander',
  'giron': 'Santander',
  'pie de cuesta': 'Santander',
  'piedecuesta': 'Santander',
  'barrancabermeja': 'Santander',
  'san gil': 'Santander',
  // Norte de Santander
  'cucuta': 'Norte de Santander',
  'ocana': 'Norte de Santander',
  'villa del rosario': 'Norte de Santander',
  'los patios': 'Norte de Santander',
  'pamplona': 'Norte de Santander',
  // Risaralda
  'pereira': 'Risaralda',
  'dosquebradas': 'Risaralda',
  'santa rosa de cabal': 'Risaralda',
  // Caldas
  'manizales': 'Caldas',
  'la dorada': 'Caldas',
  'villamaria': 'Caldas',
  'chinchina': 'Caldas',
  // Quindío
  'armenia': 'Quindío',
  'calarca': 'Quindío',
  'montenegro': 'Quindío',
  'quimbaya': 'Quindío',
  // Tolima
  'ibague': 'Tolima',
  'espinal': 'Tolima',
  'melgar': 'Tolima',
  'chaparral': 'Tolima',
  // Huila
  'neiva': 'Huila',
  'pitalito': 'Huila',
  'garzon': 'Huila',
  // Meta
  'villavicencio': 'Meta',
  'acacias': 'Meta',
  'granada': 'Meta',
  // Nariño
  'pasto': 'Nariño',
  'tumaco': 'Nariño',
  'ipiales': 'Nariño',
  // Cauca
  'popayan': 'Cauca',
  'santander de quilichao': 'Cauca',
  // Boyacá
  'tunja': 'Boyacá',
  'sogamoso': 'Boyacá',
  'duitama': 'Boyacá',
  // Caquetá
  'florencia': 'Caquetá',
  // Chocó
  'quibdo': 'Chocó',
  // Casanare
  'yopal': 'Casanare',
  // Putumayo
  'mocoa': 'Putumayo',
  // Arauca
  'arauca': 'Arauca',
  // San Andrés
  'san andres': 'San Andrés y Providencia',
  // Amazonas
  'leticia': 'Amazonas',
  // Guaviare
  'san jose del guaviare': 'Guaviare',
  // Guainía
  'inirida': 'Guainía',
  // Vaupés
  'mitu': 'Vaupés',
  // Vichada
  'puerto carreno': 'Vichada',
};

/**
 * Normalizes and formats location into "Ciudad, Departamento"
 */
export function formatLocationWithDepartment(city?: string, department?: string): string {
  const cleanCity = (city || '').trim();
  const cleanDept = (department || '').trim();

  if (!cleanCity && !cleanDept) return 'Colombia';
  if (cleanCity && cleanDept) {
    if (cleanCity.toLowerCase().includes(cleanDept.toLowerCase())) {
      return cleanCity;
    }
    return `${cleanCity}, ${cleanDept}`;
  }

  if (cleanCity) {
    // Check if city already contains a comma
    if (cleanCity.includes(',')) {
      return cleanCity;
    }
    const normCity = cleanCity
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const foundDept = COLOMBIA_CITY_DEPARTMENTS[normCity] || COLOMBIA_CITY_DEPARTMENTS[cleanCity.toLowerCase()];
    if (foundDept) {
      return `${cleanCity}, ${foundDept}`;
    }
    return cleanCity;
  }

  return cleanDept;
}

/**
 * Extracts department from city if possible
 */
export function resolveDepartmentFromCity(city?: string): string {
  if (!city) return '';
  if (city.includes(',')) {
    const parts = city.split(',');
    return parts[parts.length - 1].trim();
  }
  const normCity = city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return COLOMBIA_CITY_DEPARTMENTS[normCity] || COLOMBIA_CITY_DEPARTMENTS[city.toLowerCase().trim()] || '';
}

// Clean initial state: no mock clients stored by default
const DEFAULT_CLIENTS: ClientRecord[] = [];

const DELETED_CLIENT_IDS_KEY = 'syd_deleted_client_ids_v1';
const DELETED_CLIENT_NAMES_KEY = 'syd_deleted_client_names_v1';

/**
 * Checks if a client was permanently deleted by the user
 */
export function isClientPermanentlyDeleted(clientId?: string, clientName?: string): boolean {
  if (clientName) {
    const trimmed = clientName.trim().toUpperCase();
    if (trimmed === 'HOS' || trimmed.length < 4) return true;
    try {
      const rawNames = localStorage.getItem(DELETED_CLIENT_NAMES_KEY);
      if (rawNames) {
        const list: string[] = JSON.parse(rawNames);
        if (list.includes(normalizeClientName(clientName))) return true;
      }
    } catch {}
  }
  if (clientId) {
    try {
      const rawIds = localStorage.getItem(DELETED_CLIENT_IDS_KEY);
      if (rawIds) {
        const list: string[] = JSON.parse(rawIds);
        if (list.includes(clientId)) return true;
      }
    } catch {}
  }
  return false;
}

/**
 * Records a client as permanently deleted in local storage
 */
export function markClientAsPermanentlyDeleted(clientId: string, clientName?: string): void {
  try {
    if (clientId) {
      const rawIds = localStorage.getItem(DELETED_CLIENT_IDS_KEY);
      const set = new Set<string>(rawIds ? JSON.parse(rawIds) : []);
      set.add(clientId);
      localStorage.setItem(DELETED_CLIENT_IDS_KEY, JSON.stringify(Array.from(set)));
    }
    if (clientName) {
      const rawNames = localStorage.getItem(DELETED_CLIENT_NAMES_KEY);
      const set = new Set<string>(rawNames ? JSON.parse(rawNames) : []);
      set.add(normalizeClientName(clientName));
      localStorage.setItem(DELETED_CLIENT_NAMES_KEY, JSON.stringify(Array.from(set)));
    }
  } catch (e) {
    console.error('Error marking client as permanently deleted:', e);
  }
}

/**
 * Deletes client document from Firestore
 */
export async function deleteClientFromFirestore(clientId: string): Promise<void> {
  try {
    if (!db || !clientId) return;
    const docRef = doc(db, 'client_directory', clientId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('Could not delete client from firestore:', e);
  }
}

/**
 * Loads all saved clients from localStorage without mock data
 */
export function getStoredClients(): ClientRecord[] {
  try {
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Filter out any mock/dummy clients, deleted clients, and fragments like "HOS"
      const filtered = parsed.filter(
        (c: any) =>
          c &&
          c.name &&
          c.name.trim().length >= 4 &&
          c.name.trim().toUpperCase() !== 'HOS' &&
          !c.id?.startsWith('client-nazareth-') &&
          !c.id?.startsWith('client-merced-') &&
          !c.id?.startsWith('client-prado-') &&
          !c.id?.startsWith('client-suba-') &&
          c.name !== 'NOMBRE DEL CLIENTE O INSTITUCIÓN' &&
          c.name !== 'CLIENTE NO ESPECIFICADO' &&
          !isClientPermanentlyDeleted(c.id, c.name)
      );
      if (filtered.length !== parsed.length) {
        localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(filtered));
      }
      return filtered;
    }
    return [];
  } catch (e) {
    console.error('Error loading clients directory:', e);
    return [];
  }
}

/**
 * Persists clients to localStorage
 */
export function persistClients(clients: ClientRecord[]): void {
  try {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
  } catch (e) {
    console.error('Error persisting clients directory:', e);
  }
}

/**
 * Normalizes a client name for searching and deduplication
 */
export function normalizeClientName(name: string): string {
  return (name || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/**
 * Upserts a client into the database and syncs with Firestore
 */
export async function saveOrUpdateClientRecord(
  clientData: Partial<ClientRecord> & { name: string }
): Promise<ClientRecord> {
  const cleanName = normalizeClientName(clientData.name);
  if (!cleanName || cleanName === 'NOMBRE DEL CLIENTE O INSTITUCIÓN' || cleanName === 'CLIENTE NO ESPECIFICADO') {
    throw new Error('Invalid client name');
  }

  const existingClients = getStoredClients();
  const index = existingClients.findIndex(
    (c) => (clientData.id && c.id === clientData.id) || normalizeClientName(c.name) === cleanName
  );

  const now = new Date().toISOString().split('T')[0];
  let clientRecord: ClientRecord;

  const rawCity = clientData.city !== undefined ? clientData.city.trim() : (index >= 0 ? existingClients[index].city || '' : '');
  const resolvedDept = clientData.department !== undefined ? clientData.department.trim() : (resolveDepartmentFromCity(rawCity) || (index >= 0 ? existingClients[index].department || '' : ''));

  if (index >= 0) {
    const current = existingClients[index];
    clientRecord = {
      ...current,
      id: current.id,
      name: cleanName,
      nit: clientData.nit !== undefined ? clientData.nit.trim() : (current.nit || ''),
      city: rawCity,
      department: resolvedDept,
      sede: clientData.sede !== undefined ? clientData.sede.trim() : (current.sede || ''),
      contactPerson: clientData.contactPerson !== undefined ? clientData.contactPerson.trim() : (current.contactPerson || ''),
      contactEmail: clientData.contactEmail !== undefined ? clientData.contactEmail.trim() : (current.contactEmail || ''),
      contactPhone: clientData.contactPhone !== undefined ? clientData.contactPhone.trim() : (current.contactPhone || ''),
      address: clientData.address !== undefined ? clientData.address.trim() : (current.address || ''),
      notes: clientData.notes !== undefined ? clientData.notes.trim() : (current.notes || ''),
      source: clientData.source || current.source || 'cotizacion',
      updatedAt: now,
    };
    existingClients[index] = clientRecord;
  } else {
    // Brand new client - initialize strictly with its own data (empty strings for pending fields)
    clientRecord = {
      id: clientData.id || `client-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: cleanName,
      nit: clientData.nit ? clientData.nit.trim() : '',
      city: rawCity,
      department: resolvedDept,
      sede: clientData.sede ? clientData.sede.trim() : '',
      contactPerson: clientData.contactPerson ? clientData.contactPerson.trim() : '',
      contactEmail: clientData.contactEmail ? clientData.contactEmail.trim() : '',
      contactPhone: clientData.contactPhone ? clientData.contactPhone.trim() : '',
      address: clientData.address ? clientData.address.trim() : '',
      notes: clientData.notes ? clientData.notes.trim() : '',
      source: clientData.source || 'cotizacion',
      createdAt: now,
      updatedAt: now,
    };
    existingClients.unshift(clientRecord);
  }

  persistClients(existingClients);

  // Sync to Firestore
  try {
    if (db) {
      const clientRef = doc(db, 'client_directory', clientRecord.id);
      await setDoc(clientRef, clientRecord, { merge: true });
    }
  } catch (err) {
    // Silent catch
  }

  return clientRecord;
}

/**
 * Searches clients matching a query
 */
export function searchClientDirectory(query: string, allClients?: ClientRecord[]): ClientRecord[] {
  const list = allClients || getStoredClients();
  const q = (query || '').trim().toLowerCase();
  if (!q) return list.slice(0, 15);

  return list.filter((c) => {
    const nameMatch = (c.name || '').toLowerCase().includes(q);
    const nitMatch = (c.nit || '').toLowerCase().includes(q);
    const cityMatch = (c.city || '').toLowerCase().includes(q);
    const deptMatch = (c.department || '').toLowerCase().includes(q);
    const contactMatch = (c.contactPerson || '').toLowerCase().includes(q);
    return nameMatch || nitMatch || cityMatch || deptMatch || contactMatch;
  });
}

/**
 * Harvests and auto-registers clients from existing Tenders, Quotes, and OC Contracts
 */
export function harvestAllClientsFromSystem(
  savedQuotes: SavedQuote[],
  tenderClients: TenderClientProject[],
  ocContracts: OCTrackingContract[]
): ClientRecord[] {
  const directory = [...getStoredClients()];
  const registeredNames = new Set(directory.map((c) => normalizeClientName(c.name)));

  // From Tender Clients
  (tenderClients || []).forEach((t) => {
    const rawName = t.clientName || t.header?.clientName || t.header?.entityName || '';
    const norm = normalizeClientName(rawName);
    if (
      norm &&
      norm.length >= 4 &&
      norm.toUpperCase() !== 'HOS' &&
      norm !== 'CLIENTE NO ESPECIFICADO' &&
      !isClientPermanentlyDeleted(undefined, norm) &&
      !registeredNames.has(norm)
    ) {
      registeredNames.add(norm);
      const rawCity = t.header?.city || '';
      const dept = resolveDepartmentFromCity(rawCity);
      directory.push({
        id: `client-tender-${t.id}`,
        name: norm,
        nit: t.nit || t.header?.nit || '',
        city: rawCity,
        department: dept,
        contactPerson: t.header?.contactPerson || '',
        contactEmail: t.header?.contactEmail || '',
        contactPhone: t.header?.contactPhone || '',
        source: 'licitacion',
        createdAt: t.createdAt || '2026-08-20',
        updatedAt: t.updatedAt || '2026-08-24',
      });
    }
  });

  // From Saved Quotes
  (savedQuotes || []).forEach((q) => {
    const norm = normalizeClientName(q.clientName);
    if (
      norm &&
      norm.length >= 4 &&
      norm.toUpperCase() !== 'HOS' &&
      norm !== 'CLIENTE NO ESPECIFICADO' &&
      !isClientPermanentlyDeleted(undefined, norm) &&
      !registeredNames.has(norm)
    ) {
      registeredNames.add(norm);
      const rawCity = q.city || '';
      const dept = resolveDepartmentFromCity(rawCity);
      directory.push({
        id: `client-quote-${q.id}`,
        name: norm,
        nit: q.nit || '',
        city: rawCity,
        department: dept,
        contactPerson: q.contactPerson || '',
        contactEmail: q.contactEmail || '',
        contactPhone: q.contactPhone || '',
        source: 'cotizacion',
        createdAt: q.savedAt ? q.savedAt.split('T')[0] : '2026-08-20',
        updatedAt: q.updatedAt ? q.updatedAt.split('T')[0] : '2026-08-24',
      });
    }
  });

  // From OC Contracts
  (ocContracts || []).forEach((oc) => {
    const norm = normalizeClientName(oc.clientName);
    if (
      norm &&
      norm.length >= 4 &&
      norm.toUpperCase() !== 'HOS' &&
      norm !== 'CLIENTE NO ESPECIFICADO' &&
      !isClientPermanentlyDeleted(undefined, norm) &&
      !registeredNames.has(norm)
    ) {
      registeredNames.add(norm);
      const rawCity = oc.city || '';
      const dept = resolveDepartmentFromCity(rawCity);
      directory.push({
        id: `client-oc-${oc.id}`,
        name: norm,
        nit: oc.nit || '',
        city: rawCity,
        department: dept,
        contactPerson: oc.contactPerson || '',
        contactEmail: oc.contactEmail || '',
        contactPhone: oc.contactPhone || '',
        source: 'oc',
        createdAt: '2026-08-20',
        updatedAt: '2026-08-24',
      });
    }
  });

  persistClients(directory);
  return directory;
}

/**
 * Subscribes to Firestore client directory in real time
 */
export function subscribeToClientDirectory(
  onUpdate: (clients: ClientRecord[]) => void
): Unsubscribe | null {
  try {
    if (!db) return null;
    const colRef = collection(db, 'client_directory');
    return onSnapshot(
      colRef,
      (snap) => {
        const remoteClients: ClientRecord[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as ClientRecord;
          if (
            data &&
            data.name &&
            data.name.trim().length >= 4 &&
            data.name.trim().toUpperCase() !== 'HOS' &&
            !isClientPermanentlyDeleted(data.id, data.name)
          ) {
            remoteClients.push(data);
          }
        });

        const localClients = getStoredClients();
        let resolvedClients: ClientRecord[];

        if (remoteClients.length === 0) {
          resolvedClients = localClients.length > 0 ? localClients : [];
        } else {
          resolvedClients = [...remoteClients];
        }

        persistClients(resolvedClients);
        onUpdate(resolvedClients);
      },
      (_err) => {
        // Silent
      }
    );
  } catch (_e) {
    return null;
  }
}
