const state = { studio: null, profileSample: null, vibeSample: null, activeCase: 'vibe', family: null, style: null, palette: null, referenceStyle: null, mode: 'direct', template: 'standard', references: [], jobId: null, poller: null, quotes: [], quoteIndex: 0, quoteTimer: null, timingTicker: null, lastJob: null, jobReceivedAt: 0, ambientRgb: [101,88,245] };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const ONLINE_MODE = new URLSearchParams(location.search).get('online') === '1'
  || !['localhost','127.0.0.1'].includes(location.hostname);

const PROMPTS = [
  {
    id: 'standard', name: '标准汇报', tag: 'STRUCTURED',
    description: '适合课程、总结、方案和内部汇报',
    text: '生成主题为《{title}》的 HTML 格式网页内容，共 {pages} 页，用于 PPT 汇报展示。需要结构化呈现，每页突出一个核心观点。正文内容如下：\n\n{content}',
  },
  {
    id: 'flow', name: '流程图叙事', tag: 'PROCESS',
    description: '适合方法论、操作步骤、成长路径和项目流程',
    text: '生成主题为《{title}》的 HTML 格式流程型 PPT，共 {pages} 页。请把正文提炼为一条清晰主线，用阶段、节点、箭头、时间轴或流程图结构呈现；每页只解释一个步骤或转折，避免堆砌段落。正文内容如下：\n\n{content}',
  },
  {
    id: 'launch', name: '发布会叙事', tag: 'KEYNOTE',
    description: '适合产品发布、观点演讲和高传播性分享',
    text: '生成主题为《{title}》的 HTML 发布会式 PPT，共 {pages} 页。叙事节奏采用“钩子—问题—转折—方案—演示—行动”，每页突出一个强观点，标题短而有力量，内容以大字、数据和视觉节奏为主。正文内容如下：\n\n{content}',
  },
  {
    id: 'editorial-profile', name: '个人网站·杂志编辑风', tag: 'EDITORIAL',
    description: '单文件个人主页，深墨绿 × 奶油纸，适合讲师、创作者和个人品牌',
    text: `请帮我做一个单文件 HTML 个人网站（CSS/JS 全内联，适配手机）。风格是【杂志编辑风 / editorial】：

【配色】主色深墨绿 #0f1f1a，中墨绿 #214a3e，底色奶油纸 #f5efe6，深纸 #ebe3d5，烧赭强调 #b04a2f；分隔线用 rgba(15,31,26,.18) 的 1px 细线。不要蓝、不要紫、不要默认蓝。

【字体】大标题 Fraunces（衬线，可 italic 强调），中文 Noto Serif SC，元数据 JetBrains Mono；标题必须用衬线，禁用 Inter 当大标题。

【背景】body 加一层 SVG feTurbulence 纸纹噪点（opacity .35，mix-blend-mode multiply），老书纸质感。

【结构】分 5 章节（Hero 大标题 / 关于 / 能力 / 学员好评 / 联系），章间 1px 细线分隔，大量留白。

【动效】IntersectionObserver 滚动揭示（translateY 24px→0 + 透明度）。

【禁止】渐变大色块、玻璃拟态、emoji 堆砌。

【案例图】增加案例 / 作品图片展示区域；图片采用杂志式裁切、题注和编号。案例图片在后续提供时可直接替换占位图。用于提取风格的参考图仍不得直接显示在网页中。

以下是我的个人资料：
{content}`,
  },
];

function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function readableText(hex) { const v=(hex||'#111111').replace('#',''); const rgb=v.length===3?v.split('').map(x=>parseInt(x+x,16)):[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)); return rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>150?'#12141b':'#fff'; }

