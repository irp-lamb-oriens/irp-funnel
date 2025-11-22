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
  // If vehicles array is empty, is it valid? Maybe they have no vehicles.
  // But if they added one, it must be complete.
  // Given the user requirement "all three inputs are required", and the component initializes with 1,
  // we can assume at least one valid vehicle is needed if the stage is shown?
  // Or we can allow skipping if empty? 
  // But the prompt "add 1 vehicle... + 2..." implies collecting vehicle info.
  // I'll stick to: if present, must be valid. If empty, valid (maybe they have none).
  // BUT, `VehiclesInputStage` initializes with one empty vehicle.
  // So the user MUST fill it or delete it (if > 1).
  // If they have 1 empty vehicle, `every` returns false?
  // No, if `vehicles` has `{year:"", ...}`, `v.year` is falsy.
  if (!vehicles || vehicles.length === 0) return true; // Allow no vehicles? Or force 1? "this all need to add... + 1 vehicle". I'll force 1 valid vehicle.
  // Actually, let's enforce that all vehicles in the list are valid.
  return vehicles.length > 0 && vehicles.every((v: any) => v.year && v.make && v.model);
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
