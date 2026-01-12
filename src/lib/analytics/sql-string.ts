/**
 * Safe SQL parameter substitution utility with named placeholders
 * Handles type-safe parameter formatting to prevent SQL injection
 */

export class SqlString {
  /**
   * Escapes and quotes a string value for safe SQL usage
   */
  static escapeString(value: string): string {
    // Escape single quotes by doubling them (SQL standard)
    const escaped = value.replace(/'/g, "''")
    return `'${escaped}'`
  }

  /**
   * Validates and formats a number for SQL usage
   */
  static escapeNumber(value: number): string {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid number value: ${value}`)
    }
    return String(value)
  }

  /**
   * Formats an array as a SQL list: (item1, item2, item3)
   */
  static escapeArray(values: unknown[]): string {
    const formatted = values.map((val) => {
      if (typeof val === "string") {
        return this.escapeString(val)
      }
      if (typeof val === "number") {
        return this.escapeNumber(val)
      }
      if (val === null || val === undefined) {
        return "NULL"
      }
      throw new Error(`Unsupported array element type: ${typeof val}`)
    })
    return `(${formatted.join(", ")})`
  }

  /**
   * Formats a value based on its type for safe SQL usage
   */
  static formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "NULL"
    }

    if (typeof value === "string") {
      return this.escapeString(value)
    }

    if (typeof value === "number") {
      return this.escapeNumber(value)
    }

    if (typeof value === "boolean") {
      return value ? "TRUE" : "FALSE"
    }

    if (Array.isArray(value)) {
      return this.escapeArray(value)
    }

    throw new Error(
      `Unsupported parameter type: ${typeof value}. Supported types: string, number, boolean, array, null, undefined`
    )
  }

  /**
   * Replaces named placeholders (:param) in SQL with safely formatted values
   * @param sql SQL query with named placeholders (e.g., ":addr", ":limit")
   * @param params Object mapping parameter names to values
   * @returns Formatted SQL string with parameters safely substituted
   */
  static format(sql: string, params?: Record<string, unknown>): string {
    if (!params || Object.keys(params).length === 0) {
      return sql.trim()
    }

    let formatted = sql

    // Replace named placeholders (:param) with formatted values
    for (const [key, value] of Object.entries(params)) {
      // Match :param but not ::param (PostgreSQL cast operator)
      const regex = new RegExp(`:${key}(?![a-zA-Z0-9_])`, "g")
      const formattedValue = this.formatValue(value)

      // Check if placeholder exists in SQL (create new regex instance for test)
      const testRegex = new RegExp(`:${key}(?![a-zA-Z0-9_])`, "g")
      if (!testRegex.test(sql)) {
        console.warn(
          `SQL parameter :${key} not found in query. Available parameters: ${Object.keys(params).join(", ")}`
        )
      }

      formatted = formatted.replace(regex, formattedValue)
    }

    // Check for unsubstituted placeholders (helpful for debugging)
    const remainingPlaceholders = formatted.match(/:[a-zA-Z0-9_]+/g)
    if (remainingPlaceholders) {
      const unique = [...new Set(remainingPlaceholders)]
      console.warn(`Unsubstituted SQL placeholders found: ${unique.join(", ")}`)
    }

    return formatted.trim()
  }
}