async function loadStudio() {
  $('#scan-status').textContent = '正在读取本地 Skill…';
  const [studio, quoteData, profileSample, vibeSample] = await Promise.all([
    fetch(ONLINE_MODE?'./data/online-catalog.json':'/api/studio-catalog').then(r => r.json()),
    fetch('./data/obsidian-quotes.json').then(r => r.ok ? r.json() : { quotes: [] }).catch(() => ({ quotes: [] })),
    fetch('./data/86-profile.json').then(r => r.json()),
    fetch('./data/vibe-coding-20.json').then(r => r.json()),
  ]);
  state.studio = studio; state.quotes = quoteData.quotes || []; state.profileSample = profileSample; state.vibeSample = vibeSample;
  $('#scan-status').textContent = ONLINE_MODE?`${state.studio.stats.families} 个主 Skill · ${state.studio.stats.styles} 套代表样式 · 永久在线预览`:`${state.studio.stats.families} 个主 Skill · ${state.studio.stats.styles} 套样式 · Codex ${state.studio.codex.available ? '可用' : '不可用'}`;
  renderFamilies(); renderPromptTemplates(); renderReferenceStyles(); renderCoverage();
}

function renderFamilies() {
  const primary=state.studio.families.filter(f=>f.primary); const extensions=state.studio.families.filter(f=>!f.primary);
  const card=(family,index)=>`<button class="family-card ${state.family?.id===family.id?'selected':''}" data-family="${family.id}" style="--family-accent:${family.accent}">
    <span class="family-index">${String(index+1).padStart(2,'0')}</span><img src="${family.previewImage||''}" alt="" loading="lazy">
    <div><small>${escapeHtml(family.author)} · ${family.count} 套</small><h3>${escapeHtml(family.zhName)}<em>${escapeHtml(family.name)}</em></h3><p>${escapeHtml(family.tagline)}</p></div><i>→</i>
  </button>`;
  $('#family-grid').innerHTML=primary.map(card).join('');
  $('#extension-row').innerHTML=extensions.map((family,index)=>`<button data-family="${family.id}" class="extension-card ${state.family?.id===family.id?'selected':''}"><span>扩展 ${index+1}</span><b>${escapeHtml(family.zhName)} / ${escapeHtml(family.name)}</b><small>${escapeHtml(family.author)} · ${family.tagline}</small></button>`).join('');
}

function selectFamily(id) {
  state.family = state.studio.families.find(f => f.id === id); state.style = state.family.styles[0];
  renderFamilies();
  $('#skill-detail').classList.remove('hidden');
  $('#detail-author').textContent = `作者 · ${state.family.author}`;
  $('#detail-name').textContent = `${state.family.zhName} / ${state.family.name}`;
  $('#detail-reason').textContent = state.family.recommendation;
  $('#detail-repo').href = `https://github.com/${state.family.repo}`;
  $('#detail-image').src=state.family.previewImage||''; $('#detail-image').alt=`${state.family.name} 实际效果截图`;
  $('#style-select').innerHTML = state.family.styles.map(style => `<option value="${escapeHtml(style.id)}">${escapeHtml(style.zhName||style.name)} / ${escapeHtml(style.name)}</option>`).join('');
  $('#color-select').innerHTML = state.family.palettes.map(palette => `<option value="${escapeHtml(palette.id)}">${escapeHtml(palette.name)}</option>`).join('');
  state.palette=state.family.palettes[0]; renderThemeGallery(); updatePaletteDisplay();
  updateSelectionSummary(); updateCasePreview();
}

