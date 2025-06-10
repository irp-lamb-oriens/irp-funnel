import { get } from 'svelte/store';
import store from '../../store.ts'; // Adjusted path

// Validate birthday: must be a string in YYYY-MM-DD, not in the future, not before 1920-01-01, and age > 0
export const isBirthdayValid = (): boolean => {
  const age = get(store).age;
  return !!age && age > 0;
};

export const isBudgetValid = (): boolean => {
  const budget = get(store).budget;
  return typeof budget === 'number';
};

export const isSquareFeetValid = (): boolean => {
  const squareFeet = get(store).squareFeet;
  return typeof squareFeet === 'number'; // Includes -1 for "don't know"
};

export const isPropertyTypeFromValid = (): boolean => {
  const propertyTypeFrom = get(store).propertyTypeFrom;
  return !!propertyTypeFrom;
};

export const isPropertyTypeToValid = (): boolean => {
  const propertyTypeTo = get(store).propertyTypeTo;
  return !!propertyTypeTo;
};

export const isReasonsValid = (): boolean => {
  const reasonsForMoving = get(store).reasonsForMoving;
  return Array.isArray(reasonsForMoving) && 
         reasonsForMoving.length > 0 && 
         reasonsForMoving.some((r: string) => typeof r === 'string' && r.trim() !== '');
};

// Add any other general input validation functions here if needed in stages
export const isNotEmptyString = (value: string | undefined | null): boolean => {
    return typeof value === 'string' && value.trim() !== '';
};

export const isSelected = (value: any): boolean => {
    return value !== undefined && value !== null && value !== '';
};
