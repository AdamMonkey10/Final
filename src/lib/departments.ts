export const DEPARTMENTS = [
  { id: 'Milling', name: 'Milling' },
  { id: 'Grinding', name: 'Grinding' },
  { id: 'Maintenance', name: 'Maintenance' },
  { id: 'Bandknife', name: 'Bandknife' },
  { id: 'Welding', name: 'Welding' }
] as const;

export type Department = typeof DEPARTMENTS[number];

export function getDepartments() {
  return DEPARTMENTS;
}