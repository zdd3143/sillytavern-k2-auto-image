/*
 * K2 Auto Image — a standalone SillyTavern extension.
 *
 * It hooks AI messages, extracts only the current scene, asks a local
 * Ollama/Qwen model for a visual prompt, then renders it with a local
 * ComfyUI workflow (Krea 2 Turbo by default) and appends the result to chat.
 *
 * No SillyTavern core files are modified by this extension.
 */

import {
    event_types,
    eventSource,
    getCurrentChatId,
    getRequestHeaders,
    saveSettingsDebounced,
    substituteParams,
} from '../../../../script.js';
import {
    extension_settings,
    getContext,
    renderExtensionTemplateAsync,
} from '../../../extensions.js';
import {
    delay,
    saveBase64AsFile,
} from '../../../utils.js';
import { getMessageTimeStamp, humanizedDateTime } from '../../../RossAscends-mods.js';
import {
    MEDIA_DISPLAY,
    MEDIA_SOURCE,
    MEDIA_TYPE,
    debounce_timeout,
} from '../../../constants.js';

const MODULE_NAME = 'k2auto';

const DEFAULT_STAGE1 = [
    '你是电影分镜师和 AI 绘画提示词作者。只根据<正文>和<人物设定>，写一段简体中文画面描述。',
    '要求：',
    '1. 开头先写主要人物姓名和镜头类型，例如“温楚楚的中景”。',
    '2. 描述人物外貌、发型、服装、姿势、表情。',
    '3. 描述环境、光线、色调、构图、画风。',
    '4. 只写一个静止瞬间，不写对白、心理、剧情、连续动作。',
    '5. 人物必须占画面主体，突出人物魅力与动作。',
    '6. 用姿势、距离、衣物状态和表情表现人物关系；不描写露骨性行为。',
    '7. 画风固定为现代日本 TV 动画：干净数字线稿、柔和赛璐璐阴影、清晰色块、精致眼睛、动画截图感；禁止写实、3D、照片、真人影视感。',
    '8. 100-160 字。只输出描述，不要解释、不要引号。',
].join('\n');

const DEFAULT_STAGE2 = [
    'Translate the Chinese image prompt into natural English.',
    'Keep every visual detail: character, appearance, clothing, pose, expression, setting, lighting, composition, style.',
    'Preserve the modern Japanese TV anime style. The output must include: modern Japanese TV anime, anime screencap, crisp digital lineart, soft cel shading, clean color blocks, detailed eyes, vibrant colors.',
    'Never translate it into photorealistic, 3D, CGI, or live-action style.',
    'Output English only. No Chinese characters, quotes, labels, or commentary.',
].join(' ');

const DEFAULT_QUALITY_PREFIX = [
    'masterpiece, best quality, modern Japanese TV anime, anime screencap',
    'crisp digital lineart, soft cel shading, clean color blocks',
    'detailed eyes, vibrant colors, high resolution, cinematic composition',
    'volumetric lighting, sharp focus, intricate hair and clothing details.',
].join(', ');

const DEFAULT_NEGATIVE = [
    'lowres, worst quality, low quality, normal quality, blurry, jpeg artifacts',
    'rough sketch, bad anatomy, bad hands, extra fingers, missing fingers',
    'text, watermark, signature, username, logo, cropped, out of frame',
    'photorealistic, 3d render, live action, photography, CGI',
    'realistic skin texture, monochrome, muted colors',
].join(', ');

