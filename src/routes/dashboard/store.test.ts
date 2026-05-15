import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { clients, filters, searchQuery, filteredClients, clientsByStage } from './store.ts';
import type { Client } from './store.ts';

const mockClients: Client[] = [
  {
    id: '1',
    sessionId: 's1',
    displayName: 'John Doe',
    nameKnown: true,
    name: 'John',
    surname: 'Doe',
    email: 'john@example.com',
    phone: '1234567890',
    originCountry: 'USA',
    originCity: 'New York',
    destinationCountry: 'Spain',
    destinationCity: 'Madrid',
    budget: '10k-20k',
    size: '2 Bedroom',
    immigrationStatus: 'Citizen',
    propertyTypeFrom: 'house',
    propertyTypeTo: 'apartment',
    vehicles: [],
    scheduling: [],
    stage: 'sales_opt_in_email',
    callOutcome: null,
    transcript: '',
    agentNotes: [],
    chatbotNotes: [],
    chatHistory: [],
    customFields: {},
    activityLog: [],
    dripEnabled: true,
    consultationCount: 1,
    lastUpdated: '2023-01-01',
    createdAt: '2023-01-01'
  },
  {
    id: '2',
    sessionId: 's2',
    displayName: 'Jane Smith',
    nameKnown: true,
    name: 'Jane',
    surname: 'Smith',
    email: 'jane@example.com',
    phone: '0987654321',
    originCountry: 'Canada',
    originCity: 'Toronto',
    destinationCountry: 'Spain',
    destinationCity: 'Barcelona',
    budget: '20k+',
    size: '3 Bedroom',
    immigrationStatus: 'Visa',
    propertyTypeFrom: 'condo',
    propertyTypeTo: 'house',
    vehicles: [],
    scheduling: [],
    stage: 'sales_pricing_quote',
    callOutcome: 'qualified',
    transcript: '',
    agentNotes: [],
    chatbotNotes: [],
    chatHistory: [],
    customFields: {},
    activityLog: [],
    dripEnabled: false,
    consultationCount: 2,
    lastUpdated: '2023-01-02',
    createdAt: '2023-01-02'
  },
  {
    id: '3',
    sessionId: 's3',
    displayName: 'Bob Johnson',
    nameKnown: true,
    name: 'Bob',
    surname: 'Johnson',
    email: 'bob@test.com',
    phone: '5555555555',
    originCountry: 'USA',
    originCity: 'Miami',
    destinationCountry: 'Mexico',
    destinationCity: 'Mexico City',
    budget: 'Under 10k',
    size: 'Studio',
    immigrationStatus: 'Resident',
    propertyTypeFrom: 'apartment',
    propertyTypeTo: 'apartment',
    vehicles: [],
    scheduling: [],
    stage: 'ops_gathering',
    callOutcome: 'nurture',
    transcript: '',
    agentNotes: [],
    chatbotNotes: [],
    chatHistory: [],
    customFields: {},
    activityLog: [],
    dripEnabled: true,
    consultationCount: 1,
    lastUpdated: '2023-01-03',
    createdAt: '2023-01-03'
  }
];

describe('Dashboard Filtering & Searching', () => {
  beforeEach(() => {
    // Reset stores before each test
    clients.set([...mockClients]);
    searchQuery.set('');
    filters.set({
      stage: '',
      originCountry: '',
      destinationCountry: '',
      budget: '',
      size: '',
      callOutcome: ''
    });
  });

  describe('Search Functionality', () => {
    it('returns all clients when search is empty', () => {
      const result = get(filteredClients);
      expect(result.length).toBe(3);
    });

    it('filters by name', () => {
      searchQuery.set('john');
      const result = get(filteredClients);
      expect(result.length).toBe(2); // John Doe and Bob Johnson
      expect(result.map(c => c.id)).toContain('1');
      expect(result.map(c => c.id)).toContain('3');
    });

    it('filters by email', () => {
      searchQuery.set('jane@example.com');
      const result = get(filteredClients);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    it('filters by country/city', () => {
      searchQuery.set('spain');
      const result = get(filteredClients);
      expect(result.length).toBe(2);
      expect(result.map(c => c.id)).toContain('1');
      expect(result.map(c => c.id)).toContain('2');
    });

    it('is case insensitive', () => {
      searchQuery.set('SPAIN');
      const result = get(filteredClients);
      expect(result.length).toBe(2);
    });
  });

  describe('Field Filters', () => {
    it('filters by stage', () => {
      filters.update(f => ({ ...f, stage: 'sales_pricing_quote' }));
      const result = get(filteredClients);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    it('filters by originCountry', () => {
      filters.update(f => ({ ...f, originCountry: 'USA' }));
      const result = get(filteredClients);
      expect(result.length).toBe(2);
      expect(result.map(c => c.id)).toEqual(['1', '3']);
    });

    it('filters by destinationCountry', () => {
      filters.update(f => ({ ...f, destinationCountry: 'Mexico' }));
      const result = get(filteredClients);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('3');
    });

    it('filters by budget', () => {
      filters.update(f => ({ ...f, budget: '20k+' }));
      const result = get(filteredClients);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    it('filters by size', () => {
      filters.update(f => ({ ...f, size: 'Studio' }));
      const result = get(filteredClients);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('3');
    });

    it('filters by callOutcome = none (null)', () => {
      filters.update(f => ({ ...f, callOutcome: 'none' }));
      const result = get(filteredClients);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
      expect(result[0].callOutcome).toBeNull();
    });

    it('filters by specific callOutcome', () => {
      filters.update(f => ({ ...f, callOutcome: 'qualified' }));
      const result = get(filteredClients);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
      expect(result[0].callOutcome).toBe('qualified');
    });
  });

  describe('Combined Filters & Search', () => {
    it('applies multiple field filters together', () => {
      filters.update(f => ({ ...f, originCountry: 'USA', destinationCountry: 'Spain' }));
      const result = get(filteredClients);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });

    it('applies field filters and search query together', () => {
      filters.update(f => ({ ...f, originCountry: 'USA' }));
      searchQuery.set('Miami');
      const result = get(filteredClients);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('3');
    });

    it('returns empty when filters conflict', () => {
      filters.update(f => ({ ...f, originCountry: 'Canada', destinationCountry: 'Mexico' }));
      const result = get(filteredClients);
      expect(result.length).toBe(0);
    });
  });

  describe('clientsByStage derived store', () => {
    it('groups filtered clients into correct stage buckets', () => {
      filters.update(f => ({ ...f, originCountry: 'USA' }));
      const grouped = get(clientsByStage);
      
      // Should have 1 in opt_in and 1 in gathering, 0 in pricing_quote
      expect(grouped['sales_opt_in_email']?.length).toBe(1);
      expect(grouped['sales_opt_in_email'][0].id).toBe('1');
      
      expect(grouped['ops_gathering']?.length).toBe(1);
      expect(grouped['ops_gathering'][0].id).toBe('3');
      
      expect(grouped['sales_pricing_quote']?.length).toBe(0);
    });
  });
});
