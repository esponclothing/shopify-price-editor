import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/whatsapp_executions?select=*&order=created_at.desc&limit=150`;
    const response = await axios.get(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const executions = response.data || [];

    // Calculate simple stats
    const total_count = executions.length;
    const success_count = executions.filter(e => e.status === 'SUCCESS').length;
    const error_count = executions.filter(e => e.status === 'ERROR').length;
    const ignored_count = executions.filter(e => e.status === 'IGNORED').length;
    const validDurations = executions.filter(e => e.duration_ms > 0).map(e => e.duration_ms);
    const avg_duration = validDurations.length ? Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length) : 0;

    return res.status(200).json({
      executions,
      stats: {
        total_count,
        success_count,
        error_count,
        ignored_count,
        avg_duration
      }
    });
  } catch (err) {
    console.error('Failed to fetch whatsapp executions:', err.response?.data || err.message);
    return res.status(500).json({ error: err.response?.data || err.message });
  }
}