// Built-in character -> workflow map. Each workflow already contains the
// matching character LoRA and the sampler settings for its base model, so the
// extension only has to pick the right file. Users can override this map with
// the "角色 → 工作流" JSON textarea in the settings panel.
const CHARACTER_WORKFLOW_PRESETS = [
    {
        id: 'hitamu',
        label: '希塔姆·坎',
        aliases: ['希塔姆·坎', '希塔姆', 'hitamu', 'kian', 'キタム'],
        workflow: 'K2_IG_Hitamu.json',
        width: 832,
        height: 1216,
    },
    {
        id: 'maidena',
        label: '梅伊德娜·安洁',
        aliases: ['梅伊德娜·安洁', '梅伊德娜', '安洁', 'maidena', 'ange', 'メイデナ'],
        workflow: 'K2_IG_Maidena.json',
        width: 832,
        height: 1216,
    },
    {
        id: 'hanabata',
        label: '花畑·诺金斯',
        aliases: ['花畑·诺金斯', '花畑', '诺金斯', 'hanabata', 'nohkins'],
        workflow: 'K2_IG_Hanabata.json',
        width: 832,
        height: 1216,
    },
    {
        id: 'enome',
        label: '艾诺梅',
        aliases: ['艾诺梅', 'enome', 'エノメ'],
        workflow: 'K2_IG_Enome.json',
        width: 832,
        height: 1216,
    },
    {
        id: 'noma',
        label: '诺玛·露恩',
        aliases: ['诺玛·露恩', '诺玛', '露恩', 'noma', 'rune'],
        workflow: 'K2_IG_Noma.json',
        width: 832,
        height: 1216,
    },
    {
        id: 'tokishikko',
        label: '托琪希可·达娜',
        aliases: ['托琪希可·达娜', '托琪希可', '达娜', 'tokishikko', 'dana'],
        workflow: 'K2_IG_Tokishikko.json',
        width: 832,
        height: 1216,
    },
    {
        id: 'kikuru',
        label: '基库鲁·马丹',
        aliases: ['基库鲁·马丹', '基库鲁', '马丹', 'kikuru', 'madan'],
        workflow: 'K2_IG_Kikuru.json',
        width: 832,
        height: 1216,
    },
    {
        id: 'kisara',
        label: '基萨拉',
        aliases: ['基萨拉', 'kisara', 'キサラ'],
        workflow: 'K2_IG_Kisara.json',
        width: 1024,
        height: 1024,
    },
];

const DEFAULT_SETTINGS = Object.freeze({
    enabled: false,
    comfy_url: 'http://127.0.0.1:8188',
    workflow_name: 'Krea2_Turbo_T2I.json',
    character_workflows: '',
    width: 1024,
    height: 1024,
    steps: 8,
    scale: 1,
    sampler: 'euler',
    scheduler: 'simple',
    denoise: 1,
    seed: -1,
    model: '',
    vae: '',
    clip_skip: -1,
    ref_image: '',
    llm_url: 'http://127.0.0.1:11434/v1',
    llm_model: 'richardyoung/qwen2.5-7b-instruct-abliterated:latest',
    llm_timeout_ms: 240000,
    delay_ms: 1800,
    stage1_temperature: 0.7,
    stage1_max_tokens: 450,
    stage2_temperature: 0.3,
    stage2_max_tokens: 350,
    use_character_book: true,
    include_card_fields: true,
    image_message_text: '',
    quality_prefix: DEFAULT_QUALITY_PREFIX,
    negative_prompt: DEFAULT_NEGATIVE,
    stage1_system: DEFAULT_STAGE1,
    stage2_system: DEFAULT_STAGE2,
    debug: false,
});

let settings = null;
let busy = false;
let lastSignature = '';
let statusTimer = null;

function getSettings() {
    if (!extension_settings[MODULE_NAME] || typeof extension_settings[MODULE_NAME] !== 'object') {
        extension_settings[MODULE_NAME] = {};
    }
    extension_settings[MODULE_NAME] = Object.assign({}, DEFAULT_SETTINGS, extension_settings[MODULE_NAME]);
    return extension_settings[MODULE_NAME];
}

function log(...args) {
    if (settings?.debug) {
        console.log('[K2 Auto Image]', ...args);
    }
}

function toast(message, type = 'info') {
    if (globalThis.toastr?.[type]) {
        globalThis.toastr[type](message, 'K2 自动配图');
    } else {
        console.log('[K2 Auto Image]', message);
    }
}

function setStatus(text, isError = false) {
    const el = document.getElementById('k2auto_status');
    if (!el) {
        return;
    }
    el.textContent = text;
    el.classList.toggle('k2auto-error', isError);
    clearTimeout(statusTimer);
    if (text && !isError) {
        statusTimer = setTimeout(() => {
            el.textContent = '';
        }, 12000);
    }
}

/* ------------------------------------------------------------------ */
/* Scene extraction                                                    */
/* ------------------------------------------------------------------ */

/**
 * Extracts the narrative body from an AI message.
 * Prefers <game>...</game>, otherwise strips reasoning, options, summaries,
 * comments, variable blocks, HTML tags and obvious status/data lines.
 * @param {string} text
 * @returns {string}
 */
