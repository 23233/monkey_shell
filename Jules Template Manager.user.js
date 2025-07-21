// ==UserScript==
// @name         Jules 模板管理器 (带动态日期)
// @namespace    http://tampermonkey.net/
// @version      6.2
// @description  遵从页面的Trusted Types安全策略，通过逐个创建元素的方式构建UI，确保脚本能够运行。按钮尺寸已优化，并会自动在模板前加入当前日期。
// @author        Gemini (Final version respecting Trusted Types)
// @match        https://jules.google.com/task*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // 默认模板内容 (不包含日期)
    const DEFAULT_TEMPLATE_TEXT = `必须读取项目中的AGENTS.md,严格按照AGENTS.md里面的说明去理解和阅读整个项目.
要解决的问题,首先需要理解这个问题的需求,然后对比代码中的实现,找到实现策略,相关调用和受到影响的地方需要同步变更.不要遗漏,要精准.每次需要在history文件夹中新增本次变更的说明doc文档.
## 以下是本次需要解决的问题
`;
    const STORAGE_KEY = 'jules_task_template_v6';
    let uiCreated = false;

    /**
     * 将模板应用到文本框，并在前面加上当天的日期
     * @param {string} baseTemplate - 基础模板字符串
     */
    function applyTemplate(baseTemplate) {
        const mainTextarea = document.querySelector('textarea.prompt-editor');
        if (!mainTextarea) return;

        // 使用 JS 计算今天的日期
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // getMonth() 返回的月份是从0开始的
        const day = today.getDate();
        const dateString = `今天是 ${year}年${month}月${day}日`;

        // 组合日期和基础模板，并注入到文本框
        const finalText = `${baseTemplate}\n${dateString}`;
        mainTextarea.value = finalText;
        mainTextarea.dispatchEvent(new Event('input', { bubbles: true })); // 触发input事件以确保页面能识别内容变化
    }


    // UI 创建函数 (遵从 Trusted Types)
    function createAndShowUI() {
        if (uiCreated) return;
        uiCreated = true;

        GM_addStyle(`
            /* --- 按钮尺寸已缩小一半 --- */
            #template-settings-btn-v6 {
                position: fixed !important;
                bottom: 15px !important; /* 调整边距 */
                right: 15px !important;  /* 调整边距 */
                background-color: #4285F4 !important;
                color: white !important;
                border: none !important;
                border-radius: 50% !important;
                width: 25px !important;   /* 宽度减半 */
                height: 25px !important;  /* 高度减半 */
                font-size: 12px !important; /* 图标大小减半 */
                cursor: pointer !important;
                box-shadow: 0 2px 6px rgba(0,0,0,0.25) !important; /* 阴影微调 */
                z-index: 99999 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            #template-settings-panel-v6 {
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                width: 60vw !important;
                max-width: 650px !important;
                background-color: white !important;
                border: 1px solid #ccc !important;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3) !important;
                z-index: 100000 !important;
                display: none;
                flex-direction: column !important;
                border-radius: 8px !important;
            }
        `);

        // --- 创建设置按钮 ---
        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'template-settings-btn-v6';
        settingsBtn.textContent = '⚙️';
        document.body.appendChild(settingsBtn);

        // --- 创建面板 (逐个元素构建) ---
        const panel = document.createElement('div');
        panel.id = 'template-settings-panel-v6';
        panel.style.display = 'none';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding: 10px 15px; background-color: #f5f5f5; font-weight: bold; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;';
        const title = document.createElement('span');
        title.textContent = '编辑默认模板';
        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.title = '关闭';
        closeBtn.style.cssText = 'cursor: pointer; font-size: 20px; font-weight: bold;';
        header.appendChild(title);
        header.appendChild(closeBtn);

        // Body
        const bodyDiv = document.createElement('div');
        bodyDiv.style.padding = '15px';
        const templateEditor = document.createElement('textarea');
        templateEditor.id = 'template-editor-v6';
        templateEditor.style.cssText = 'width: 100%; height: 250px; font-size: 14px; line-height: 1.5; box-sizing: border-box;';
        bodyDiv.appendChild(templateEditor);

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = 'padding: 10px 15px; text-align: right; border-top: 1px solid #ddd; background-color: #f5f5f5;';
        const restoreBtn = document.createElement('button');
        restoreBtn.id = 'restore-default-btn-v6';
        restoreBtn.textContent = '恢复默认';
        restoreBtn.style.cssText = 'padding: 8px 15px; margin-left: 10px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px;';
        const saveBtn = document.createElement('button');
        saveBtn.id = 'save-template-btn-v6';
        saveBtn.textContent = '保存并应用';
        saveBtn.style.cssText = 'padding: 8px 15px; margin-left: 10px; cursor: pointer; border: 1px solid #4285F4; border-radius: 4px; background-color: #4285F4; color: white;';
        footer.appendChild(restoreBtn);
        footer.appendChild(saveBtn);

        // 组装面板
        panel.appendChild(header);
        panel.appendChild(bodyDiv);
        panel.appendChild(footer);
        document.body.appendChild(panel);

        // --- 绑定事件 ---
        closeBtn.addEventListener('click', () => panel.style.display = 'none');
        settingsBtn.addEventListener('click', async () => {
            // 编辑器里只显示和编辑基础模板
            const currentTemplate = await GM_getValue(STORAGE_KEY, DEFAULT_TEMPLATE_TEXT);
            templateEditor.value = currentTemplate;
            panel.style.display = 'flex';
        });
        restoreBtn.addEventListener('click', () => {
            if (confirm('您确定要恢复到最初的默认模板吗？')) {
                templateEditor.value = DEFAULT_TEMPLATE_TEXT;
            }
        });
        saveBtn.addEventListener('click', () => {
            const newTemplate = templateEditor.value;
            GM_setValue(STORAGE_KEY, newTemplate);
            alert('模板已保存！');
            panel.style.display = 'none';
            // 保存后，立刻应用新模板（并附上日期）
            applyTemplate(newTemplate);
        });
    }

    // 主监视循环
    setInterval(async () => {
        const mainTextarea = document.querySelector('textarea.prompt-editor');
        if (!mainTextarea) return;

        // 当文本框为空时，注入模板
        if (mainTextarea.value.trim() === '') {
            if (!uiCreated) {
                createAndShowUI();
            }
            const baseTemplate = await GM_getValue(STORAGE_KEY, DEFAULT_TEMPLATE_TEXT);
            // 再次检查，防止在异步获取模板期间用户输入了内容
            if (mainTextarea.value.trim() === '') {
                // 应用模板（此函数会自动加上日期）
                applyTemplate(baseTemplate);
            }
        }
    }, 500);

})();