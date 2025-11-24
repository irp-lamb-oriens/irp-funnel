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

export const isVehiclesValid = (): boolean => {
  const vehicles = get(store).vehicles;
  // Allow empty vehicles array (user skipped or has no vehicles)
  if (!vehicles || vehicles.length === 0) return true;
  // If vehicles are present, all must be complete
  return vehicles.every((v: any) => v.year && v.make && v.model);
};

export const isCountryFromValid = (): boolean => {
    const countryFrom = get(store).countryFrom;
    const originZip = get(store).originZip;
    return !!countryFrom && countryFrom.length === 2 && !!originZip && originZip.trim().length > 0;
};

export const isCountryToValid = (): boolean => {
    const countryTo = get(store).countryTo;
    const destinationZip = get(store).destinationZip;
    return !!countryTo && countryTo.length === 2 && !!destinationZip && destinationZip.trim().length > 0;
};

// Add any other general input validation functions here if needed in stages
export const isNotEmptyString = (value: string | undefined | null): boolean => {
    return typeof value === 'string' && value.trim() !== '';
};

export const isSelected = (value: any): boolean => {
    return value !== undefined && value !== null && value !== '';
};