export function extractMainBody(text) {
    const source = String(text || '');
    const gameMatches = [...source.matchAll(/<game\b[^>]*>([\s\S]*?)<\/game>/gi)];
    if (gameMatches.length) {
        return gameMatches.map(match => match[1]).join('\n\n').trim();
    }

    let body = source
        .replace(/```(?:json)?[\s\S]*?```/gi, ' ')
        .replace(/<think\b[^>]*>[\s\S]*?<\/think[^>]*>/gi, ' ')
        .replace(/<options\b[^>]*>[\s\S]*?<\/options>/gi, ' ')
        .replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/gi, ' ')
        .replace(/<comment\b[^>]*>[\s\S]*?<\/comment>/gi, ' ')
        .replace(/<UpdateVariable\b[^>]*>[\s\S]*?<\/UpdateVariable>/gi, ' ')
        .replace(/<StatusPlaceHolderImpl\s*\/>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');

    body = body.split('\n')
        .filter(line => !/^\s*(?:[\[{].*[\]}]|(?:HP|MP|好感|信任|亲密|状态|属性|数据|金币|经验|等级)\s*[:：])/i.test(line))
        .join('\n');

    return body.trim();
}

function hasMedia(message) {
    return Array.isArray(message?.extra?.media) && message.extra.media.length > 0;
}

function getLastTextMessage() {
    const chat = getContext().chat || [];
    for (let index = chat.length - 1; index >= 0; index--) {
        const message = chat[index];
        if (!message || message.is_user || message.is_system) {
            continue;
        }
        // 最后一条 AI 消息已经是图片时，手动生成也不应越过它再画上一段正文。
        if (hasMedia(message)) {
            return null;
        }
        if (extractMainBody(message.mes).length >= 20) {
            return { message, index };
        }
    }
    return null;
}

function stripEjsTags(text) {
    return String(text || '')
        .replace(/<%_[\s\S]*?_%>/g, '')
        .replace(/<%=?[\s\S]*?%>/g, '');
}

function takeIndentedSection(lines, start) {
    const out = [];
    for (let index = start; index < lines.length; index++) {
        if (index > start && /^\s{2}\S[^:]*:\s*\|?\|?\s*$/.test(lines[index])) {
            break;
        }
        out.push(lines[index]);
    }
    return out;
}

/**
 * Keeps visual sections from a character-book entry and drops intimate ones.
 * Falls back to the raw entry when no structured sections are present.
 * @param {string} content
 * @returns {string}
 */
export function extractVisualProfile(content) {
    const text = stripEjsTags(content).trim();
    const lines = text.split(/\r?\n/);
    const sections = [];

    const baseStart = lines.findIndex(line => /^\s{2}基础信息\s*:/.test(line));
    if (baseStart >= 0) {
        sections.push(...takeIndentedSection(lines, baseStart));
    }

    const shapeStart = lines.findIndex(line => /^\s{2}外形与体型\s*:/.test(line));
    if (shapeStart >= 0) {
        const shape = takeIndentedSection(lines, shapeStart);
        const allowed = /^\s{4}(?:身高与骨架|体脂与体型|皮肤|面部|发型|日常外穿|鞋袜|配饰|体态与走姿|气味)\s*:/;
        const explicit = /乳房|乳头|乳晕|阴|肛门|生殖|性器|体液|自慰|内衣|胸罩|内裤|下体|私处/;
        const block = [];
        let keep = false;
        for (const line of shape) {
            if (/^\s{4}\S[^:]*\s*:/.test(line)) {
                keep = allowed.test(line);
            }
            if (!keep || explicit.test(line)) {
                continue;
            }
            block.push(line);
        }
        if (block.length > 0) {
            sections.push('  外形与体型:', ...block);
        }
    }

    return (sections.length > 0 ? sections.join('\n') : text.slice(0, 1800)).trim();
}

function resolveActiveCharacter() {
    const context = getContext();
    if (context.characterId !== undefined && context.characters?.[context.characterId]) {
        return context.characters[context.characterId];
    }
    if (context.groupId && Array.isArray(context.characters)) {
        const lastAi = [...(context.chat || [])].reverse().find(m => m && !m.is_user && !m.is_system);
        if (lastAi?.original_avatar) {
            const byAvatar = context.characters.find(c => c.avatar === lastAi.original_avatar);
            if (byAvatar) {
                return byAvatar;
            }
        }
        if (lastAi?.name) {
            const byName = context.characters.find(c => c.name === lastAi.name);
            if (byName) {
                return byName;
            }
        }
        const group = context.groups?.find(g => g.id === context.groupId);
        if (Array.isArray(group?.members) && group.members.length > 0) {
            const firstMember = context.characters.find(c => c.avatar === group.members[0]);
            if (firstMember) {
                return firstMember;
            }
        }
    }
    return null;
}

