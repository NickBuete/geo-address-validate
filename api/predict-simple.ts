export default async function handler(req, res) {
  try {
    const q = (req.query.q ?? '').toString().trim()
    if (!q) return res.status(400).json({ message: 'query parameter required' })

    // Simple test without providers
    res.json({
      ok: true,
      query: q,
      message: 'Predict endpoint reached! Provider imports need fixing.',
    })
  } catch (err) {
    console.error('api/predict-simple error:', err)
    res.status(500).json({ message: String(err) })
  }
}
