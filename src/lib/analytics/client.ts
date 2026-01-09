import { env } from "@/env/server"
import { SqlString } from "./sql-string"
import { loadSql } from "./sql/registry"

/**
 * Analytics API endpoint configuration
 */
type CatalogConfig = {
  catalog: string
  database: string
  baseUrl?: string
}

const DEFAULT_BASE_URL = "https://analyticsdb.mev-commit.xyz/api/v1/catalogs"

/**
 * Catalog configurations for different query types
 */
const CATALOG_CONFIGS: Record<string, CatalogConfig> = {
  default: {
    catalog: "default_catalog",
    database: "mev_commit_8855",
  },
  fastrpc: {
    catalog: "pg_mev_commit_fastrpc",
    database: "public",
  },
}

/**
 * Analytics query execution error
 */
export class AnalyticsClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly queryKey?: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = "AnalyticsClientError"
  }
}

/**
 * Query execution options
 */
export type QueryOptions = {
  catalog?: keyof typeof CATALOG_CONFIGS
  database?: string
  timeout?: number
}

/**
 * Parsed NDJSON row from analytics API
 */
type NDJSONRow = {
  data: unknown[]
}

/**
 * Analytics Client - Unified interface for executing analytics queries
 */
export class AnalyticsClient {
  private authToken: string

  constructor() {
    this.authToken = env.ANALYTICS_DB_AUTH_TOKEN || ""
    if (!this.authToken) {
      console.warn("ANALYTICS_DB_AUTH_TOKEN not configured. Analytics queries will fail.")
    }
  }

  /**
   * Builds the API URL for a given catalog and database
   */
  private buildApiUrl(config: CatalogConfig): string {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL
    return `${baseUrl}/${config.catalog}/databases/${config.database}/sql`
  }

  /**
   * Parses NDJSON response from analytics API
   */
  private parseNDJSONResponse(responseText: string): unknown[][] {
    const lines = responseText.trim().split("\n")
    const dataRows: unknown[][] = []

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const parsed = JSON.parse(line) as NDJSONRow
        if (parsed.data && Array.isArray(parsed.data)) {
          dataRows.push(parsed.data)
        }
      } catch (lineError) {
        // Skip invalid JSON lines (shouldn't happen, but be safe)
        console.warn("Failed to parse NDJSON line:", lineError)
        continue
      }
    }

    return dataRows
  }

  /**
   * Executes a SQL query via the analytics API
   * @param queryKey Key identifying the SQL query (e.g., "transactions/get-swap-count")
   * @param params Parameters for named placeholder substitution
   * @param options Query execution options
   * @returns Array of data rows (each row is an array of values)
   */
  async execute(
    queryKey: string,
    params?: Record<string, unknown>,
    options: QueryOptions = {}
  ): Promise<unknown[][]> {
    const startTime = Date.now()

    try {
      // Load and format SQL
      const sqlTemplate = loadSql(queryKey)
      const sql = params ? SqlString.format(sqlTemplate, params) : sqlTemplate

      // Get catalog configuration
      const catalogKey = options.catalog || "default"
      const config = CATALOG_CONFIGS[catalogKey]
      if (!config) {
        throw new AnalyticsClientError(
          `Unknown catalog: ${catalogKey}. Available catalogs: ${Object.keys(CATALOG_CONFIGS).join(", ")}`
        )
      }

      // Override database if specified
      const finalConfig: CatalogConfig = {
        ...config,
        database: options.database || config.database,
      }

      const apiUrl = this.buildApiUrl(finalConfig)

      // Execute query
      const controller = new AbortController()
      const timeout = options.timeout || 30000 // 30 second default

      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${this.authToken}`,
          },
          body: JSON.stringify({ query: sql }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Analytics API error (${response.status}):`, errorText)
          console.error("Failed SQL query:", sql)

          throw new AnalyticsClientError(
            `Analytics API returned status ${response.status}: ${errorText}`,
            response.status,
            queryKey
          )
        }

        // Parse NDJSON response
        const responseText = await response.text()
        const dataRows = this.parseNDJSONResponse(responseText)

        // Telemetry/logging
        const duration = Date.now() - startTime
        console.log(
          `[AnalyticsClient] Query "${queryKey}" executed in ${duration}ms, returned ${dataRows.length} rows`
        )

        return dataRows
      } catch (fetchError) {
        clearTimeout(timeoutId)

        if (fetchError instanceof AnalyticsClientError) {
          throw fetchError
        }

        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          throw new AnalyticsClientError(
            `Query timeout after ${timeout}ms: ${queryKey}`,
            undefined,
            queryKey,
            fetchError
          )
        }

        throw new AnalyticsClientError(
          `Failed to execute analytics query: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          undefined,
          queryKey,
          fetchError
        )
      }
    } catch (error) {
      const duration = Date.now() - startTime

      if (error instanceof AnalyticsClientError) {
        console.error(
          `[AnalyticsClient] Query "${queryKey}" failed after ${duration}ms:`,
          error.message
        )
        throw error
      }

      console.error(
        `[AnalyticsClient] Unexpected error executing query "${queryKey}" after ${duration}ms:`,
        error
      )

      throw new AnalyticsClientError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        queryKey,
        error
      )
    }
  }

  /**
   * Executes a query and returns the first row, or null if no rows
   */
  async executeOne(
    queryKey: string,
    params?: Record<string, unknown>,
    options?: QueryOptions
  ): Promise<unknown[] | null> {
    const rows = await this.execute(queryKey, params, options)
    return rows.length > 0 ? rows[0] : null
  }
}

// Singleton instance
let clientInstance: AnalyticsClient | null = null

/**
 * Get the singleton AnalyticsClient instance
 */
export function getAnalyticsClient(): AnalyticsClient {
  if (!clientInstance) {
    clientInstance = new AnalyticsClient()
  }
  return clientInstance
}