function normalizeLookup(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[\s\u3000·・.,，。_\-—–:：;；/\\()（）\[\]【】{}]/g, '');
}

function getCharacterPresets() {
    const raw = String(settings?.character_workflows || '').trim();
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.filter(item => item && item.workflow && Array.isArray(item.aliases));
            }
        } catch (error) {
            log('character_workflows JSON 无效，使用内置映射', error);
        }
    }
    return CHARACTER_WORKFLOW_PRESETS;
}

/**
 * Pick a character workflow from the active card, then from the current scene
 * text. A card-name match beats a body mention; between body mentions, the
 * character mentioned last wins (the usual case in a multi-character scene).
 */
function resolveCharacterWorkflow(body = '') {
    const character = resolveActiveCharacter();
    // 只使用当前角色卡身份；name2 是用户人设名，不能用来决定生图角色。
    const cardNames = [
        character?.name,
        character?.data?.name,
        character?.avatar,
    ]
        .map(normalizeLookup)
        .filter(name => name.length >= 2);
    const bodyText = normalizeLookup(body);

    let best = null;
    for (const preset of getCharacterPresets()) {
        const aliases = (preset.aliases || [])
            .map(normalizeLookup)
            .filter(alias => alias.length >= 2);
        if (!aliases.length || !preset.workflow) {
            continue;
        }

        const cardHit = aliases.some(alias => cardNames.some(name => name.includes(alias)));
        let mentions = 0;
        let lastIndex = -1;
        for (const alias of aliases) {
            let from = 0;
            while (from < bodyText.length) {
                const index = bodyText.indexOf(alias, from);
                if (index === -1) {
                    break;
                }
                mentions += 1;
                lastIndex = Math.max(lastIndex, index);
                from = index + alias.length;
            }
        }

        if (!cardHit && mentions === 0) {
            continue;
        }

        const score = (cardHit ? 100 : 0) + mentions;
        if (!best
            || score > best.score
            || (score === best.score && lastIndex > best.lastIndex)) {
            best = {
                id: preset.id || preset.workflow,
                label: preset.label || preset.id || preset.workflow,
                workflow: preset.workflow,
                width: preset.width ?? settings.width,
                height: preset.height ?? settings.height,
                score,
                cardHit,
                mentions,
                lastIndex,
            };
        }
    }

    if (best) {
        return { ...best, matched: true };
    }
    return {
        id: 'default',
        label: '默认',
        workflow: settings.workflow_name,
        width: settings.width,
        height: settings.height,
        score: 0,
        cardHit: false,
        mentions: 0,
        lastIndex: -1,
        matched: false,
    };
}

function getCardSetting(character) {
    if (!settings.include_card_fields) {
        return '';
    }
    return [
        ['Name', character.name],
        ['Description', character.description],
        ['Personality', character.personality],
        ['Scenario', character.scenario],
    ]
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([label, value]) => `${label}: ${substituteParams(value.trim())}`)
        .join('\n');
}

function getBookSetting(character, body) {
    if (!settings.use_character_book) {
        return '';
    }

    let data = character.data;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch {
            data = null;
        }
    }

    const book = data?.character_book ?? character.character_book;
    let entries = book?.entries ?? [];
    if (!Array.isArray(entries)) {
        entries = Object.values(entries || {});
    }

    const bodyLower = body.toLowerCase();
    const seen = new Set();
    const matches = [];

    for (const entry of entries) {
        if (entry?.disable) {
            continue;
        }
        const comment = String(entry?.comment || '').trim();
        const content = String(entry?.content || '');
        if (!content) {
            continue;
        }

        const rawKeys = Array.isArray(entry?.keys) ? entry.keys : (Array.isArray(entry?.key) ? entry.key : []);
        let hitIdx = -1;
        for (const key of rawKeys) {
            const keyword = String(key || '').trim();
            if (keyword.length < 2) {
                continue;
            }
            const index = bodyLower.indexOf(keyword.toLowerCase());
            if (index !== -1 && (hitIdx === -1 || index < hitIdx)) {
                hitIdx = index;
            }
        }

        if (hitIdx === -1 && comment && body.includes(comment)) {
            hitIdx = body.indexOf(comment);
        }
        if (hitIdx === -1) {
            continue;
        }

        const label = comment || String(entry?.name || '').trim() || rawKeys[0] || '角色设定';
        if (seen.has(label)) {
            continue;
        }
        const profile = extractVisualProfile(content).slice(0, 1800);
        if (profile) {
            seen.add(label);
            matches.push({ name: label, profile, index: hitIdx });
        }
    }

    matches.sort((a, b) => a.index - b.index);
    return matches.slice(0, 3)
        .map(item => `【${item.name}】\n${item.profile}`)
        .join('\n\n');
}

