/**
 * Generates a unique token for a form submission.
 * @returns {string} UUID v4 string
 */
function generateToken() {
  return Utilities.getUuid();
}