function styleLabel(style){return `${style.zhName||style.name} / ${style.name}`;}
function effectivePalette(){if(!state.palette)return state.style?.palette||[];return state.palette.id==='theme'?(state.style?.palette||state.palette.colors):state.palette.colors;}
function colorMetrics(hex){const clean=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(clean))return{rgb:[101,88,245],s:0};const rgb=[0,2,4].map(i=>parseInt(clean.slice(i,i+2),16));const max=Math.max(...rgb),min=Math.min(...rgb);return{rgb,s:max===0?0:(max-min)/max};}
function updateWorkbenchTheme(){const colors=effectivePalette().filter(c=>/^#[0-9a-f]{6}$/i.test(c));const dominant=colors.map(color=>({color,...colorMetrics(color)})).sort((a,b)=>b.s-a.s)[0]||{color:state.family?.accent||'#6558f5',rgb:[101,88,245]};state.ambientRgb=dominant.rgb;const root=document.documentElement;root.style.setProperty('--workspace-color',dominant.color);root.style.setProperty('--violet',dominant.color);root.style.setProperty('--coral',`color-mix(in srgb,${dominant.color} 72%,#ffffff)`);root.style.setProperty('--mint',`color-mix(in srgb,${dominant.color} 45%,#ffffff)`);document.body.dataset.activeFamily=state.family?.id||'';}
function updatePaletteDisplay(){
  state.palette=state.family.palettes.find(p=>p.id===$('#color-select').value)||state.family.palettes[0];
  $('#selected-palette-swatches').innerHTML=effectivePalette().map(color=>`<span style="--swatch:${color}" title="${color}"><i></i><b>${color}</b></span>`).join('');
}
function casePreviewUrl(){
  const casePath=state.activeCase==='vibe'?'./cases/vibe-coding-20/index.html':'./cases/86-profile/index.html';
  if(!state.family||!state.style)return casePath;
  const query=new URLSearchParams({family:state.family.id,style:state.style.id,colors:effectivePalette().join(',')});
  return `${casePath}?${query.toString()}`;
}
function updateCasePreview(){updateWorkbenchTheme();const frame=$('#instant-case-frame');if(!frame)return;const vibe=state.activeCase==='vibe';frame.src=casePreviewUrl();frame.title=vibe?'Vibe Coding 20页课程案例':'86老师个人介绍案例';$('#instant-case-title').textContent=vibe?`${state.family?.zhName||'Vibe Coding'} · 20 页专属版式案例`:'86 老师真实内容案例';$('#instant-case-copy').textContent=vibe?'主 Skill 决定版式语言，配色在同一色系内生成；切换后工作台环境也会同步变化。':'选择任一主题或配色，下面立即切换；生成前先看到真实内容效果。';$('#sample-btn').classList.toggle('featured',vibe);$('#profile-sample-btn').classList.toggle('featured',!vibe);}
function renderThemeGallery(){
  $('#theme-count').textContent=`${state.family.styles.length} 套`;
  $('#theme-gallery').innerHTML=state.family.styles.map(style=>`<button class="theme-chip ${state.style?.id===style.id?'selected':''}" data-style-id="${escapeHtml(style.id)}"><div>${(style.palette||[]).slice(0,5).map(color=>`<i style="--swatch:${color}"></i>`).join('')}</div><b>${escapeHtml(style.zhName||style.name)}</b><small>${escapeHtml(style.name)}</small></button>`).join('');
}

function renderReferenceStyles(){
  $('#reference-style-list').innerHTML=`<button class="reference-style-card ${state.referenceStyle===null?'selected':''}" data-reference-style=""><span class="no-ref">NONE</span><div><b>不叠加参考风格</b><small>只使用所选 Skill 与主题</small></div></button>`+state.studio.referenceStyles.map(style=>`<button class="reference-style-card ${state.referenceStyle?.id===style.id?'selected':''}" data-reference-style="${style.id}"><img src="${style.previewImage}" alt=""><div><b>${escapeHtml(style.name)}</b><small>${escapeHtml(style.description)}</small><span class="ref-swatches">${style.palette.map(c=>`<i style="--swatch:${c}"></i>`).join('')}</span></div></button>`).join('');
}

function renderCoverage(){
  $('#coverage-list').innerHTML=state.studio.coverage.map(item=>`<div><span>✓</span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.author)} · ${escapeHtml(item.note)}</small><em>${escapeHtml(item.status)}</em></div>`).join('');
}

function updateSelectionSummary() {
  if (!state.family || !state.style) return;
  $('#rail-skill').textContent = `${state.family.name} · ${state.family.author}`;
  $('#rail-style').textContent = state.style.zhName||state.style.name;
  $('#launch-summary').textContent = `${state.family.name} / ${state.style.zhName||state.style.name} / ${state.palette?.name||'主题原色'}${state.referenceStyle?` / +${state.referenceStyle.name}`:''}`;
  $('#generate-btn').disabled = ONLINE_MODE||!state.studio.codex.available;
  if(ONLINE_MODE){$('#generate-btn').innerHTML='在线预览版 · 生成请打开本机版 <span>↗</span>';$('#launch-summary').textContent=`${state.family.name} / ${state.style.zhName||state.style.name} / 可永久预览`}
}

function switchPanel(panelId) {
  $$('.rail-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.panel === panelId));
  $$('.config-panel').forEach(panel => panel.classList.toggle('active', panel.id === panelId));
  document.getElementById(panelId).scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderPromptTemplates() {
  $('#prompt-template-list').innerHTML = PROMPTS.map(item => `<button class="prompt-card ${state.template===item.id?'selected':''}" data-template="${item.id}"><span>${item.tag}</span><b>${item.name}</b><small>${item.description}</small></button>`).join('');
  const selected = PROMPTS.find(item => item.id === state.template); $('#prompt-editor').value = selected.text;
}

function setMode(mode) {
  state.mode = mode; $$('.mode-choice').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  $('#template-area').classList.toggle('hidden', mode !== 'template'); $('#direct-note').classList.toggle('hidden', mode === 'template');
  $('#prompt-tab-status').textContent = mode === 'direct' ? '直接生成' : PROMPTS.find(item=>item.id===state.template).name;
}

function inferContent() {
  const text = $('#content-input').value; $('#char-count').textContent = `${text.length} 字`;
  const tags = [/课程|培训|学员/.test(text)&&'课程培训', /AI|编程|产品|网站/.test(text)&&'科技产品', /女性/.test(text)&&'女性学习者', /流程|步骤|路径/.test(text)&&'流程型'].filter(Boolean);
  $('#content-tags').innerHTML = (tags.length?tags:['等待分析']).map(tag=>`<span>${tag}</span>`).join('');
  if (/模块六|六个模块/.test(text)) $('#page-count').value = 20;
}

async function loadSample() {
  const sample = state.vibeSample||await fetch('/api/sample').then(r=>r.json());state.activeCase='vibe';$('#deck-title').value=sample.title;$('#content-input').value=sample.content;$('#page-count').value=sample.pages||20;inferContent();updateCasePreview();
}

function loadProfileSample(){
  if(!state.profileSample)return;state.activeCase='profile';$('#deck-title').value=state.profileSample.title;$('#content-input').value=state.profileSample.content;$('#page-count').value=state.profileSample.pages||9;inferContent();updateCasePreview();
}

function showStylePreview() {
  if (!state.style) return;
  $('#preview-title').textContent = `${state.family.name} · ${state.style.name} · ${state.activeCase==='vibe'?'Vibe Coding 20页':'86老师'}案例`;
  $('#preview-stage').innerHTML = `<iframe sandbox="allow-scripts allow-forms allow-popups allow-same-origin" src="${casePreviewUrl()}"></iframe>`;
  $('#preview-dialog').showModal();
}

function addReferences(files) {
  [...files].slice(0, Math.max(0,5-state.references.length)).forEach(file => {
    if (!file.type.startsWith('image/') || file.size > 8*1024*1024) return;
    const reader = new FileReader(); reader.onload = () => { state.references.push({ id: crypto.randomUUID(), name:file.name, type:file.type, data:reader.result }); renderReferences(); }; reader.readAsDataURL(file);
  });
}

function renderReferences() {
  $('#reference-count').textContent = `${state.references.length} 张，仅参考`;
  $('#reference-grid').innerHTML = state.references.map(ref=>`<figure><img src="${ref.data}" alt=""><figcaption>${escapeHtml(ref.name)}</figcaption><button data-remove-ref="${ref.id}">×</button></figure>`).join('');
}

function compilePrompt() {
  const title=$('#deck-title').value.trim()||'未命名演示'; const content=$('#content-input').value.trim(); const pages=$('#page-count').value;
  if (state.mode==='direct') return content;
  return $('#prompt-editor').value.replaceAll('{title}',title).replaceAll('{pages}',pages).replaceAll('{content}',content);
}

async function startGeneration() {
  const content=$('#content-input').value.trim(); if(!state.family){switchPanel('skill-panel');return;} if(!content){$('#content-input').focus();return;}
  $('#generate-btn').disabled=true; $('#job-card').classList.remove('hidden'); $('#job-card').dataset.status='queued'; $('#result-wrap').classList.add('hidden'); $('#job-log').textContent='任务已创建，正在启动 Codex…'; resetJobDisplay(); startQuoteRotation(); $('#job-card').scrollIntoView({behavior:'smooth'});
  const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:$('#deck-title').value.trim(),pages:Number($('#page-count').value),content,familyId:state.family.id,styleId:state.style.id,color:`${state.palette?.name||'主题原色'} (${effectivePalette().join(' / ')})`,referenceStyleId:state.referenceStyle?.id||null,mode:state.mode,promptText:compilePrompt(),references:state.references.map(({name,type,data})=>({name,type,data}))})});
  const result=await response.json(); if(!response.ok){showJobError(result.error||'启动失败');return;} state.jobId=result.id; localStorage.setItem('htmlPptStudioJob',result.id); monitorJob();
}

