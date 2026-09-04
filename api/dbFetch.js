import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.RAILWAY_DATABASE_URL || 'postgresql://postgres:zXuyDwmBoMwdHnUqoFMUIkkKILuEcaas@reseau.proxy.rlwy.net:12168/railway'
});

export async function dbFetch(url, options = {}) {
  try {
    const urlObj = new URL(url, 'http://dummy.internal');
    const pathParts = urlObj.pathname.split('/');
    const tableName = pathParts[pathParts.length - 1];
    const method = (options.method || 'GET').toUpperCase();
    
    let query = '';
    const values = [];
    let paramIndex = 1;

    let selectStr = '*';
    const selectParam = urlObj.searchParams.get('select');
    if (selectParam) {
      selectStr = selectParam.split(',').map(s => s.trim() === '*' ? '*' : `"${s.trim()}"`).join(', ');
    }

    const whereClauses = [];
    for (const [key, value] of urlObj.searchParams.entries()) {
      if (['select', 'order', 'limit'].includes(key)) continue;
      
      if (value.startsWith('eq.')) {
        whereClauses.push(`"${key}" = $${paramIndex++}`);
        values.push(value.replace('eq.', ''));
      } else if (value.startsWith('gte.')) {
        whereClauses.push(`"${key}" >= $${paramIndex++}`);
        values.push(value.replace('gte.', ''));
      } else if (value.startsWith('lte.')) {
        whereClauses.push(`"${key}" <= $${paramIndex++}`);
        values.push(value.replace('lte.', ''));
      } else if (key === 'or') {
        const inner = value.match(/\((.*?)\)/);
        if (inner && inner[1]) {
          const parts = inner[1].split(',');
          const orClauses = parts.map(p => {
            const [k, op, v] = p.split('.');
            if (op === 'eq') {
              values.push(v.replace(/"/g, ''));
              return `"${k}" = $${paramIndex++}`;
            }
            if (op === 'cs') {
              values.push(v);
              return `"${k}" @> $${paramIndex++}`;
            }
            return '';
          }).filter(Boolean);
          if (orClauses.length > 0) {
            whereClauses.push(`(${orClauses.join(' OR ')})`);
          }
        }
      } else if (value.includes('eq.')) {
          whereClauses.push(`"${key}" = $${paramIndex++}`);
          values.push(value.replace('eq.', ''));
      }
    }

    let whereStr = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    if (method === 'GET') {
      let orderStr = '';
      const orderParam = urlObj.searchParams.get('order');
      if (orderParam) {
        const [col, dir] = orderParam.split('.');
        orderStr = ` ORDER BY "${col}" ${dir === 'desc' ? 'DESC' : 'ASC'}`;
      }
      
      let limitStr = '';
      const limitParam = urlObj.searchParams.get('limit');
      if (limitParam) {
        limitStr = ` LIMIT ${parseInt(limitParam, 10)}`;
      }

      query = `SELECT ${selectStr} FROM "${tableName}"${whereStr}${orderStr}${limitStr}`;
      
    } else if (method === 'POST') {
      const body = typeof options.body === 'string' ? JSON.parse(options.body || '{}') : (options.body || {});
      const keys = Object.keys(body);
      const vals = Object.values(body);
      
      const colStr = keys.map(k => `"${k}"`).join(', ');
      const valStr = vals.map(() => `$${paramIndex++}`).join(', ');
      values.push(...vals);
      
      const prefer = options.headers?.['Prefer'] || options.headers?.['prefer'];
      let conflictStr = '';
      if (prefer === 'resolution=merge-duplicates') {
        const pk = keys.includes('id') ? 'id' : (keys.includes('phone') ? 'phone' : (keys.includes('device_id') ? 'device_id' : keys[0]));
        const updateSets = keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');
        conflictStr = ` ON CONFLICT ("${pk}") DO UPDATE SET ${updateSets}`;
      }
      
      query = `INSERT INTO "${tableName}" (${colStr}) VALUES (${valStr})${conflictStr} RETURNING *`;
      
    } else if (method === 'PATCH') {
      const body = typeof options.body === 'string' ? JSON.parse(options.body || '{}') : (options.body || {});
      const keys = Object.keys(body);
      const vals = Object.values(body);
      
      const setStr = keys.map(k => `"${k}" = $${paramIndex++}`).join(', ');
      values.push(...vals);
      
      query = `UPDATE "${tableName}" SET ${setStr}${whereStr} RETURNING *`;
      
    } else if (method === 'DELETE') {
      query = `DELETE FROM "${tableName}"${whereStr} RETURNING *`;
    }

    const res = await pool.query(query, values);

    return {
      ok: true,
      status: 200,
      json: async () => res.rows,
      text: async () => JSON.stringify(res.rows),
      data: res.rows
    };

  } catch (error) {
    console.error('dbFetch Error:', error);
    return {
      ok: false,
      status: 500,
      json: async () => ({ error: error, message: error.message }),
      text: async () => 'Internal Server Error',
      data: { error: error, message: error.message }
    };
  }
}