function getCharacterSetting(body) {
    const character = resolveActiveCharacter();
    if (!character) {
        return '';
    }
    return [getCardSetting(character), getBookSetting(character, body)]
        .filter(Boolean)
        .join('\n\n');
}

/* ------------------------------------------------------------------ */
/* Local LLM prompt generation                                         */
/* ------------------------------------------------------------------ */

function cleanText(text) {
    return String(text || '')
        .replace(/^[\s"'“”‘’]+/, '')
        .replace(/[\s"'“”‘’]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractContent(data) {
    const content = data?.choices?.[0]?.message?.content
        ?? data?.choices?.[0]?.text
        ?? data?.content
        ?? '';
    if (Array.isArray(content)) {
        return content.map(part => part?.text ?? '').join('');
    }
    return String(content || '');
}

async function callLocalLlm(system, user, temperature, maxTokens) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), settings.llm_timeout_ms);

    try {
        const response = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            signal: controller.signal,
            body: JSON.stringify({
                chat_completion_source: 'custom',
                custom_url: settings.llm_url,
                model: settings.llm_model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
                stream: false,
                temperature,
                max_tokens: maxTokens,
            }),
        });

        if (!response.ok) {
            throw new Error(`本地 LLM 返回 ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        const content = extractContent(data)
            .replace(/<think\b[^>]*>[\s\S]*?<\/think[^>]*>/gi, '')
            .trim();

        if (!content) {
            throw new Error('本地 LLM 没有返回内容。');
        }
        return content;
    } finally {
        clearTimeout(timeout);
    }
}

async function buildPrompt(body) {
    const setting = getCharacterSetting(body);
    const stageOneUser = `<人物设定>\n${setting || '（未提供，以正文中的人物为准）'}\n</人物设定>\n\n<正文>\n${body}\n</正文>`;

    setStatus('正在让本地 Qwen 写分镜…');
    const chinese = cleanText(await callLocalLlm(
        settings.stage1_system,
        stageOneUser,
        Number(settings.stage1_temperature),
        Number(settings.stage1_max_tokens),
    ));

    setStatus('正在翻译成英文提示词…');
    const english = cleanText(await callLocalLlm(
        settings.stage2_system,
        chinese,
        Number(settings.stage2_temperature),
        Number(settings.stage2_max_tokens),
    ));

    return `${settings.quality_prefix} ${english}`.trim();
}

/* ------------------------------------------------------------------ */
/* ComfyUI                                                             */
/* ------------------------------------------------------------------ */

async function loadWorkflow(workflowName = settings.workflow_name) {
    // The workflow endpoint falls back to Default_Comfy_Workflow.json when the
    // requested file is missing, so verify the name against the workflow list
    // first instead of silently rendering with the wrong graph.
    const listResponse = await fetch('/api/sd/comfy/workflows', {
        method: 'POST',
        headers: getRequestHeaders(),
    });
    if (!listResponse.ok) {
        throw new Error(`读取工作流列表失败: ${await listResponse.text()}`);
    }
    const files = await listResponse.json();
    if (!Array.isArray(files) || !files.includes(workflowName)) {
        throw new Error(
            `找不到工作流 ${workflowName}。请确认它位于 SillyTavern 的 data/<user>/user/workflows 目录。`,
        );
    }

    const response = await fetch('/api/sd/comfy/workflow', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ file_name: workflowName }),
    });
    const raw = await response.text();
    if (!response.ok) {
        throw new Error(`读取工作流失败: ${raw}`);
    }

    // SillyTavern returns JSON.stringify(fileText), i.e. a JSON string that
    // contains the workflow JSON. Decode that first, then validate the graph.
    let text = raw;
    try {
        const decoded = JSON.parse(raw);
        if (typeof decoded === 'string') {
            text = decoded;
        }
    } catch {
        // Fall through to the graph validation below for a clearer error.
    }

    try {
        JSON.parse(text);
    } catch {
        throw new Error(`工作流不是合法 JSON: ${workflowName}`);
    }
    return text;
}

function replacePlaceholders(template, values) {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
        result = result.replaceAll(`"%${key}%"`, JSON.stringify(value));
    }
    return result;
}

async function buildWorkflow(prompt, options = {}) {
    const workflowName = options.workflow_name || options.workflow || settings.workflow_name;
    const template = await loadWorkflow(workflowName);
    const seed = Number(settings.seed) >= 0
        ? Number(settings.seed)
        : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

    const values = {
        prompt,
        negative_prompt: settings.negative_prompt,
        seed,
        width: Number(options.width ?? settings.width),
        height: Number(options.height ?? settings.height),
        steps: Number(settings.steps),
        scale: Number(settings.scale),
        sampler: settings.sampler,
        scheduler: settings.scheduler,
        denoise: Number(settings.denoise),
    };

    // 可选占位符只在用户真的填了值时才替换；否则留给下面的残留检查报错，
    // 避免把 %model% 替换成空字符串后 ComfyUI 才报一个难懂的 400。
    if (String(settings.model || '').trim()) {
        values.model = settings.model.trim();
    }
    if (String(settings.vae || '').trim()) {
        values.vae = settings.vae.trim();
    }
    if (Number(settings.clip_skip) >= 0) {
        values.clip_skip = Number(settings.clip_skip);
    }

    let result = replacePlaceholders(template, values);

    if (/%char_ref_image%/i.test(result)) {
        if (!settings.ref_image) {
            throw new Error('该工作流需要 %char_ref_image%（角色参考图），请在设置中填写 ComfyUI input 目录下的文件名。');
        }
        result = result.replaceAll('"%char_ref_image%"', JSON.stringify(settings.ref_image));
    }

    const unresolved = [...result.matchAll(/"%([a-z0-9_]+)%"/gi)].map(match => match[1]);
    if (unresolved.length) {
        throw new Error(
            `工作流中还有未替换的占位符：${[...new Set(unresolved)].join('、')}。`
            + '请在扩展设置里填写对应值，或从工作流中删除这些占位符。',
        );
    }

    const graph = JSON.parse(result);
    return { prompt: graph };
}

async function generateImage(prompt, options = {}) {
    const label = options.label || options.workflow_name || settings.workflow_name;
    setStatus(`正在调用 ComfyUI 生图（${label}）…`);
    const workflow = await buildWorkflow(prompt, options);

    const response = await fetch('/api/sd/comfy/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            url: settings.comfy_url,
            prompt: JSON.stringify(workflow),
        }),
    });

    if (!response.ok) {
        throw new Error(`ComfyUI 生图失败: ${await response.text()}`);
    }

    const result = await response.json();
    if (!result?.data) {
        throw new Error('ComfyUI 没有返回图片数据。');
    }
    return result;
}

function getSpeakerName(context) {
    const messages = Array.isArray(context.chat) ? context.chat : [];
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (!message?.is_user && !message?.is_system && message?.name) {
            return message.name;
        }
    }

    const character = context.characters?.[context.characterId];
    if (character?.name) {
        return character.name;
    }

    const group = context.groups?.find(item => String(item.id) === String(context.groupId));
    if (group?.name) {
        return group.name;
    }

    return context.name2 || 'Assistant';
}

async function appendImage({ format, data }, prompt, speakerName = '') {
    const context = getContext();
    const chatId = getCurrentChatId();
    const name = speakerName || getSpeakerName(context);
    const safeName = String(name).replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${safeName}_${humanizedDateTime()}`;
    const imagePath = await saveBase64AsFile(data, safeName, filename, format || 'png');

    if (getCurrentChatId() !== chatId) {
        throw new Error('生成期间切换了聊天，图片已丢弃。');
    }

    const message = {
        name,
        is_user: false,
        is_system: false,
        send_date: getMessageTimeStamp(),
        mes: settings.image_message_text || '',
        extra: {
            media: [{
                url: imagePath,
                type: MEDIA_TYPE.IMAGE,
                title: prompt,
                source: MEDIA_SOURCE.GENERATED,
            }],
            media_display: MEDIA_DISPLAY.GALLERY,
            media_index: 0,
            inline_image: false,
            k2auto: true,
        },
    };

    context.chat.push(message);
    const messageId = context.chat.length - 1;
    await eventSource.emit(event_types.MESSAGE_RECEIVED, messageId, 'extension');
    context.addOneMessage(message);
    await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, messageId, 'extension');
    await context.saveChat();
    setTimeout(() => context.scrollOnMediaLoad(), debounce_timeout.short);
}

/* ------------------------------------------------------------------ */
/* Main flow                                                           */
/* ------------------------------------------------------------------ */

function signatureFor(chatId, message, body) {
    let hash = 0;
    const value = `${chatId}|${message.send_date || ''}|${body}`;
    for (let index = 0; index < value.length; index++) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return `${hash}:${body.length}`;
}

async function processMessage(message, manual = false) {
    const body = extractMainBody(message.mes);
    if (body.length < 20) {
        throw new Error('当前消息正文太短，跳过生图。');
    }

    const chatId = getCurrentChatId();
    const signature = signatureFor(chatId, message, body);
    if (!manual && signature === lastSignature) {
        log('duplicate message, skipped');
        return;
    }
    lastSignature = signature;

    const route = resolveCharacterWorkflow(body);
    log('character workflow', route);
    const prompt = await buildPrompt(body);
    log('final prompt', prompt);

    const result = await generateImage(prompt, route);
    await appendImage(result, prompt, message.name);

    setStatus(`配图完成（${route.label}）。`);
    toast(`配图完成（${route.label}）。`, 'success');
}

async function runForMessage(message, manual = false) {
    if (busy) {
        if (manual) {
            toast('上一张还在生成中。', 'warning');
        }
        return;
    }

    busy = true;
    try {
        if (Number(settings.delay_ms) > 0) {
            await delay(Number(settings.delay_ms));
        }
        await processMessage(message, manual);
    } catch (error) {
        console.error('[K2 Auto Image]', error);
        const text = error?.name === 'AbortError'
            ? '本地 LLM 超时。'
            : String(error?.message || error);
        setStatus(text, true);
        toast(text, 'error');
    } finally {
        busy = false;
    }
}

function onCharacterMessageRendered(messageId) {
    if (!settings?.enabled) {
        return;
    }

    const context = getContext();
    const chat = context.chat;
    if (!Array.isArray(chat) || chat.length === 0) {
        return;
    }

    const index = Number.isInteger(messageId) ? messageId : chat.length - 1;
    const message = chat[index];
    if (!message || message.is_user || message.is_system || hasMedia(message)) {
        return;
    }

    if (extractMainBody(message.mes).length < 20) {
        return;
    }

    log('AI message rendered', index);
    void runForMessage(message);
}

async function generateNow() {
    const last = getLastTextMessage();
    if (!last) {
        toast('没有找到可用的 AI 正文。', 'warning');
        return;
    }
    await runForMessage(last.message, true);
}

async function testConnections() {
    setStatus('正在检查 ComfyUI…');
    try {
        const comfy = await fetch('/api/sd/comfy/ping', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ url: settings.comfy_url }),
        });
        if (!comfy.ok) {
            throw new Error('ComfyUI 无法连接。');
        }

        setStatus('正在检查本地 LLM…');
        const reply = await callLocalLlm('只回复 OK。', 'ping', 0, 8);
        setStatus(`连接正常。LLM 回复：${reply.slice(0, 40)}`);
        toast('ComfyUI 和本地 LLM 都可以连接。', 'success');
    } catch (error) {
        const text = String(error?.message || error);
        setStatus(text, true);
        toast(text, 'error');
    }
}