function showJobError(message){$('#job-card').dataset.status='failed';$('#job-status-label').textContent='GENERATION FAILED';$('#job-title').textContent='生成启动失败';$('#job-log').textContent=message;$('#job-progress-bar').style.width='100%';$('#job-progress-text').textContent='—';$('#job-stage').textContent='生成已停止';$('#job-remaining').textContent='已停止';stopJobTimers();$('#generate-btn').disabled=false;}

function formatDuration(seconds){
  const safe=Math.max(0,Math.floor(Number(seconds)||0)); const minutes=Math.floor(safe/60); const rest=safe%60;
  return `${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`;
}

function resetJobDisplay(){
  state.lastJob=null; state.jobReceivedAt=Date.now(); $('#job-progress-bar').style.width='5%'; $('#job-progress-text').textContent='5%'; $('#job-stage').textContent='正在排队'; $('#job-elapsed').textContent='00:00'; $('#job-remaining').textContent='约 06:00'; $('#job-time').textContent='本地生成 · 实时更新';
}

function showQuote(index){
  if(!state.quotes.length)return; state.quoteIndex=(index+state.quotes.length)%state.quotes.length; const quote=state.quotes[state.quoteIndex]; const card=$('#waiting-quote'); card.classList.add('changing');
  setTimeout(()=>{$('#waiting-quote-text').textContent=quote.text;$('#waiting-quote-source').textContent=`来自「${quote.source}」`;$('#quote-counter').textContent=`等待时读一句 · ${state.quoteIndex+1} / ${state.quotes.length}`;card.classList.remove('changing');},220);
}

