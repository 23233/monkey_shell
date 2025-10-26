// ==UserScript==
// @name         Jules 提示词管理器 (ProseMirror 适配版)
// @namespace    http://tampermonkey.net/
// @version      8.1
// @description  支持本地存储、管理多个提示词，并可设置默认提示词进行自动注入。修复了 TrustedHTML 兼容性问题。
// @author       Gemini (Enhanced by AI & TrustedHTML fix)
// @match        https://jules.google.com/task*
// @match        https://jules.google.com/session*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // 默认的初始提示词，仅在首次使用时或清空后添加
    const INITIAL_PROMPT = {
        id: Date.now(),
        name: '默认开发任务模板',
        content: `必须读取项目中的AGENTS.md,严格按照AGENTS.md里面的说明去理解和阅读整个项目.
要解决的问题,首先需要理解这个问题的需求,然后对比代码中的实现,找到实现策略,相关调用和受到影响的地方需要同步变更.不要遗漏,要精准.每次需要在history文件夹中新增本次变更的说明markdown文档并且必须完整说明需求和解决方案.
## 以下是本次需要解决的问题
`,
        isDefault: true
    };

    const STORAGE_KEY = 'jules_prompt_manager_v8'; // key 保持 v8，数据结构不变
    let uiCreated = false;

    // --- 数据管理函数 (无需修改) ---
    async function loadPrompts() {
        const storedData = await GM_getValue(STORAGE_KEY, null);
        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                return Array.isArray(parsed) ? parsed : [INITIAL_PROMPT];
            } catch (e) {
                console.error("Jules 提示词管理器: 解析存储数据失败。", e);
                return [INITIAL_PROMPT];
            }
        }
        return [INITIAL_PROMPT];
    }

    async function savePrompts(prompts) {
        await GM_setValue(STORAGE_KEY, JSON.stringify(prompts));
    }

    // --- 核心功能函数 (无需修改) ---
    function applyTemplate(baseTemplate) {
        const mainEditor = document.querySelector('swebot-prompt-editor .ProseMirror[contenteditable="true"]');
        if (!mainEditor) return;

        const today = new Date();
        const dateString = `今天是 ${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
        const finalText = `${baseTemplate}\n${dateString}`;

        while (mainEditor.firstChild) {
            mainEditor.removeChild(mainEditor.firstChild);
        }

        const lines = finalText.split('\n');
        lines.forEach(lineText => {
            const p = document.createElement('p');
            if (lineText.trim() === '') {
                p.appendChild(document.createElement('br'));
            } else {
                p.textContent = lineText;
            }
            mainEditor.appendChild(p);
        });

        mainEditor.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }


    // --- UI 创建与管理 (已重构以移除 innerHTML) ---
    function createAndShowUI() {
        if (uiCreated) return;
        uiCreated = true;

        // CSS 样式 (无需修改)
        GM_addStyle(`
            #prompt-manager-btn-v8 { position: fixed !important; bottom: 15px !important; right: 15px !important; z-index: 99998 !important; background-color: #4285F4 !important; color: white !important; border: none !important; border-radius: 50% !important; width: 32px !important; height: 32px !important; font-size: 16px !important; cursor: pointer !important; box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 0 !important; margin: 0 !important; line-height: 1 !important; }
            #prompt-manager-panel-v8 { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 70vw !important; max-width: 700px !important; min-width: 500px !important; background-color: #fff !important; border: 1px solid #ccc !important; box-shadow: 0 5px 15px rgba(0,0,0,0.4) !important; z-index: 99999 !important; display: none; flex-direction: column !important; border-radius: 8px !important; font-family: sans-serif !important; }
            #prompt-manager-panel-v8 * { font-family: sans-serif !important; box-sizing: border-box !important; }
            #prompt-manager-panel-v8 .pm-header, #prompt-manager-panel-v8 .pm-footer { padding: 12px 18px !important; background-color: #f5f5f5 !important; border-bottom: 1px solid #ddd !important; display: flex !important; justify-content: space-between !important; align-items: center !important; }
            #prompt-manager-panel-v8 .pm-footer { border-top: 1px solid #ddd !important; border-bottom: none !important; }
            #prompt-manager-panel-v8 .pm-title { font-size: 16px !important; font-weight: bold !important; color: #333 !important; }
            #prompt-manager-panel-v8 .pm-close-btn { font-size: 24px !important; font-weight: bold !important; cursor: pointer !important; color: #888 !important; }
            #prompt-manager-panel-v8 .pm-body { padding: 10px !important; max-height: 60vh !important; overflow-y: auto !important; }
            #prompt-manager-panel-v8 .pm-list { list-style: none !important; padding: 0 !important; margin: 0 !important; }
            #prompt-manager-panel-v8 .pm-item { display: flex !important; align-items: center !important; padding: 10px !important; border-bottom: 1px solid #eee !important; }
            #prompt-manager-panel-v8 .pm-item:last-child { border-bottom: none !important; }
            #prompt-manager-panel-v8 .pm-item-name { flex-grow: 1 !important; font-size: 14px !important; color: #333 !important; }
            #prompt-manager-panel-v8 .pm-item-name .default-badge { background-color: #1a73e8 !important; color: white !important; font-size: 10px !important; padding: 2px 6px !important; border-radius: 4px !important; margin-left: 8px !important; font-weight: bold !important; vertical-align: middle !important; }
            #prompt-manager-panel-v8 .pm-item-actions button { margin-left: 8px !important; padding: 5px 10px !important; font-size: 12px !important; border: 1px solid #ccc !important; border-radius: 4px !important; cursor: pointer !important; background-color: #f9f9f9 !important; color: #333 !important; }
            #prompt-manager-panel-v8 .pm-item-actions button.primary { background-color: #e8f0fe !important; color: #1a73e8 !important; border-color: #1a73e8 !important; }
            #prompt-manager-panel-v8 .pm-item-actions button:hover { background-color: #f0f0f0 !important; border-color: #aaa !important; }
            #prompt-edit-modal-v8 { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background-color: rgba(0,0,0,0.5) !important; z-index: 100000 !important; display: none; align-items: center !important; justify-content: center !important; }
            #prompt-edit-modal-v8 .modal-content { background: #fff !important; padding: 20px !important; border-radius: 8px !important; width: 60vw !important; max-width: 600px !important; display: flex !important; flex-direction: column !important; }
            #prompt-edit-modal-v8 .modal-content h3 { margin: 0 0 15px 0 !important; font-size: 18px !important; }
            #prompt-edit-modal-v8 .modal-content input, #prompt-edit-modal-v8 .modal-content textarea { width: 100% !important; padding: 10px !important; margin-bottom: 15px !important; border: 1px solid #ccc !important; border-radius: 4px !important; font-size: 14px !important; }
            #prompt-edit-modal-v8 .modal-content textarea { height: 250px !important; resize: vertical !important; }
            #prompt-edit-modal-v8 .modal-actions { text-align: right !important; }
            #prompt-edit-modal-v8 .modal-actions button { padding: 8px 16px !important; margin-left: 10px !important; border-radius: 4px !important; border: 1px solid #ccc !important; cursor: pointer !important; }
            #prompt-edit-modal-v8 .modal-actions .save-btn { background-color: #4285F4 !important; color: white !important; border-color: #4285F4 !important; }
        `);

        // --- 创建主 UI 元素 (无 innerHTML) ---
        const managerBtn = document.createElement('button');
        managerBtn.id = 'prompt-manager-btn-v8';
        managerBtn.textContent = 'P';
        managerBtn.title = '打开提示词管理器';
        document.body.appendChild(managerBtn);

        const panel = document.createElement('div');
        panel.id = 'prompt-manager-panel-v8';

        // 创建面板头部
        const header = document.createElement('div');
        header.className = 'pm-header';
        const title = document.createElement('span');
        title.className = 'pm-title';
        title.textContent = '提示词管理器';
        const closeBtn = document.createElement('span');
        closeBtn.className = 'pm-close-btn';
        closeBtn.title = '关闭';
        closeBtn.textContent = '×';
        header.appendChild(title);
        header.appendChild(closeBtn);

        // 创建面板主体
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'pm-body';
        const promptList = document.createElement('ul');
        promptList.className = 'pm-list';
        bodyDiv.appendChild(promptList);

        // 创建面板底部
        const footer = document.createElement('div');
        footer.className = 'pm-footer';
        const addNewBtn = document.createElement('button');
        addNewBtn.id = 'add-new-prompt-btn-v8';
        addNewBtn.textContent = '＋ 添加新提示词';
        footer.appendChild(addNewBtn);

        panel.appendChild(header);
        panel.appendChild(bodyDiv);
        panel.appendChild(footer);
        document.body.appendChild(panel);

        // --- 创建编辑/新增模态框 (无 innerHTML) ---
        const modal = document.createElement('div');
        modal.id = 'prompt-edit-modal-v8';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        const modalTitle = document.createElement('h3');
        modalTitle.id = 'modal-title-v8';

        const modalNameInput = document.createElement('input');
        modalNameInput.type = 'text';
        modalNameInput.id = 'prompt-name-input-v8';
        modalNameInput.placeholder = '提示词名称 (例如：代码审查模板)';

        const modalContentInput = document.createElement('textarea');
        modalContentInput.id = 'prompt-content-input-v8';
        modalContentInput.placeholder = '在此输入提示词内容...';

        const modalActions = document.createElement('div');
        modalActions.className = 'modal-actions';

        const modalCancelBtn = document.createElement('button');
        modalCancelBtn.id = 'modal-cancel-btn-v8';
        modalCancelBtn.textContent = '取消';

        const modalSaveBtn = document.createElement('button');
        modalSaveBtn.id = 'modal-save-btn-v8';
        modalSaveBtn.className = 'save-btn';
        modalSaveBtn.textContent = '保存';

        modalActions.appendChild(modalCancelBtn);
        modalActions.appendChild(modalSaveBtn);
        modalContent.appendChild(modalTitle);
        modalContent.appendChild(modalNameInput);
        modalContent.appendChild(modalContentInput);
        modalContent.appendChild(modalActions);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // --- UI 渲染函数 (已重构) ---
        async function renderPromptList() {
            const prompts = await loadPrompts();
            // 安全地清空列表
            while (promptList.firstChild) {
                promptList.removeChild(promptList.firstChild);
            }

            if (prompts.length === 0) {
                const emptyItem = document.createElement('li');
                emptyItem.textContent = '暂无提示词，请点击下方按钮添加。';
                emptyItem.style.cssText = 'padding: 20px !important; text-align: center !important; color: #888 !important; list-style-type: none !important;';
                promptList.appendChild(emptyItem);
                return;
            }

            prompts.forEach(p => {
                const item = document.createElement('li');
                item.className = 'pm-item';
                item.dataset.id = p.id;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'pm-item-name';
                nameSpan.textContent = p.name;

                if (p.isDefault) {
                    const badge = document.createElement('span');
                    badge.className = 'default-badge';
                    badge.textContent = '默认';
                    nameSpan.appendChild(document.createTextNode(' ')); // 添加一个空格
                    nameSpan.appendChild(badge);
                }

                const actionsSpan = document.createElement('span');
                actionsSpan.className = 'pm-item-actions';

                const copyBtn = document.createElement('button');
                copyBtn.className = 'btn-copy';
                copyBtn.textContent = '复制';
                actionsSpan.appendChild(copyBtn);

                if (!p.isDefault) {
                    const setDefaultBtn = document.createElement('button');
                    setDefaultBtn.className = 'btn-setdefault';
                    setDefaultBtn.textContent = '设为默认';
                    actionsSpan.appendChild(setDefaultBtn);
                }

                const editBtn = document.createElement('button');
                editBtn.className = 'btn-edit';
                editBtn.textContent = '编辑';
                actionsSpan.appendChild(editBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-delete';
                deleteBtn.textContent = '删除';
                actionsSpan.appendChild(deleteBtn);

                item.appendChild(nameSpan);
                item.appendChild(actionsSpan);
                promptList.appendChild(item);
            });
        }

        // --- 事件绑定 (无需修改) ---
        managerBtn.addEventListener('click', async () => {
            await renderPromptList();
            panel.style.display = 'flex';
        });
        closeBtn.addEventListener('click', () => panel.style.display = 'none');

        addNewBtn.addEventListener('click', () => {
            modal.dataset.mode = 'add';
            modal.dataset.id = '';
            modalTitle.textContent = '添加新提示词';
            modalNameInput.value = '';
            modalContentInput.value = '';
            modal.style.display = 'flex';
        });

        modalCancelBtn.addEventListener('click', () => modal.style.display = 'none');
        modalSaveBtn.addEventListener('click', async () => {
            const name = modalNameInput.value.trim();
            const content = modalContentInput.value.trim();
            if (!name || !content) {
                alert('提示词名称和内容不能为空！');
                return;
            }

            const prompts = await loadPrompts();
            if (modal.dataset.mode === 'edit') {
                const id = Number(modal.dataset.id);
                const promptIndex = prompts.findIndex(p => p.id === id);
                if (promptIndex > -1) {
                    prompts[promptIndex].name = name;
                    prompts[promptIndex].content = content;
                }
            } else {
                prompts.push({
                    id: Date.now(),
                    name: name,
                    content: content,
                    isDefault: prompts.length === 0
                });
            }

            await savePrompts(prompts);
            await renderPromptList();
            modal.style.display = 'none';
        });

        promptList.addEventListener('click', async (e) => {
            const target = e.target;
            const item = target.closest('.pm-item');
            if (!item) return;

            const id = Number(item.dataset.id);
            let prompts = await loadPrompts();
            const currentPrompt = prompts.find(p => p.id === id);

            if (target.classList.contains('btn-copy') && currentPrompt) {
                navigator.clipboard.writeText(currentPrompt.content).then(() => {
                    target.textContent = '已复制!';
                    setTimeout(() => target.textContent = '复制', 1500);
                });
            } else if (target.classList.contains('btn-setdefault')) {
                prompts.forEach(p => p.isDefault = (p.id === id));
                await savePrompts(prompts);
                await renderPromptList();
            } else if (target.classList.contains('btn-edit') && currentPrompt) {
                modal.dataset.mode = 'edit';
                modal.dataset.id = id;
                modalTitle.textContent = '编辑提示词';
                modalNameInput.value = currentPrompt.name;
                modalContentInput.value = currentPrompt.content;
                modal.style.display = 'flex';
            } else if (target.classList.contains('btn-delete')) {
                if (confirm('确定要删除这个提示词吗？')) {
                    prompts = prompts.filter(p => p.id !== id);
                    const defaultExists = prompts.some(p => p.isDefault);
                    if (!defaultExists && prompts.length > 0) {
                        prompts[0].isDefault = true;
                    }
                    await savePrompts(prompts);
                    await renderPromptList();
                }
            }
        });
    }

    // --- 主监视循环 (无需修改) ---
    setInterval(async () => {
        const placeholder = document.querySelector('swebot-prompt-editor .ProseMirror-placeholder');
        if (!placeholder) return;

        if (!uiCreated) {
            createAndShowUI();
        }

        const prompts = await loadPrompts();
        const defaultPrompt = prompts.find(p => p.isDefault);

        if (defaultPrompt && document.querySelector('swebot-prompt-editor .ProseMirror-placeholder')) {
            applyTemplate(defaultPrompt.content);
        }
    }, 800);

})();