/* ------------------------------------------------------------------ */
/* Settings UI                                                         */
/* ------------------------------------------------------------------ */

function bindText(id, key, event = 'input') {
    const el = document.getElementById(id);
    if (!el) {
        return;
    }
    el.addEventListener(event, () => {
        settings[key] = el.value;
        saveSettingsDebounced();
    });
}

function bindNumber(id, key) {
    const el = document.getElementById(id);
    if (!el) {
        return;
    }
    el.addEventListener('input', () => {
        const value = Number(el.value);
        if (Number.isFinite(value)) {
            settings[key] = value;
            saveSettingsDebounced();
        }
    });
}

function bindCheck(id, key) {
    const el = document.getElementById(id);
    if (!el) {
        return;
    }
    el.addEventListener('change', () => {
        settings[key] = !!el.checked;
        saveSettingsDebounced();
    });
}

function loadUi() {
    const values = {
        k2auto_enabled: settings.enabled,
        k2auto_comfy_url: settings.comfy_url,
        k2auto_workflow_name: settings.workflow_name,
        k2auto_character_workflows: settings.character_workflows,
        k2auto_width: settings.width,
        k2auto_height: settings.height,
        k2auto_steps: settings.steps,
        k2auto_scale: settings.scale,
        k2auto_sampler: settings.sampler,
        k2auto_scheduler: settings.scheduler,
        k2auto_denoise: settings.denoise,
        k2auto_seed: settings.seed,
        k2auto_model: settings.model,
        k2auto_vae: settings.vae,
        k2auto_clip_skip: settings.clip_skip,
        k2auto_ref_image: settings.ref_image,
        k2auto_llm_url: settings.llm_url,
        k2auto_llm_model: settings.llm_model,
        k2auto_llm_timeout: settings.llm_timeout_ms,
        k2auto_delay: settings.delay_ms,
        k2auto_stage1_temp: settings.stage1_temperature,
        k2auto_stage1_tokens: settings.stage1_max_tokens,
        k2auto_stage2_temp: settings.stage2_temperature,
        k2auto_stage2_tokens: settings.stage2_max_tokens,
        k2auto_image_message_text: settings.image_message_text,
        k2auto_quality_prefix: settings.quality_prefix,
        k2auto_negative: settings.negative_prompt,
        k2auto_stage1_system: settings.stage1_system,
        k2auto_stage2_system: settings.stage2_system,
    };

    for (const [id, value] of Object.entries(values)) {
        const el = document.getElementById(id);
        if (!el) {
            continue;
        }
        if (el.type === 'checkbox') {
            el.checked = !!value;
        } else {
            el.value = value;
        }
    }

    const useBook = document.getElementById('k2auto_use_book');
    const cardFields = document.getElementById('k2auto_card_fields');
    const debug = document.getElementById('k2auto_debug');
    if (useBook) {
        useBook.checked = !!settings.use_character_book;
    }
    if (cardFields) {
        cardFields.checked = !!settings.include_card_fields;
    }
    if (debug) {
        debug.checked = !!settings.debug;
    }
}