function startQuoteRotation(){
  clearInterval(state.quoteTimer); if(!state.quotes.length)return; showQuote(Math.floor(Math.random()*state.quotes.length)); state.quoteTimer=setInterval(()=>showQuote(state.quoteIndex+1),9000);
}

function stopJobTimers(){clearInterval(state.timingTicker);state.timingTicker=null;clearInterval(state.quoteTimer);state.quoteTimer=null;}

function renderLiveTiming(){
  const job=state.lastJob;if(!job?.timing)return;const terminal=job.status==='completed'||job.status==='failed';const extra=terminal?0:Math.floor((Date.now()-state.jobReceivedAt)/1000);const elapsed=job.timing.elapsedSeconds+extra;const total=job.timing.estimatedTotalSeconds||360;const timedProgress=Math.min(94,8+Math.round((elapsed/total)*74));const progress=terminal?100:Math.max(job.timing.progress||5,timedProgress);
  $('#job-progress-bar').style.width=`${progress}%`;$('#job-progress-text').textContent=`${progress}%`;$('#job-stage').textContent=job.timing.stage||'正在生成';$('#job-elapsed').textContent=formatDuration(elapsed);
  if(job.status==='completed')$('#job-remaining').textContent='已完成';else if(job.status==='failed')$('#job-remaining').textContent='已停止';else if(elapsed>=total)$('#job-remaining').textContent='已超预计 · 继续生成';else $('#job-remaining').textContent=`约 ${formatDuration(total-elapsed)}`;
}

