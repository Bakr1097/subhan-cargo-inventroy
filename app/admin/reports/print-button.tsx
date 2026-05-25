'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-sm font-semibold text-white bg-purple-600 px-4 py-2 rounded-lg active:opacity-80"
    >
      Print
    </button>
  )
}
