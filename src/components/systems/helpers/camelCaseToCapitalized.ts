export default function camelCaseToCapitalized(text: string): string {
  // Insert a space before each uppercase letter that follows a lowercase letter.
  const spaced = text.replace(/([a-z])([A-Z])/g, "$1 $2");

  // Split the text by spaces, then capitalize the first letter of each word.
  const words = spaced.split(" ");
  const capitalizedWords = words.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );

  // Join the capitalized words back into a single string.
  return capitalizedWords.join(" ");
}
