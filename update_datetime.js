import fs from 'fs';

let content = fs.readFileSync('src/components/AutomatedCampaignsDashboard.jsx', 'utf-8');

// Chunk 1: formatting for setStartsAt and setEndsAt
content = content.replace(
  `      setMinQuantity(data.minimumRequirement?.greaterThanOrEqualToQuantity || '');
      setStartsAt(data.startsAt ? data.startsAt.split('T')[0] : '');
      setEndsAt(data.endsAt ? data.endsAt.split('T')[0] : '');
      setSelectedProductIds(data.customerGets.items.products.edges.map(e => e.node.id.split('/').pop()));`,
  `      setMinQuantity(data.minimumRequirement?.greaterThanOrEqualToQuantity || '');
      const toLocalISO = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      };
      setStartsAt(toLocalISO(data.startsAt));
      setEndsAt(toLocalISO(data.endsAt));
      setSelectedProductIds(data.customerGets.items.products.edges.map(e => e.node.id.split('/').pop()));`
);

// Chunk 2: replace type="date" with type="datetime-local" for startsAt
content = content.replace(
  `                <label className="block text-xs font-semibold text-slate-300 mb-2 flex justify-between"><span>Start Date</span> <span className="text-slate-500 font-normal">Optional</span></label>
                <input
                  type="date"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}`,
  `                <label className="block text-xs font-semibold text-slate-300 mb-2 flex justify-between"><span>Start Time</span> <span className="text-slate-500 font-normal">Optional</span></label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}`
);

// Chunk 3: replace type="date" with type="datetime-local" for endsAt
content = content.replace(
  `                <label className="block text-xs font-semibold text-slate-300 mb-2 flex justify-between"><span>End Date</span> <span className="text-slate-500 font-normal">Optional</span></label>
                <input
                  type="date"
                  value={endsAt}
                  onChange={e => setEndsAt(e.target.value)}`,
  `                <label className="block text-xs font-semibold text-slate-300 mb-2 flex justify-between"><span>End Time</span> <span className="text-slate-500 font-normal">Optional</span></label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={e => setEndsAt(e.target.value)}`
);

// Chunk 4: replace Ends format in the list
content = content.replace(
  `                    {camp.discount?.endsAt && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold border border-amber-500/30 flex items-center gap-1"><Calendar className="w-3 h-3" /> Ends {camp.discount.endsAt.split('T')[0]}</span>}`,
  `                    {camp.discount?.endsAt && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold border border-amber-500/30 flex items-center gap-1"><Calendar className="w-3 h-3" /> Ends {new Date(camp.discount.endsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}`
);


fs.writeFileSync('src/components/AutomatedCampaignsDashboard.jsx', content);
console.log("Done updating Dashboard for datetime!");