function friendlyJobLog(job){
  const raw=(job.log||[]).join('\n'); const lines=['✓ 任务已创建并进入本地生成队列'];
  if(/thread.started|turn.started/.test(raw))lines.push('✓ 已连接 Codex，正在读取所选 Skill');
  if(/Skill 已完整读取|完整读取 Skill/.test(raw))lines.push('✓ Skill 规则读取完成，正在规划页面结构');
  if(/开始落地|index\.html|文件已生成/.test(raw))lines.push('✓ 页面结构已确定，正在生成 HTML 文件');
  if(/Reconnecting|stream disconnected|falling back to HTTP/.test(raw)&&job.status==='running')lines.push('↻ 网络出现波动，Codex 正在自动重连，不需要重新提交');
  if(/静态验证已通过|验证/.test(raw))lines.push('✓ 文件已生成，正在进行结构与交互验证');
  if(job.status==='completed')lines.push('✓ 生成完成，结果已在下方打开');
  if(job.status==='failed')lines.push(`× ${job.error||'生成失败，可以点击上方按钮重新提交'}`);
  return [...new Set(lines)].join('\n\n');
}

async function monitorJob(){clearTimeout(state.poller);const response=await fetch(`/api/jobs/${state.jobId}`);if(!response.ok){localStorage.removeItem('htmlPptStudioJob');return;}const job=await response.json();state.lastJob=job;state.jobReceivedAt=Date.now();$('#job-card').classList.remove('hidden');$('#job-card').dataset.status=job.status;$('#job-title').textContent=job.status==='completed'?'生成完成':job.status==='failed'?'生成失败':'Codex 正在生成 HTML PPT';$('#job-status-label').textContent=job.status.toUpperCase();$('#job-time').textContent=job.status==='running'?'本地生成 · 实时更新':job.status==='completed'?'已完成':'任务已停止';$('#job-log').textContent=friendlyJobLog(job);$('#job-log').scrollTop=$('#job-log').scrollHeight;renderLiveTiming();clearInterval(state.timingTicker);state.timingTicker=setInterval(renderLiveTiming,1000);if(job.status==='running'&&!state.quoteTimer)startQuoteRotation();if(job.status==='completed'){stopJobTimers();renderLiveTiming();$('#result-wrap').classList.remove('hidden');$('#result-frame').src=job.resultUrl;$('#result-link').href=job.resultUrl;$('#generate-btn').disabled=false;}else if(job.status==='failed'){showJobError(job.error||'生成失败');}else state.poller=setTimeout(monitorJob,2000);}

