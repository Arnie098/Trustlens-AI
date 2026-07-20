package ai.trustlens.floatingassist

import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

/**
 * In-memory history of floating-assist checks (survives while the process lives).
 * Lets users re-open results that would otherwise vanish after a new analyze.
 */
data class AnalyzeHistoryEntry(
  val id: String,
  val atMs: Long,
  val result: QuickAnalyzeResult,
)

object AnalyzeHistoryStore {
  private const val MAX = 15
  private val entries = CopyOnWriteArrayList<AnalyzeHistoryEntry>()

  fun add(result: QuickAnalyzeResult): AnalyzeHistoryEntry {
    val entry =
      AnalyzeHistoryEntry(
        id = UUID.randomUUID().toString(),
        atMs = System.currentTimeMillis(),
        result = result,
      )
    entries.add(0, entry)
    while (entries.size > MAX) {
      entries.removeAt(entries.lastIndex)
    }
    return entry
  }

  fun all(): List<AnalyzeHistoryEntry> = entries.toList()

  fun get(id: String): AnalyzeHistoryEntry? = entries.firstOrNull { it.id == id }

  fun count(): Int = entries.size

  fun clear() {
    entries.clear()
  }
}