async function init() {
    settings = getSettings();

    const html = await renderExtensionTemplateAsync('third-party/k2-auto-image', 'settings');
    document.getElementById('extensions_settings2')?.insertAdjacentHTML('beforeend', html);
    loadUi();

    bindCheck('k2auto_enabled', 'enabled');
    bindText('k2auto_comfy_url', 'comfy_url');
    bindText('k2auto_workflow_name', 'workflow_name');
    bindText('k2auto_character_workflows', 'character_workflows');
    bindNumber('k2auto_width', 'width');
    bindNumber('k2auto_height', 'height');
    bindNumber('k2auto_steps', 'steps');
    bindNumber('k2auto_scale', 'scale');
    bindText('k2auto_sampler', 'sampler');
    bindText('k2auto_scheduler', 'scheduler');
    bindNumber('k2auto_denoise', 'denoise');
    bindNumber('k2auto_seed', 'seed');
    bindText('k2auto_model', 'model');
    bindText('k2auto_vae', 'vae');
    bindNumber('k2auto_clip_skip', 'clip_skip');
    bindText('k2auto_ref_image', 'ref_image');
    bindText('k2auto_llm_url', 'llm_url');
    bindText('k2auto_llm_model', 'llm_model');
    bindNumber('k2auto_llm_timeout', 'llm_timeout_ms');
    bindNumber('k2auto_delay', 'delay_ms');
    bindNumber('k2auto_stage1_temp', 'stage1_temperature');
    bindNumber('k2auto_stage1_tokens', 'stage1_max_tokens');
    bindNumber('k2auto_stage2_temp', 'stage2_temperature');
    bindNumber('k2auto_stage2_tokens', 'stage2_max_tokens');
    bindText('k2auto_image_message_text', 'image_message_text');
    bindText('k2auto_quality_prefix', 'quality_prefix');
    bindText('k2auto_negative', 'negative_prompt');
    bindText('k2auto_stage1_system', 'stage1_system');
    bindText('k2auto_stage2_system', 'stage2_system');
    bindCheck('k2auto_use_book', 'use_character_book');
    bindCheck('k2auto_card_fields', 'include_card_fields');
    bindCheck('k2auto_debug', 'debug');

    document.getElementById('k2auto_generate')?.addEventListener('click', () => void generateNow());
    document.getElementById('k2auto_test')?.addEventListener('click', () => void testConnections());

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);
    console.log('[K2 Auto Image] loaded');
}

jQuery(async () => {
    try {
        await init();
    } catch (error) {
        console.error('[K2 Auto Image] failed to initialize', error);
    }
});

// Exported for integration tests and for other extensions that want to reuse
// the prompt/workflow pipeline without duplicating the ComfyUI plumbing.
export { appendImage, buildWorkflow, generateImage, init, resolveCharacterWorkflow };