document.addEventListener('click',event=>{
  const rail=event.target.closest('.rail-tab');if(rail)switchPanel(rail.dataset.panel);
  const family=event.target.closest('[data-family]');if(family)selectFamily(family.dataset.family);
  const theme=event.target.closest('[data-style-id]');if(theme){state.style=state.family.styles.find(s=>s.id===theme.dataset.styleId);$('#style-select').value=state.style.id;renderThemeGallery();updatePaletteDisplay();updateSelectionSummary();updateCasePreview();}
  const refStyle=event.target.closest('[data-reference-style]');if(refStyle){state.referenceStyle=state.studio.referenceStyles.find(s=>s.id===refStyle.dataset.referenceStyle)||null;renderReferenceStyles();updateSelectionSummary();}
  const mode=event.target.closest('.mode-choice');if(mode)setMode(mode.dataset.mode);
  const template=event.target.closest('.prompt-card');if(template){state.template=template.dataset.template;renderPromptTemplates();setMode('template');}
  const remove=event.target.closest('[data-remove-ref]');if(remove){state.references=state.references.filter(r=>r.id!==remove.dataset.removeRef);renderReferences();}
  const close=event.target.closest('[data-close]');if(close)document.getElementById(close.dataset.close).close();
});
$('#style-select').addEventListener('change',event=>{state.style=state.family.styles.find(s=>s.id===event.target.value);renderThemeGallery();updatePaletteDisplay();updateSelectionSummary();updateCasePreview();});
$('#color-select').addEventListener('change',()=>{updatePaletteDisplay();updateSelectionSummary();updateCasePreview();});
$('#style-preview-btn').addEventListener('click',showStylePreview);
$('#open-case-btn').addEventListener('click',()=>window.open(casePreviewUrl(),'_blank','noopener'));
$('#content-input').addEventListener('input',inferContent);$('#sample-btn').addEventListener('click',loadSample);$('#profile-sample-btn').addEventListener('click',loadProfileSample);
$('#reference-input').addEventListener('change',event=>addReferences(event.target.files));
$('#dropzone').addEventListener('dragover',event=>{event.preventDefault();event.currentTarget.classList.add('dragging')});$('#dropzone').addEventListener('dragleave',event=>event.currentTarget.classList.remove('dragging'));$('#dropzone').addEventListener('drop',event=>{event.preventDefault();event.currentTarget.classList.remove('dragging');addReferences(event.dataTransfer.files)});
$('#generate-btn').addEventListener('click',startGeneration);$('#refresh-btn').addEventListener('click',loadStudio);

function startAmbientParticles(){
  const canvas=$('#ambient-canvas'); const ctx=canvas.getContext('2d'); const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width=0,height=0,dpr=1,mouse={x:-9999,y:-9999}; let dots=[];
  const resize=()=>{width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0);const count=Math.min(95,Math.max(36,Math.round(width*height/24000)));dots=Array.from({length:count},()=>({x:Math.random()*width,y:Math.random()*height,vx:(Math.random()-.5)*.16,vy:(Math.random()-.5)*.16,r:Math.random()*1.4+.45,t:Math.random()}));};
  const draw=()=>{ctx.clearRect(0,0,width,height);const tone=state.ambientRgb||[101,88,245];for(let i=0;i<dots.length;i++){const p=dots[i];if(!reduced){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>width)p.vx*=-1;if(p.y<0||p.y>height)p.vy*=-1;}const dist=Math.hypot(p.x-mouse.x,p.y-mouse.y);if(dist<150&&!reduced){p.x+=(p.x-mouse.x)*.0018;p.y+=(p.y-mouse.y)*.0018;}ctx.beginPath();ctx.fillStyle=`rgba(${tone[0]},${tone[1]},${tone[2]},${p.t>.72?.38:.27})`;ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();for(let j=i+1;j<dots.length;j++){const q=dots[j],d=Math.hypot(p.x-q.x,p.y-q.y);if(d<112){ctx.beginPath();ctx.strokeStyle=`rgba(${tone[0]},${tone[1]},${tone[2]},${(1-d/112)*.09})`;ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}}if(!reduced)requestAnimationFrame(draw);};
  addEventListener('resize',resize,{passive:true});addEventListener('pointermove',event=>{mouse.x=event.clientX;mouse.y=event.clientY},{passive:true});addEventListener('pointerleave',()=>{mouse.x=-9999;mouse.y=-9999});resize();draw();
}
startAmbientParticles();
loadStudio().then(()=>{selectFamily('frontend-slides');loadSample();const saved=localStorage.getItem('htmlPptStudioJob');if(saved){state.jobId=saved;monitorJob();}}).catch(error=>{$('#scan-status').textContent=`读取失败：${error.message}`});
