import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ReactFlow, ReactFlowProvider, addEdge, useNodesState, useEdgesState,
  Controls, Background, MiniMap, Handle, Position, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import {
  MessageSquare, Image as ImageIcon, MousePointerClick, AlignLeft,
  Download, Save, Play, Search, Video, File, Phone,
  Link, ListOrdered, FileText, Clock, GitBranch, XCircle, Zap, Tag, Plus,
  ArrowLeft, Edit3, Trash2, ToggleLeft, ToggleRight, BarChart2,
  Users, TrendingUp, CheckCircle, AlertCircle, Eye, PlusCircle,
  Activity, ChevronRight, Calendar, Bot, ShoppingBag, Package,
  ExternalLink, Network,
} from 'lucide-react';

/* ── SHARED BASE NODE ─────────────────────────────── */
const BaseNode = ({ data, icon: Icon, color, title, children, hasTarget = true, noDefaultSource = false }) => (
  <div className={`bg-white rounded-xl shadow-md border-2 w-[300px] overflow-visible ${color}`} style={{ colorScheme: 'light' }}>
    {hasTarget && <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-white !bg-slate-400 !-left-1.5" />}
    <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-100 bg-white rounded-t-xl">
      {Icon && <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-slate-100"><Icon className="w-3.5 h-3.5 text-slate-600" /></div>}
      <span className="text-xs font-bold text-slate-700 flex-1">{title}</span>
    </div>
    <div className="p-3 space-y-2 bg-white rounded-b-xl">{children}</div>
    {!noDefaultSource && <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-white !bg-emerald-500 !-right-1.5" />}
  </div>
);

const inputCls = "w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 !bg-white !text-slate-800 placeholder:!text-slate-400";
const textareaCls = "w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 !bg-white !text-slate-800 placeholder:!text-slate-400 resize-none";
const selectCls = "w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 !bg-white !text-slate-700 focus:outline-none";

const InputField = ({ value, onChange, placeholder, type = 'text', maxLength }) => (
  <input type={type} defaultValue={value || ''} placeholder={placeholder} maxLength={maxLength}
    onChange={e => onChange && onChange(e.target.value)}
    className={inputCls} />
);
const TextareaField = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea defaultValue={value || ''} placeholder={placeholder} rows={rows}
    onChange={e => onChange && onChange(e.target.value)}
    className={textareaCls} />
);
const Label = ({ children }) => <div className="text-[10px] font-semibold !text-slate-500 uppercase tracking-wider">{children}</div>;

/* ── NODE TYPES ───────────────────────────────────── */
const TriggerNode = ({ id, data }) => (
  <BaseNode icon={Play} color="border-emerald-400" title="Flow Trigger" hasTarget={false}>
    <Label>Trigger Keyword(s)</Label>
    <InputField value={data.keyword} placeholder="e.g. hi, hello, start" onChange={v => data.onChange(id, 'keyword', v)} />
    <Label>Match Type</Label>
    <select defaultValue={data.matchType || 'contains'} onChange={e => data.onChange(id, 'matchType', e.target.value)}
    className={selectCls}>
      <option value="exact">Exact match</option>
      <option value="contains">Contains keyword</option>
      <option value="starts_with">Starts with</option>
      <option value="regex">Regex pattern</option>
    </select>
  </BaseNode>
);

const TextMessageNode = ({ id, data }) => (
  <BaseNode icon={MessageSquare} color="border-blue-400" title="Text Message">
    <TextareaField value={data.text} placeholder={"Type your message...\nUse {{name}}, {{phone}} for variables."} onChange={v => data.onChange(id, 'text', v)} />
    <div className="text-[10px] text-slate-400">Supports: *bold*, _italic_, ~strikethrough~</div>
  </BaseNode>
);

const ImageMessageNode = ({ id, data }) => (
  <BaseNode icon={ImageIcon} color="border-purple-400" title="Image Message">
    <Label>Image URL</Label>
    <InputField value={data.url} placeholder="https://example.com/image.jpg" onChange={v => data.onChange(id, 'url', v)} />
    <Label>Caption (optional)</Label>
    <TextareaField value={data.caption} placeholder="Caption text..." rows={2} onChange={v => data.onChange(id, 'caption', v)} />
  </BaseNode>
);

const VideoMessageNode = ({ id, data }) => (
  <BaseNode icon={Video} color="border-pink-400" title="Video Message">
    <Label>Video URL (MP4)</Label>
    <InputField value={data.url} placeholder="https://example.com/video.mp4" onChange={v => data.onChange(id, 'url', v)} />
    <Label>Caption (optional)</Label>
    <TextareaField value={data.caption} placeholder="Caption text..." rows={2} onChange={v => data.onChange(id, 'caption', v)} />
  </BaseNode>
);

const DocumentNode = ({ id, data }) => (
  <BaseNode icon={File} color="border-amber-400" title="Document / File">
    <Label>File URL (PDF, DOCX, XLSX...)</Label>
    <InputField value={data.url} placeholder="https://example.com/file.pdf" onChange={v => data.onChange(id, 'url', v)} />
    <Label>Filename (shown to user)</Label>
    <InputField value={data.filename} placeholder="invoice.pdf" onChange={v => data.onChange(id, 'filename', v)} />
  </BaseNode>
);

const QuickReplyNode = ({ id, data }) => {
  const buttons = data.buttons || ['', '', ''];
  return (
    <BaseNode icon={MousePointerClick} color="border-orange-400" title="Quick Reply Buttons" noDefaultSource>
      <Label>Message Body</Label>
      <TextareaField value={data.text} placeholder="Main message text..." rows={2} onChange={v => data.onChange(id, 'text', v)} />
      <Label>Buttons (max 3 · 20 chars each)</Label>
      {buttons.map((btn, i) => (
        <div key={i} className="relative">
          <input type="text" defaultValue={btn} maxLength={20} placeholder={`Button ${i + 1}`}
            onChange={e => { const b = [...buttons]; b[i] = e.target.value; data.onChange(id, 'buttons', b); }}
            className="w-full text-xs border border-orange-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-orange-50/40" />
          {btn && <Handle type="source" position={Position.Right} id={`btn-${i}`}
            style={{ top: '50%', right: -10 }} className="!w-3 !h-3 !border-2 !border-white !bg-orange-400" />}
        </div>
      ))}
    </BaseNode>
  );
};

const UrlButtonNode = ({ id, data }) => (
  <BaseNode icon={Link} color="border-sky-400" title="CTA URL Button">
    <Label>Message Body</Label>
    <TextareaField value={data.text} placeholder="Message text..." rows={2} onChange={v => data.onChange(id, 'text', v)} />
    <Label>Button Label (25 chars max)</Label>
    <InputField value={data.btnLabel} placeholder="Visit our website" maxLength={25} onChange={v => data.onChange(id, 'btnLabel', v)} />
    <Label>Destination URL</Label>
    <InputField value={data.url} placeholder="https://11fit.in" onChange={v => data.onChange(id, 'url', v)} />
  </BaseNode>
);

const CallButtonNode = ({ id, data }) => (
  <BaseNode icon={Phone} color="border-green-500" title="CTA Call Button">
    <Label>Message Body</Label>
    <TextareaField value={data.text} placeholder="Message text..." rows={2} onChange={v => data.onChange(id, 'text', v)} />
    <Label>Button Label (25 chars max)</Label>
    <InputField value={data.btnLabel} placeholder="Call Us Now" maxLength={25} onChange={v => data.onChange(id, 'btnLabel', v)} />
    <Label>Phone Number (with country code)</Label>
    <InputField value={data.phone} placeholder="+91 99999 99999" onChange={v => data.onChange(id, 'phone', v)} />
  </BaseNode>
);

const ListMessageNode = ({ id, data }) => {
  const rows = data.rows || [''];
  return (
    <BaseNode icon={ListOrdered} color="border-indigo-400" title="List Message" noDefaultSource>
      <Label>Header (optional, max 60 chars)</Label>
      <InputField value={data.header} placeholder="Choose an option" maxLength={60} onChange={v => data.onChange(id, 'header', v)} />
      <Label>Body Text</Label>
      <TextareaField value={data.text} placeholder="Please select one of the following options:" rows={2} onChange={v => data.onChange(id, 'text', v)} />
      <Label>Button Label (opens list, max 20 chars)</Label>
      <InputField value={data.btnLabel} placeholder="See Options" maxLength={20} onChange={v => data.onChange(id, 'btnLabel', v)} />
      <Label>List Items (max 10)</Label>
      {rows.map((row, i) => (
        <div key={i} className="relative">
          <input type="text" defaultValue={row} maxLength={24} placeholder={`Option ${i + 1}`}
            onChange={e => { const r = [...rows]; r[i] = e.target.value; data.onChange(id, 'rows', r); }}
            className="w-full text-xs border border-indigo-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-indigo-50/40" />
          {row && <Handle type="source" position={Position.Right} id={`row-${i}`}
            style={{ right: -10 }} className="!w-3 !h-3 !border-2 !border-white !bg-indigo-400" />}
        </div>
      ))}
      {rows.length < 10 && (
        <button onClick={() => data.onChange(id, 'rows', [...rows, ''])}
          className="w-full text-xs text-indigo-500 border border-dashed border-indigo-300 rounded-lg py-1 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" /> Add Option
        </button>
      )}
    </BaseNode>
  );
};

const InputCaptureNode = ({ id, data }) => (
  <BaseNode icon={AlignLeft} color="border-teal-400" title="Wait for User Input">
    <Label>Question / Prompt</Label>
    <TextareaField value={data.question} placeholder="e.g. What is your name?" rows={2} onChange={v => data.onChange(id, 'question', v)} />
    <Label>Input Type</Label>
    <select defaultValue={data.inputType || 'text'} onChange={e => data.onChange(id, 'inputType', e.target.value)}
    className={selectCls}>
      <option value="text">Any Text</option>
      <option value="number">Number</option>
      <option value="phone">Phone Number</option>
      <option value="email">Email Address</option>
      <option value="pincode">Pincode</option>
    </select>
    <Label>Save Response to Variable</Label>
    <InputField value={data.variable} placeholder="e.g. user_name" onChange={v => data.onChange(id, 'variable', v)} />
  </BaseNode>
);

const ConditionNode = ({ id, data }) => (
  <BaseNode icon={GitBranch} color="border-fuchsia-400" title="Condition / Branch" noDefaultSource>
    <Label>Variable to Check</Label>
    <InputField value={data.variable} placeholder="e.g. user_name" onChange={v => data.onChange(id, 'variable', v)} />
    <Label>Condition</Label>
    <select defaultValue={data.operator || 'equals'} onChange={e => data.onChange(id, 'operator', e.target.value)}
    className={selectCls}>
      <option value="equals">Equals</option>
      <option value="not_equals">Does not equal</option>
      <option value="contains">Contains</option>
      <option value="greater_than">Greater than</option>
      <option value="less_than">Less than</option>
      <option value="is_set">Is set (not empty)</option>
    </select>
    <Label>Value</Label>
    <InputField value={data.value} placeholder="Comparison value" onChange={v => data.onChange(id, 'value', v)} />
    <div className="flex gap-2 mt-1">
      <div className="flex-1 relative">
        <div className="text-[10px] text-emerald-600 font-bold text-center bg-emerald-50 border border-emerald-200 rounded-lg py-1">✓ TRUE</div>
        <Handle type="source" position={Position.Right} id="true" style={{ right: -10 }} className="!w-3 !h-3 !border-2 !border-white !bg-emerald-500" />
      </div>
      <div className="flex-1 relative">
        <div className="text-[10px] text-rose-600 font-bold text-center bg-rose-50 border border-rose-200 rounded-lg py-1">✗ FALSE</div>
        <Handle type="source" position={Position.Bottom} id="false" style={{ bottom: -10, left: '50%' }} className="!w-3 !h-3 !border-2 !border-white !bg-rose-400" />
      </div>
    </div>
  </BaseNode>
);

const DelayNode = ({ id, data }) => (
  <BaseNode icon={Clock} color="border-slate-400" title="Delay / Wait">
    <Label>Wait Duration</Label>
    <div className="flex gap-2">
      <input type="number" defaultValue={data.amount || 1} min={1}
        onChange={e => data.onChange(id, 'amount', e.target.value)}
        className="w-20 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-slate-50" />
      <select defaultValue={data.unit || 'minutes'} onChange={e => data.onChange(id, 'unit', e.target.value)}
        className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none">
        <option value="seconds">Seconds</option>
        <option value="minutes">Minutes</option>
        <option value="hours">Hours</option>
        <option value="days">Days</option>
      </select>
    </div>
    <div className="text-[10px] text-slate-400">AI will pause and resume after this delay.</div>
  </BaseNode>
);

const TemplateNode = ({ id, data }) => (
  <BaseNode icon={FileText} color="border-violet-400" title="Template Message">
    <div className="bg-violet-50 border border-violet-200 rounded-lg p-2 text-[10px] text-violet-600 mb-1">
      Requires a Meta-approved template. Use for re-engaging after 24h window.
    </div>
    <Label>Template Name</Label>
    <InputField value={data.templateName} placeholder="e.g. order_confirmation_v1" onChange={v => data.onChange(id, 'templateName', v)} />
    <Label>Language Code</Label>
    <InputField value={data.language} placeholder="en_US" onChange={v => data.onChange(id, 'language', v)} />
    <Label>Variables (comma-separated)</Label>
    <InputField value={data.variables} placeholder="John, ORD-1234" onChange={v => data.onChange(id, 'variables', v)} />
  </BaseNode>
);

const TagNode = ({ id, data }) => (
  <BaseNode icon={Tag} color="border-cyan-400" title="Tag Contact">
    <Label>Add Tags (comma-separated)</Label>
    <InputField value={data.tags} placeholder="hot_lead, vip, size_m" onChange={v => data.onChange(id, 'tags', v)} />
    <div className="text-[10px] text-slate-400">Tags applied to this contact in your CRM.</div>
  </BaseNode>
);

const AIPromptNode = ({ id, data }) => (
  <BaseNode icon={Bot} color="border-indigo-500 shadow-indigo-100" title="AI Prompt (Llama-3)">
    <Label>System Prompt / Instruction</Label>
    <TextareaField value={data.prompt} placeholder="e.g. Look at {{user_input}} and recommend a product..." rows={3} onChange={v => data.onChange(id, 'prompt', v)} />
    <Label>Input Variable(s)</Label>
    <InputField value={data.variables} placeholder="e.g. {{user_input}}" onChange={v => data.onChange(id, 'variables', v)} />
    <Label>Save AI Response to Variable</Label>
    <InputField value={data.outputVariable} placeholder="e.g. ai_recommendation" onChange={v => data.onChange(id, 'outputVariable', v)} />
  </BaseNode>
);

const ShopifyOrderNode = ({ id, data }) => (
  <BaseNode icon={Package} color="border-green-500 shadow-green-100" title="Shopify Order Status">
    <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-[10px] text-green-700 mb-1">
      Automatically fetches real-time status from Shopify/DB.
    </div>
    <Label>Order Number Variable</Label>
    <InputField value={data.orderVar} placeholder="e.g. {{order_number}}" onChange={v => data.onChange(id, 'orderVar', v)} />
    <Label>Save Result to Variable</Label>
    <InputField value={data.outputVariable} placeholder="e.g. order_status_text" onChange={v => data.onChange(id, 'outputVariable', v)} />
  </BaseNode>
);

const ShopifyProductNode = ({ id, data }) => (
  <BaseNode icon={ShoppingBag} color="border-emerald-500 shadow-emerald-100" title="Shopify Carousel">
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[10px] text-emerald-700 mb-1">
      Sends interactive WhatsApp product cards.
    </div>
    <Label>Search Keyword / Collection</Label>
    <InputField value={data.keyword} placeholder="e.g. oversized tees" onChange={v => data.onChange(id, 'keyword', v)} />
  </BaseNode>
);

const ApiWebhookNode = ({ id, data }) => (
  <BaseNode icon={Network} color="border-orange-500 shadow-orange-100" title="API Webhook">
    <Label>HTTP Method</Label>
    <select defaultValue={data.method || 'POST'} onChange={e => data.onChange(id, 'method', e.target.value)}
    className={selectCls}>
      <option value="POST">POST</option>
      <option value="GET">GET</option>
    </select>
    <Label>Endpoint URL</Label>
    <InputField value={data.url} placeholder="https://api.example.com/webhook" onChange={v => data.onChange(id, 'url', v)} />
    <Label>JSON Payload</Label>
    <TextareaField value={data.payload} placeholder='{"name": "{{name}}"}' rows={3} onChange={v => data.onChange(id, 'payload', v)} />
    <Label>Save Response to Variable</Label>
    <InputField value={data.outputVariable} placeholder="e.g. api_response" onChange={v => data.onChange(id, 'outputVariable', v)} />
  </BaseNode>
);

const EndNode = ({ id, data }) => (
  <BaseNode icon={XCircle} color="border-rose-400" title="End Flow" noDefaultSource>
    <Label>Closing Message (optional)</Label>
    <TextareaField value={data.text} placeholder="Thank you! Our team will be in touch soon. 😊" rows={2} onChange={v => data.onChange(id, 'text', v)} />
    <Label>After Ending</Label>
    <select defaultValue={data.action || 'none'} onChange={e => data.onChange(id, 'action', e.target.value)}
    className={selectCls}>
      <option value="none">Do nothing</option>
      <option value="restart">Restart flow</option>
      <option value="handoff">Handoff to human agent</option>
      <option value="close">Close conversation</option>
    </select>
  </BaseNode>
);

/* ── NODE TYPE MAP ────────────────────────────────── */
const nodeTypes = {
  trigger: TriggerNode, text: TextMessageNode, image: ImageMessageNode,
  video: VideoMessageNode, document: DocumentNode, quick_reply: QuickReplyNode,
  url_button: UrlButtonNode, call_button: CallButtonNode, list_message: ListMessageNode,
  input_capture: InputCaptureNode, condition: ConditionNode, delay: DelayNode,
  template: TemplateNode, tag: TagNode, end: EndNode,
  ai_prompt: AIPromptNode, shopify_order: ShopifyOrderNode,
  shopify_product: ShopifyProductNode, api_webhook: ApiWebhookNode
};

/* ── BLOCK PALETTE ────────────────────────────────── */
const BLOCK_CATEGORIES = [
  {
    label: 'Triggers', color: 'text-emerald-600',
    blocks: [{ type: 'trigger', icon: Play, label: 'Keyword Trigger', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' }],
  },
  {
    label: 'Advanced AI & Data', color: 'text-indigo-600',
    blocks: [
      { type: 'ai_prompt', icon: Bot, label: 'AI Prompt', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
      { type: 'shopify_order', icon: Package, label: 'Shopify Order Status', color: 'bg-green-50 border-green-200 text-green-700' },
      { type: 'shopify_product', icon: ShoppingBag, label: 'Product Carousel', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
      { type: 'api_webhook', icon: Network, label: 'API Webhook', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    ],
  },
  {
    label: 'Messages', color: 'text-blue-600',
    blocks: [
      { type: 'text', icon: MessageSquare, label: 'Text', color: 'bg-blue-50 border-blue-200 text-blue-700' },
      { type: 'image', icon: ImageIcon, label: 'Image', color: 'bg-purple-50 border-purple-200 text-purple-700' },
      { type: 'video', icon: Video, label: 'Video', color: 'bg-pink-50 border-pink-200 text-pink-700' },
      { type: 'document', icon: File, label: 'Document', color: 'bg-amber-50 border-amber-200 text-amber-700' },
      { type: 'template', icon: FileText, label: 'Template', color: 'bg-violet-50 border-violet-200 text-violet-700' },
    ],
  },
  {
    label: 'Buttons & Choices', color: 'text-orange-600',
    blocks: [
      { type: 'quick_reply', icon: MousePointerClick, label: 'Quick Reply', color: 'bg-orange-50 border-orange-200 text-orange-700' },
      { type: 'url_button', icon: Link, label: 'URL Button', color: 'bg-sky-50 border-sky-200 text-sky-700' },
      { type: 'call_button', icon: Phone, label: 'Call Button', color: 'bg-green-50 border-green-200 text-green-700' },
      { type: 'list_message', icon: ListOrdered, label: 'List Message', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    ],
  },
  {
    label: 'Logic & Flow', color: 'text-fuchsia-600',
    blocks: [
      { type: 'input_capture', icon: AlignLeft, label: 'User Input', color: 'bg-teal-50 border-teal-200 text-teal-700' },
      { type: 'condition', icon: GitBranch, label: 'Condition', color: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700' },
      { type: 'delay', icon: Clock, label: 'Delay', color: 'bg-slate-50 border-slate-200 text-slate-700' },
      { type: 'tag', icon: Tag, label: 'Tag Contact', color: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
      { type: 'end', icon: XCircle, label: 'End Flow', color: 'bg-rose-50 border-rose-200 text-rose-700' },
    ],
  },
];

const BlockItem = ({ type, icon: Icon, label, color }) => {
  const onDragStart = e => { e.dataTransfer.setData('application/reactflow', type); e.dataTransfer.effectAllowed = 'move'; };
  return (
    <div onDragStart={onDragStart} draggable
      className={`flex items-center gap-2 px-2.5 py-2 border rounded-xl text-xs font-semibold cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none ${color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" /><span>{label}</span>
    </div>
  );
};

/* ── FLOW BUILDER MAIN ────────────────────────────── */
const makeInitialNodes = (onChange) => [{
  id: '1', type: 'trigger', position: { x: 60, y: 200 },
  data: { keyword: 'hi', matchType: 'contains', onChange },
}];

const nodeColorMap = {
  trigger: '#10b981', text: '#3b82f6', image: '#a855f7', video: '#ec4899',
  document: '#f59e0b', quick_reply: '#f97316', url_button: '#0ea5e9',
  call_button: '#22c55e', list_message: '#6366f1', input_capture: '#14b8a6',
  condition: '#d946ef', delay: '#94a3b8', template: '#8b5cf6', tag: '#06b6d4', end: '#f43f5e',
  ai_prompt: '#6366f1', shopify_order: '#22c55e', shopify_product: '#10b981', api_webhook: '#f97316'
};

const FlowBuilder = ({ initialFlow, onBack }) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [flows, setFlows] = useState([]);
  const [currentFlowId, setCurrentFlowId] = useState(initialFlow?.id || null);
  const [flowName, setFlowName] = useState(initialFlow?.name || 'New Flow');
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const updateNodeData = useCallback((nodeId, key, value) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, [key]: value } } : n));
  }, [setNodes]);

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (initialFlow) {
      const loadedNodes = (initialFlow.flow_json?.nodes || []).map(n => ({ ...n, data: { ...n.data, onChange: updateNodeData } }));
      setNodes(loadedNodes);
      setEdges(initialFlow.flow_json?.edges || []);
    } else {
      setNodes(makeInitialNodes(updateNodeData));
    }
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try { const res = await axios.get('/api/whatsapp-settings?type=flows'); setFlows(res.data || []); }
    catch (e) { console.error(e); }
  };

  const onConnect = useCallback(p => setEdges(eds => addEdge({
    ...p, animated: true, style: { stroke: '#6ee7b7', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6ee7b7' },
  }, eds)), [setEdges]);

  const onDragOver = useCallback(e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

  const onDrop = useCallback(e => {
    e.preventDefault();
    if (!reactFlowWrapper.current || !reactFlowInstance) return;
    const type = e.dataTransfer.getData('application/reactflow');
    if (!type) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    setNodes(nds => nds.concat({ id: uuidv4(), type, position, data: { onChange: updateNodeData } }));
  }, [reactFlowInstance, setNodes, updateNodeData]);

  const cleanNodes = nds => nds.map(n => { const { onChange, ...d } = n.data; return { ...n, data: d }; });

  const exportToJson = () => {
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ nodes: cleanNodes(nodes), edges }, null, 2));
    a.download = flowName.replace(/\s+/g, '_') + '_flow.json';
    a.click();
  };

  const saveToDb = async () => {
    try {
      setIsSaving(true);
      const cleanFlow = { nodes: cleanNodes(nodes), edges };
      if (currentFlowId) {
        await axios.put('/api/whatsapp-settings?type=flows', { id: currentFlowId, name: flowName, flow_json: cleanFlow, is_active: true });
      } else {
        const res = await axios.post('/api/whatsapp-settings?type=flows', { name: flowName, flow_json: cleanFlow, is_active: true });
        setCurrentFlowId(res.data.id);
      }
      showToast('✅ Flow saved & published!');
      // Go back to dashboard after a short delay so user sees the toast
      setTimeout(() => { if (onBack) onBack(); }, 1200);
    } catch (e) { showToast('❌ Failed to save flow', 'error'); }
    finally { setIsSaving(false); }
  };

  const loadFlow = flow => {
    setCurrentFlowId(flow.id); setFlowName(flow.name);
    setNodes((flow.flow_json.nodes || []).map(n => ({ ...n, data: { ...n.data, onChange: updateNodeData } })));
    setEdges(flow.flow_json.edges || []);
  };

  const newFlow = () => {
    setCurrentFlowId(null); setFlowName('New Flow');
    setNodes(makeInitialNodes(updateNodeData)); setEdges([]);
  };

  const filteredCategories = BLOCK_CATEGORIES
    .map(cat => ({ ...cat, blocks: cat.blocks.filter(b => !search || b.label.toLowerCase().includes(search.toLowerCase())) }))
    .filter(cat => cat.blocks.length > 0);

  return (
    <div className="flex flex-col h-full bg-slate-100 relative overflow-hidden" style={{ colorScheme: 'light' }}>
      {toast && (
        <div className={`fixed top-4 right-4 z-[999] px-4 py-2.5 rounded-xl shadow-xl text-sm font-semibold ${toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Top Action Bar */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-10 shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <input type="text" value={flowName} onChange={e => setFlowName(e.target.value)}
            className="text-sm font-bold text-slate-800 bg-transparent outline-none border-b border-transparent focus:border-emerald-400 max-w-[180px]" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none max-w-[140px]"
            value={currentFlowId || 'new'}
            onChange={e => { if (e.target.value === 'new') newFlow(); else { const f = flows.find(x => x.id == e.target.value); if (f) loadFlow(f); } }}>
            <option value="new">+ New Flow</option>
            {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button onClick={exportToJson}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors border border-slate-200">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={saveToDb} disabled={isSaving}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors disabled:opacity-50 shadow-sm">
            <Save className="w-3.5 h-3.5" /> {isSaving ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-52 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input type="text" placeholder="Search blocks..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {filteredCategories.map(cat => (
              <div key={cat.label}>
                <h3 className={`text-[10px] font-black uppercase tracking-widest mb-2 ${cat.color}`}>{cat.label}</h3>
                <div className="space-y-1.5">
                  {cat.blocks.map(b => <BlockItem key={b.type + b.label} {...b} />)}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-slate-100 text-[10px] text-slate-400 space-y-0.5">
            <div className="font-bold text-slate-500 mb-1">HOW TO USE</div>
            <div>• Drag blocks onto the canvas</div>
            <div>• Connect nodes via port handles</div>
            <div>• Click fields to edit content</div>
            <div>• Press Delete to remove nodes</div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onInit={setReactFlowInstance}
            onDrop={onDrop} onDragOver={onDragOver}
            nodeTypes={nodeTypes} fitView deleteKeyCode="Delete"
            defaultEdgeOptions={{ style: { stroke: '#6ee7b7', strokeWidth: 2 }, animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#6ee7b7' } }}>
            <Background color="#e2e8f0" gap={20} size={1} />
            <Controls className="!bg-white !border-slate-200 !rounded-xl !shadow-md" />
            <MiniMap nodeColor={n => nodeColorMap[n.type] || '#94a3b8'}
              className="!bg-slate-900 !border-slate-700 !rounded-xl" maskColor="rgba(0,0,0,0.4)" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

/* ── FLOWS DASHBOARD ──────────────────────────────── */
const FlowsDashboard = ({ onEdit, onNew }) => {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchFlows = async () => {
    setLoading(true);
    try { const res = await axios.get('/api/whatsapp-settings?type=flows'); setFlows(res.data || []); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFlows(); }, []);

  const deleteFlow = async (flow) => {
    if (!window.confirm(`Delete "${flow.name}"? This cannot be undone.`)) return;
    setDeleting(flow.id);
    try {
      await axios.delete('/api/whatsapp-settings?type=flows', { data: { id: flow.id } });
      setFlows(f => f.filter(x => x.id !== flow.id));
      showToast('Flow deleted');
    } catch (e) { showToast('Delete failed', 'error'); }
    finally { setDeleting(null); }
  };

  const togglePublish = async (flow) => {
    setToggling(flow.id);
    try {
      await axios.put('/api/whatsapp-settings?type=flows', {
        id: flow.id, name: flow.name, flow_json: flow.flow_json, is_active: !flow.is_active
      });
      setFlows(f => f.map(x => x.id === flow.id ? { ...x, is_active: !x.is_active } : x));
      showToast(flow.is_active ? 'Flow unpublished' : '✅ Flow published & live!');
    } catch (e) { showToast('Update failed', 'error'); }
    finally { setToggling(null); }
  };

  const totalFlows = flows.length;
  const activeFlows = flows.filter(f => f.is_active).length;
  const totalNodes = flows.reduce((acc, f) => acc + (f.flow_json?.nodes?.length || 0), 0);

  const nodeTypeBadgeColor = (type) => {
    const m = { trigger: 'bg-emerald-100 text-emerald-700', text: 'bg-blue-100 text-blue-700', image: 'bg-purple-100 text-purple-700', quick_reply: 'bg-orange-100 text-orange-700', url_button: 'bg-sky-100 text-sky-700', call_button: 'bg-green-100 text-green-700', list_message: 'bg-indigo-100 text-indigo-700', condition: 'bg-fuchsia-100 text-fuchsia-700', delay: 'bg-slate-100 text-slate-600', end: 'bg-rose-100 text-rose-600' };
    return m[type] || 'bg-slate-100 text-slate-600';
  };

  const getFlowSummary = (flow) => {
    const nodes = flow.flow_json?.nodes || [];
    const trigger = nodes.find(n => n.type === 'trigger');
    const types = [...new Set(nodes.filter(n => n.type !== 'trigger').map(n => n.type))];
    return { keyword: trigger?.data?.keyword || '—', nodeCount: nodes.length, types: types.slice(0, 3) };
  };

  return (
    <div className="flex flex-col h-full overflow-auto" style={{ colorScheme: 'light', background: '#f1f5f9' }}>
      {toast && (
        <div className={`fixed top-4 right-4 z-[999] px-4 py-2.5 rounded-xl shadow-xl text-sm font-semibold ${toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500" />
            WhatsApp Flow Builder
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Build automated chatbot journeys triggered by keywords</p>
        </div>
        <button onClick={onNew}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm shadow-emerald-200">
          <PlusCircle className="w-4 h-4" /> New Flow
        </button>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Flows', value: totalFlows, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Published (Live)', value: activeFlows, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
            { label: 'Total Nodes', value: totalNodes, icon: BarChart2, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
          ].map(stat => (
            <div key={stat.label} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${stat.bg}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <div className={`text-2xl font-black ${stat.color}`}>{loading ? '—' : stat.value}</div>
                <div className="text-xs text-slate-500 font-medium">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Flows Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading flows...</span>
            </div>
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
            <Zap className="w-14 h-14 mb-4 text-slate-200" />
            <h3 className="text-base font-bold text-slate-500">No flows yet</h3>
            <p className="text-sm mt-1 mb-5">Create your first automated WhatsApp flow</p>
            <button onClick={onNew}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors">
              <PlusCircle className="w-4 h-4" /> Create First Flow
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {flows.map(flow => {
              const { keyword, nodeCount, types } = getFlowSummary(flow);
              return (
                <div key={flow.id} className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col overflow-hidden group">
                  {/* Card Top */}
                  <div className="p-4 flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${flow.is_active ? 'bg-emerald-400 shadow-sm shadow-emerald-300' : 'bg-slate-300'}`} />
                        <h3 className="text-sm font-bold text-slate-800 truncate">{flow.name}</h3>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${flow.is_active ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {flow.is_active ? 'LIVE' : 'DRAFT'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <Play className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>Triggers on: <strong className="text-slate-700">"{keyword}"</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="w-3 h-3 text-blue-500 shrink-0" />
                        <span><strong className="text-slate-700">{nodeCount}</strong> nodes in flow</span>
                      </div>
                      {flow.updated_at && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Updated {new Date(flow.updated_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {types.map(t => (
                          <span key={t} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${nodeTypeBadgeColor(t)}`}>
                            {t.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onEdit(flow)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-600 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-3 py-1.5 rounded-lg transition-all">
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => togglePublish(flow)}
                        disabled={toggling === flow.id}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50 ${
                          flow.is_active
                            ? 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100'
                            : 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        }`}>
                        {flow.is_active
                          ? <><ToggleRight className="w-3.5 h-3.5" /> Unpublish</>
                          : <><ToggleLeft className="w-3.5 h-3.5" /> Publish</>}
                      </button>
                    </div>
                    <button onClick={() => deleteFlow(flow)} disabled={deleting === flow.id}
                      className="flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1.5 rounded-lg transition-all disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* New Flow Card */}
            <button onClick={onNew}
              className="bg-white rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all flex flex-col items-center justify-center gap-2 p-8 text-slate-400 hover:text-emerald-600 min-h-[180px]">
              <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold">Create New Flow</span>
            </button>
          </div>
        )}

        {/* Analytics Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-black text-slate-700 flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-purple-500" /> Flow Analytics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Flows Active', value: activeFlows, sub: `of ${totalFlows} total`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Total Nodes', value: totalNodes, sub: 'across all flows', color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Avg. Nodes', value: totalFlows > 0 ? Math.round(totalNodes / totalFlows) : 0, sub: 'per flow', color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Draft Flows', value: totalFlows - activeFlows, sub: 'not yet published', color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(stat => (
              <div key={stat.label} className={`rounded-xl p-3 ${stat.bg}`}>
                <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
                <div className="text-xs font-semibold text-slate-600 mt-0.5">{stat.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>

          {flows.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-500 mb-3">FLOW BREAKDOWN</h3>
              <div className="space-y-2">
                {flows.map(flow => {
                  const { nodeCount } = getFlowSummary(flow);
                  const pct = totalNodes > 0 ? Math.round((nodeCount / totalNodes) * 100) : 0;
                  return (
                    <div key={flow.id} className="flex items-center gap-3">
                      <div className="text-xs text-slate-600 font-medium w-32 truncate">{flow.name}</div>
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-400 w-14 text-right">{nodeCount} nodes</div>
                      <span className={`text-[10px] font-bold px-1.5 rounded-full ${flow.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {flow.is_active ? 'LIVE' : 'DRAFT'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── MAIN EXPORT ─────────────────────────────────── */
export default function ChatbotFlowBuilder() {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'builder'
  const [editingFlow, setEditingFlow] = useState(null);

  const handleEdit = (flow) => { setEditingFlow(flow); setView('builder'); };
  const handleNew = () => { setEditingFlow(null); setView('builder'); };
  const handleBack = () => { setEditingFlow(null); setView('dashboard'); };

  if (view === 'dashboard') {
    return <FlowsDashboard onEdit={handleEdit} onNew={handleNew} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Back button bar */}
      <div className="h-10 bg-white border-b border-slate-200 flex items-center px-4 shrink-0" style={{ colorScheme: 'light' }}>
        <button onClick={handleBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Flows
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ReactFlowProvider>
          <FlowBuilder initialFlow={editingFlow} onBack={handleBack} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
