export function noImage(value: string, size?: string): string {
  if (size) {
    return `https://ui-avatars.com/api/?name=${value}&rounded=true&lenght=2&size=${size}`;
  } else {
    return `https://ui-avatars.com/api/?name=${value}&rounded=true&lenght=2`;
  }
}
