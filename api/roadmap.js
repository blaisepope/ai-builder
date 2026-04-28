const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const STATUS_TO_COL = {
  'Suggested':   'suggested',
  'To Build':    'to-build',
  'In Progress': 'in-progress',
  'Done':        'done',
};

const COL_TO_STATUS = {
  'suggested':   'Suggested',
  'to-build':    'To Build',
  'in-progress': 'In Progress',
  'done':        'Done',
};

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const response = await notion.databases.query({ database_id: DATABASE_ID });

      const cards = response.results
        .map(page => {
          const p = page.properties;
          const statusName = p.Status?.select?.name || 'To Build';
          const priorityName = p.Priority?.select?.name || 'Medium';
          return {
            id: page.id,
            name: p.Name?.title?.[0]?.plain_text || '(untitled)',
            status: statusName,
            column: STATUS_TO_COL[statusName] || 'to-build',
            priority: priorityName.toLowerCase(),
            description: p.Description?.rich_text?.map(t => t.plain_text).join('') || '',
            projectSpec: p['Project Spec']?.rich_text?.map(t => t.plain_text).join('') || '',
            notionUrl: page.url,
          };
        })
        .sort((a, b) => {
          const pa = PRIORITY_ORDER[a.priority.charAt(0).toUpperCase() + a.priority.slice(1)] ?? 1;
          const pb = PRIORITY_ORDER[b.priority.charAt(0).toUpperCase() + b.priority.slice(1)] ?? 1;
          return pa - pb;
        });

      return res.status(200).json({ cards });
    } catch (err) {
      console.error('GET /api/roadmap error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, column } = req.body;
      const status = COL_TO_STATUS[column];

      if (!id || !status) {
        return res.status(400).json({ error: 'Missing id or invalid column' });
      }

      await notion.pages.update({
        page_id: id,
        properties: {
          Status: { select: { name: status } },
        },
      });

      return res.status(200).json({ ok: true, id, status });
    } catch (err) {
      console.error('PATCH /api/roadmap error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
