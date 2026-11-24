export async function loadArklineReQcLoanSources(supabase) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.rpc('list_arkline_reqc_loan_sources').range(from, from + 999)
    if (error) return { data: [], error }
    rows.push(...(data || []))
    if (!data || data.length < 1000) return { data: rows, error: null }
  }
}
